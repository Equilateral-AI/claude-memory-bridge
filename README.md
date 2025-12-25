# Claude Memory Bridge

**Minimal memory persistence for Claude Code using hooks**

Claude Code conversations are ephemeral - when context compacts, previous session knowledge is lost. This bridge saves key context before compaction and reinjects it at session start.

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

## Installation

```bash
# Clone the repo
git clone https://github.com/Equilateral-AI/claude-memory-bridge.git
cd claude-memory-bridge

# Install dependencies
npm install

# Install hooks into Claude Code
npm run install-hooks
```

This adds two hooks to `~/.claude/settings.json`:
- **PreCompact**: Saves context before compaction
- **SessionStart**: Loads context when session starts

## What Gets Saved

The pre-compact hook extracts:
- Initial user request (first 500 chars)
- Key decisions (lines starting with "Created", "Updated", "Fixed", etc.)

Stored in SQLite at `~/.claude/memory-bridge.db`.

**Scoped by project**: Memory is keyed by working directory. Sessions from `/path/to/projectA` won't leak into `/path/to/projectB`. Each project maintains its own rolling 5-session window.

## Configuration

Edit `hooks/pre-compact.js` to customize:

```javascript
const MAX_SESSIONS = 5;  // Rolling window size
```

## Manual Usage

Test the hooks directly:

```bash
# Test session-start injection
echo '{"session_id":"test"}' | node hooks/session-start.js

# View stored sessions
sqlite3 ~/.claude/memory-bridge.db "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5;"
```

## Uninstall

```bash
npm run install-hooks -- --uninstall
```

## Claude Code Hooks API

This project uses Claude Code's official hooks system:

| Hook | Trigger | Purpose |
|------|---------|---------|
| `PreCompact` | Before context compaction | Save learnings |
| `SessionStart` | New session begins | Inject context |

Hooks receive JSON on stdin and can output context to stdout.

See [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for full hooks reference.

## Feature Request

This implements a minimal version of session memory. For a more robust solution, consider requesting official support:

**Proposed Feature**: Native context persistence across compaction events

- Automatic summarization before compaction
- User-controlled memory scope (project, global)
- Privacy-respecting local storage
- Integration with `/compact` command

Add your voice: [Claude Code GitHub Issues](https://github.com/anthropics/claude-code/issues)

## License

MIT License - See [LICENSE](LICENSE)

## Credits

- **Equilateral AI** (Pareidolia LLC)
- Built with [Claude Code](https://claude.com/claude-code) - December 2025
