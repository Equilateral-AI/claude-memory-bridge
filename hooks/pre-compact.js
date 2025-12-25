#!/usr/bin/env node
/**
 * Claude Memory Bridge - Pre-Compact Hook
 *
 * Saves conversation summary before context compaction.
 * Part of a minimal memory persistence system for Claude Code.
 *
 * MIT License - https://github.com/Equilateral-AI/claude-memory-bridge
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(process.env.HOME, '.claude', 'memory-bridge.db');
const MAX_SESSIONS = 5; // Rolling window

/**
 * Initialize SQLite database
 */
function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      project_path TEXT,
      summary TEXT,
      key_decisions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_created ON sessions(created_at DESC);
  `);

  return db;
}

/**
 * Extract summary from transcript
 */
function extractSummary(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');

    // Parse JSONL transcript
    const messages = lines
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean);

    // Extract key information
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    // Get first user message as context
    const initialRequest = userMessages[0]?.content?.substring(0, 500) || '';

    // Look for decisions/conclusions in assistant messages
    const decisions = [];
    for (const msg of assistantMessages.slice(-5)) {
      const content = typeof msg.content === 'string' ? msg.content : '';

      // Extract lines that look like decisions/conclusions
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.match(/^[-*]\s*(Created|Updated|Fixed|Added|Removed|Changed|Implemented|Configured)/i)) {
          decisions.push(line.trim());
        }
      }
    }

    return {
      initialRequest: initialRequest,
      messageCount: messages.length,
      decisions: decisions.slice(0, 10) // Keep top 10
    };
  } catch (error) {
    console.error('[MemoryBridge] Error parsing transcript:', error.message);
    return null;
  }
}

/**
 * Prune old sessions beyond rolling window
 */
function pruneOldSessions(db, projectPath) {
  db.prepare(`
    DELETE FROM sessions
    WHERE project_path = ?
    AND id NOT IN (
      SELECT id FROM sessions
      WHERE project_path = ?
      ORDER BY created_at DESC
      LIMIT ?
    )
  `).run(projectPath, projectPath, MAX_SESSIONS);
}

/**
 * Main hook execution
 */
async function main() {
  let input = '';

  // Read from stdin
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    const hookData = JSON.parse(input);
    const { session_id, transcript_path, cwd } = hookData;

    const projectPath = cwd || process.cwd();

    // Extract summary from transcript
    const summary = extractSummary(transcript_path);

    if (!summary) {
      console.error('[MemoryBridge] No summary extracted');
      process.exit(0);
    }

    // Save to database
    const db = initDb();

    db.prepare(`
      INSERT INTO sessions (session_id, project_path, summary, key_decisions)
      VALUES (?, ?, ?, ?)
    `).run(
      session_id,
      projectPath,
      summary.initialRequest,
      JSON.stringify(summary.decisions)
    );

    // Prune old sessions
    pruneOldSessions(db, projectPath);

    db.close();

    console.error(`[MemoryBridge] Saved session ${session_id} (${summary.decisions.length} decisions)`);
    process.exit(0);

  } catch (error) {
    console.error('[MemoryBridge] Error:', error.message);
    process.exit(0); // Don't block compaction
  }
}

main();
