# Pi LocalGPT

[![CI](https://github.com/eiei114/pi-localgpt/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-localgpt/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-localgpt/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-localgpt/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/pi-localgpt.svg)](https://www.npmjs.com/package/pi-localgpt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](docs/release.md)

> LocalGPT workspace memory for Pi — direct file access, no `localgpt` binary spawn.

## What this is

`pi-localgpt` gives Pi agents curated tools to read and write **[LocalGPT](https://localgpt.app/)** workspace memory (`MEMORY.md`, daily logs).

- **No** per-call `localgpt mcp-server` spawn
- **No** `.mcp.json` resident MCP requirement
- **No** `cargo install localgpt` required for memory tools
- Keyword search over workspace markdown (not upstream semantic ranking)

> **Not** the unrelated Python RAG project also named "LocalGPT".

## Prerequisites

A LocalGPT workspace with markdown memory files. Typical layout:

```text
<workspace>/
├── MEMORY.md
└── memory/
    └── YYYY-MM-DD.md
```

Paths resolve from:

- `%APPDATA%/localgpt/config.toml` (Windows) or `~/.config/localgpt/config.toml` (macOS/Linux)
- `[memory].workspace` in config, or defaults under `%APPDATA%/localgpt/workspace` / `~/.local/share/localgpt/workspace`
- Overrides: `LOCALGPT_CONFIG`, `LOCALGPT_WORKSPACE`

Optional: install upstream [localgpt](https://github.com/localgpt-app/localgpt) if you also want chat, daemon, or hybrid semantic search outside Pi.

## Install

```bash
pi install npm:pi-localgpt
```

Local development:

```bash
git clone https://github.com/eiei114/pi-localgpt.git
cd pi-localgpt
npm install
pi -e .
```

## Tools

| Tool | Purpose |
|---|---|
| `localgpt_status` | Config + workspace + file readiness |
| `localgpt_memory_search` | Keyword search over workspace markdown |
| `localgpt_memory_get` | Read line range from a memory file |
| `localgpt_memory_save` | Append to `MEMORY.md` |
| `localgpt_memory_log` | Append to today's daily log |

## Commands

| Command | Purpose |
|---|---|
| `/localgpt:status` | Show workspace status |
| `/localgpt:search` | Prompt for a memory query |
| `/localgpt:remember` | Prompt for text → `MEMORY.md` |

## Recommended workflow

1. Run `localgpt_status` when workspace location is uncertain.
2. `localgpt_memory_search` for recall.
3. `localgpt_memory_get` when snippets are too short.
4. `localgpt_memory_save` for durable facts; `localgpt_memory_log` for daily notes.

## Alternative: upstream MCP

If you prefer upstream hybrid search and official tool semantics, register LocalGPT's MCP server directly:

```json
{
  "mcpServers": {
    "localgpt": {
      "command": "localgpt",
      "args": ["mcp-server"]
    }
  }
}
```

That spawns the Rust binary per MCP session. `pi-localgpt` avoids that by reading files directly.

## Manual test checklist

See [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md).

## Development

```bash
npm install
npm run ci
```

## Release

npm Trusted Publishing via GitHub Actions. See [`docs/release.md`](docs/release.md).

## Security

Pi packages execute with your local permissions. Memory append tools can modify files under your LocalGPT workspace.

See [`SECURITY.md`](SECURITY.md).

## Links

- npm: https://www.npmjs.com/package/pi-localgpt
- GitHub: https://github.com/eiei114/pi-localgpt
- Upstream: https://github.com/localgpt-app/localgpt

## License

MIT
