# Claude Memory Bridge

**Minimal memory persistence for Claude Code using hooks**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Claude Code conversations are ephemeral - when context compacts, previous session knowledge is lost. This bridge saves key context before compaction and reinjects it at session start.

## Quick Start

```bash
git clone https://github.com/Equilateral-AI/claude-memory-bridge.git
cd claude-memory-bridge
npm install
npm run install-hooks
```

Restart Claude Code. That's it - memory bridging is now active.

## Requirements

- Node.js 18+
- Claude Code CLI
- macOS, Linux, or WSL (Windows)

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code Session                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SessionStart Hook ──────────────────────────────────────►  │
│  │                                                           │
│  └─► Load last 5 sessions from SQLite                       │
│  └─► Inject as "Previous Session Context"                   │
│                                                              │
│  ... conversation happens ...                                │
│                                                              │
│  PreCompact Hook ◄───────────────────────────────────────── │
│  │                                                           │
│  └─► Parse transcript for key decisions                     │
│  └─► Save to SQLite (rolling 5-session window)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### What Gets Injected

At session start, you'll see context like this:

```markdown
## Previous Session Context

*Memory from last 3 session(s) in this project:*

### Session 1 (12/24/2025)
**Context**: Help me add authentication to the API...
**Key actions**:
- Created auth middleware in src/middleware/auth.js
- Updated user routes to require authentication
- Added JWT token validation

### Session 2 (12/23/2025)
**Context**: Fix the database connection pooling issue...
**Key actions**:
- Fixed connection leak in query handler
- Added connection timeout configuration
```

## What Gets Saved

The pre-compact hook extracts:
- **Initial request**: First 500 chars of what you asked
- **Key decisions**: Lines starting with "Created", "Updated", "Fixed", "Added", "Removed", "Changed", "Implemented", "Configured"

**Scoped by project**: Memory is keyed by working directory. Sessions from `/path/to/projectA` won't leak into `/path/to/projectB`. Each project maintains its own rolling 5-session window.

## Storage

All data stored locally in SQLite:

```
~/.claude/memory-bridge.db
```

Schema:
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  session_id TEXT,
  project_path TEXT,      -- Scoped by project
  summary TEXT,           -- Initial request
  key_decisions TEXT,     -- JSON array of actions
  created_at DATETIME
);
```

## Configuration

Edit `hooks/pre-compact.js` to customize:

```javascript
const MAX_SESSIONS = 5;  // Rolling window size (default: 5)
```

## CLI Commands

```bash
# Install hooks
npm run install-hooks

# Uninstall hooks
npm run install-hooks -- --uninstall

# Test session-start injection
echo '{"session_id":"test"}' | node hooks/session-start.js

# View stored sessions
sqlite3 ~/.claude/memory-bridge.db "SELECT project_path, summary, created_at FROM sessions ORDER BY created_at DESC LIMIT 10;"

# Clear all memory
rm ~/.claude/memory-bridge.db
```

## Claude Code Hooks API

This project uses Claude Code's official hooks system:

| Hook | Trigger | Purpose |
|------|---------|---------|
| `PreCompact` | Before context compaction | Save learnings |
| `SessionStart` | New session begins | Inject context |

Hooks receive JSON on stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "hook_event_name": "PreCompact"
}
```

SessionStart hooks can output context via stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Your context here..."
  }
}
```

See [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for full hooks reference.

## Troubleshooting

**Hooks not running?**
- Check `~/.claude/settings.json` contains the hook configuration
- Restart Claude Code after installing hooks
- Run `claude --debug` to see hook execution

**No context injected?**
- Memory only appears after at least one compaction event
- Check database has entries: `sqlite3 ~/.claude/memory-bridge.db "SELECT COUNT(*) FROM sessions;"`

**Wrong project context?**
- Memory is scoped by `cwd` - ensure you're in the same directory

## Feature Request

This implements a minimal version of session memory. For native support, consider adding your voice:

**Proposed Feature**: Native context persistence across compaction events

- Automatic summarization before compaction
- User-controlled memory scope (project, global)
- Privacy-respecting local storage
- Integration with `/compact` command

👉 [Claude Code GitHub Issues](https://github.com/anthropics/claude-code/issues)

## Contributing

Contributions welcome! Some ideas:

- [ ] Smarter extraction (use Claude to summarize)
- [ ] Memory search/query commands
- [ ] Export/import memory
- [ ] Memory expiration settings

## License

MIT License - See [LICENSE](LICENSE)

## Credits

- **[Equilateral AI](https://equilateral.ai)** (Pareidolia LLC)
- Built with [Claude Code](https://claude.com/claude-code) - December 2025
