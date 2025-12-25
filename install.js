#!/usr/bin/env node
/**
 * Claude Memory Bridge - Installer
 *
 * Adds hooks to Claude Code settings.json
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_SETTINGS = path.join(process.env.HOME, '.claude', 'settings.json');
const HOOKS_DIR = path.join(__dirname, 'hooks');

function install() {
  console.log('Claude Memory Bridge - Installer\n');

  // Ensure .claude directory exists
  const claudeDir = path.dirname(CLAUDE_SETTINGS);
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // Load existing settings or create new
  let settings = {};
  if (fs.existsSync(CLAUDE_SETTINGS)) {
    try {
      settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, 'utf-8'));
    } catch (error) {
      console.error('Warning: Could not parse existing settings.json');
    }
  }

  // Initialize hooks object if needed
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Add PreCompact hook
  const preCompactPath = path.join(HOOKS_DIR, 'pre-compact.js');
  settings.hooks.PreCompact = [
    {
      hooks: [
        {
          type: 'command',
          command: `node ${preCompactPath}`,
          timeout: 30
        }
      ]
    }
  ];

  // Add SessionStart hook
  const sessionStartPath = path.join(HOOKS_DIR, 'session-start.js');
  settings.hooks.SessionStart = [
    {
      hooks: [
        {
          type: 'command',
          command: `node ${sessionStartPath}`,
          timeout: 5
        }
      ]
    }
  ];

  // Write updated settings
  fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));

  console.log('✓ Hooks installed successfully!\n');
  console.log('Configuration added to:', CLAUDE_SETTINGS);
  console.log('\nHooks configured:');
  console.log('  - PreCompact: Saves session context before compaction');
  console.log('  - SessionStart: Loads previous context at session start');
  console.log('\nMemory is stored in:', path.join(process.env.HOME, '.claude', 'memory-bridge.db'));
  console.log('\nRestart Claude Code to activate hooks.');
}

function uninstall() {
  console.log('Claude Memory Bridge - Uninstaller\n');

  if (!fs.existsSync(CLAUDE_SETTINGS)) {
    console.log('No settings.json found. Nothing to uninstall.');
    return;
  }

  const settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, 'utf-8'));

  if (settings.hooks) {
    delete settings.hooks.PreCompact;
    delete settings.hooks.SessionStart;

    // Remove hooks object if empty
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }
  }

  fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
  console.log('✓ Hooks removed from settings.json');
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--uninstall') || args.includes('-u')) {
  uninstall();
} else {
  install();
}
