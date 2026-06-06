# Manual test checklist — pi-localgpt

Run after `pi -e .` or `pi install` with a local package path.

## Setup

1. Ensure a workspace exists (or set `LOCALGPT_WORKSPACE` to a test folder).
2. Create `MEMORY.md` with a known phrase, e.g. `test-marker-pi-localgpt`.
3. Optional: add `memory/YYYY-MM-DD.md` with another phrase.

## Windows

- [ ] `/localgpt:status` shows workspace path under `%APPDATA%\\localgpt\\workspace` (or override).
- [ ] `localgpt_memory_search` finds `test-marker-pi-localgpt`.
- [ ] `localgpt_memory_get` returns lines from `MEMORY.md`.
- [ ] `/localgpt:remember` appends text; file updates on disk.
- [ ] `localgpt_memory_log` appends to today's log under `memory/`.

## macOS / Linux

- [ ] `/localgpt:status` shows `~/.config/localgpt/config.toml` or override.
- [ ] Search / get / save / log same as Windows.

## Regression

- [ ] No `localgpt` process appears in Task Manager / `ps` during tool calls.
- [ ] Path traversal (`../outside.md`) returns structured error.
