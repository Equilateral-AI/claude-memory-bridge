#!/usr/bin/env node
/**
 * Claude Memory Bridge - Session Start Hook
 *
 * Loads previous session context and injects into new session.
 * Part of a minimal memory persistence system for Claude Code.
 *
 * MIT License - https://github.com/Equilateral-AI/claude-memory-bridge
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(process.env.HOME, '.claude', 'memory-bridge.db');
const MAX_SESSIONS = 5;

/**
 * Load recent sessions from database
 */
function loadRecentSessions(projectPath) {
  if (!fs.existsSync(DB_PATH)) {
    return [];
  }

  try {
    const db = new Database(DB_PATH, { readonly: true });

    const sessions = db.prepare(`
      SELECT session_id, summary, key_decisions, created_at
      FROM sessions
      WHERE project_path = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(projectPath, MAX_SESSIONS);

    db.close();
    return sessions;

  } catch (error) {
    console.error('[MemoryBridge] Error loading sessions:', error.message);
    return [];
  }
}

/**
 * Format sessions as context injection
 */
function formatContext(sessions) {
  if (!sessions || sessions.length === 0) {
    return '';
  }

  const lines = [
    '## Previous Session Context',
    '',
    `*Memory from last ${sessions.length} session(s) in this project:*`,
    ''
  ];

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const date = new Date(session.created_at).toLocaleDateString();
    const decisions = JSON.parse(session.key_decisions || '[]');

    lines.push(`### Session ${i + 1} (${date})`);

    if (session.summary) {
      lines.push(`**Context**: ${session.summary.substring(0, 200)}...`);
    }

    if (decisions.length > 0) {
      lines.push('**Key actions**:');
      for (const decision of decisions.slice(0, 5)) {
        lines.push(decision);
      }
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('*Memory provided by [claude-memory-bridge](https://github.com/Equilateral-AI/claude-memory-bridge)*');

  return lines.join('\n');
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
    const projectPath = process.cwd();

    // Load recent sessions
    const sessions = loadRecentSessions(projectPath);

    if (sessions.length === 0) {
      process.exit(0);
    }

    // Format and output context
    const context = formatContext(sessions);

    // Output as JSON with additionalContext for Claude Code
    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context
      }
    };

    console.log(JSON.stringify(output));
    console.error(`[MemoryBridge] Injected ${sessions.length} session(s) of context`);
    process.exit(0);

  } catch (error) {
    console.error('[MemoryBridge] Error:', error.message);
    process.exit(0); // Don't block session start
  }
}

main();
