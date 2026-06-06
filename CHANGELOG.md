# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-06-06

### Added

- Phase 2d — Game mechanics curated wrappers:
  - Player & NPC: `localgpt_gen_spawn_player`, `localgpt_gen_add_npc`, `localgpt_gen_npc_dialogue`
  - Interactions: `localgpt_gen_add_trigger`, `localgpt_gen_add_teleporter`, `localgpt_gen_add_collectible`, `localgpt_gen_add_door`
  - Physics: `localgpt_gen_set_physics`, `localgpt_gen_add_collider`, `localgpt_gen_add_force`, `localgpt_gen_set_gravity`
  - Terrain & Sky: `localgpt_gen_add_terrain`, `localgpt_gen_add_water`, `localgpt_gen_add_foliage`, `localgpt_gen_set_sky`
  - Audio: `localgpt_gen_set_ambience`, `localgpt_gen_audio_emitter`
- Phase 2e — `localgpt_gen_export_screenshot` export to file.
- 42 total tests (18 new wrapper tests).

## [0.3.0] - 2026-06-06

### Changed

- **BREAKING**: Removed v1 filesystem direct access (memory tools now use MCP bridge).
- Removed: `lib/memory-search.ts`, `lib/memory-read.ts`, `lib/memory-write.ts`, `lib/localgpt-config.ts`, `lib/localgpt-workspace.ts`, `lib/localgpt-init.ts`, `lib/formatters.ts`, `lib/status.ts`, `lib/localgpt-memory.ts`.
- Removed: `skills/localgpt-memory/` (merged into `localgpt-gen` skill).
- Removed: v1 commands (`/localgpt:status`, `/localgpt:init`, `/localgpt:search`, `/localgpt:remember`).
- Unified architecture: all tools (memory + gen) use `localgpt-gen mcp-server --connect` 1-shot CLI.

### Added

- Memory MCP wrappers: `localgpt_memory_search`, `localgpt_memory_get`, `localgpt_memory_save`, `localgpt_memory_log` via `genCallTool`.
- Memory tools in `lib/gen-tools.ts` with TypeBox schemas.

## [0.2.0] - 2026-06-06

### Added

- Gen MCP 1-shot bridge via `localgpt-gen mcp-server --connect` (no persistent process).
- Tools: `localgpt_gen_status`, `localgpt_gen_call`.
- Curated gen tools (27): scene query, spawn/modify/delete, camera/light/environment, WorldGen pipeline, export, world skills, undo/redo.
- WorldGen pipeline: `localgpt_gen_plan`, `localgpt_gen_blockout`, `localgpt_gen_modify_blockout`, `localgpt_gen_populate`, `localgpt_gen_set_tier`, `localgpt_gen_set_role`, `localgpt_gen_evaluate`, `localgpt_gen_refine`, `localgpt_gen_navmesh`, `localgpt_gen_regenerate`.
- Command: `/localgpt:gen-status`.
- Skill: `localgpt-gen`.

### Notes

- Gen tools require `localgpt-gen` running interactively for `--connect` relay.
- Unwrapped gen tools (NPC, physics, terrain, etc.) available via `localgpt_gen_call`.

## [0.1.0] - 2026-06-06

### Added

- Direct LocalGPT workspace memory access (no `localgpt` binary spawn).
- Tools: `localgpt_status`, `localgpt_memory_search`, `localgpt_memory_get`, `localgpt_memory_save`, `localgpt_memory_log`.
- Commands: `/localgpt:status`, `/localgpt:search`, `/localgpt:remember`, `/localgpt:init`.
- Skill: `localgpt-memory`.
- Keyword search over `MEMORY.md` and `memory/*.md`.

### Notes

- Search is keyword-based; upstream hybrid semantic/sqlite-vec ranking is not replicated.
- **Removed in 0.3.0** — replaced by MCP bridge unified architecture.
