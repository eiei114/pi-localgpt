---
name: localgpt-memory
description: When to use LocalGPT workspace memory tools in Pi versus vault search. Cross-session assistant context without spawning the localgpt binary.
---

# LocalGPT Memory

Use **pi-localgpt** when the agent should read or write **[LocalGPT](https://localgpt.app/) workspace memory** — the Rust assistant's `MEMORY.md` and daily logs under `[memory].workspace`.

This is **not** the unrelated Python RAG project also called "LocalGPT".

## When to use

| Situation | Tool |
|-----------|------|
| Uncertain workspace setup | `localgpt_status` or `/localgpt:status` |
| Recall cross-session notes | `localgpt_memory_search` or `/localgpt:search` |
| Read full lines after search | `localgpt_memory_get` |
| Save durable facts | `localgpt_memory_save` or `/localgpt:remember` |
| Today's session log | `localgpt_memory_log` |

## When to use vault tools instead

- Searching **this Obsidian vault** → use qmd / vault search skills, not LocalGPT memory.
- Project PRD / Issues / ADR in `4_Project/` → vault paths, not LocalGPT workspace.

## Recommended flow

1. `/localgpt:init` — create workspace if missing.
2. `localgpt_status` — confirm workspace path and files.
2. `localgpt_memory_search` — keyword recall.
3. `localgpt_memory_get` — expand a hit when snippets are too short.
4. `localgpt_memory_save` or `localgpt_memory_log` — persist new knowledge.

## Limits (v1)

- **No `localgpt` binary spawn** — direct filesystem access only.
- **Keyword search** — not upstream hybrid semantic/sqlite-vec ranking.
- **No** `localgpt-gen` / Bevy tools (see package backlog).
- **No** automatic vault ↔ LocalGPT sync.

## Commands

- `/localgpt:init`
- `/localgpt:status`
- `/localgpt:search`
- `/localgpt:remember`
