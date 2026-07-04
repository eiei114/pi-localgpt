# Changelog

## Unreleased

- Add Buy Me a Coffee sponsor button to README and native GitHub funding link via `.github/FUNDING.yml`.

All notable changes to this project will be documented in this file.

## [0.10.0] - 2026-06-30

### Added

- Vault prompt-pack export via `localgpt_export_prompt_pack` (DOT-397): saves a reusable worldgen prompt-pack (description + style + tags) as a deterministic markdown file under a vault project `prompt-packs/` folder.
- `lib/vault-prompt-pack-export.ts` path/content shaping module with vault-safe resolution, deterministic `<timestamp>__<name>__<session>.md` filenames, explicit overwrite rules (refuse by default; `overwrite=true` to replace), and frontmatter + sectioned markdown output.
- `docs/vault-prompt-pack-export.md` with folder shape, overwrite rules, and a worldgen/prototype end-to-end example.
- Tests covering success, missing project inference, explicit vault override, missing description, and overwrite refuse/replace behavior.

## [0.9.0] - 2026-06-29

### Added

- WorldGen design rationale memory workflow via `localgpt_remember_worldgen` and `/localgpt:remember-worldgen` (DOT-361).
- `lib/memory-worldgen-save.ts` shaping module that excerpts plan/evaluate/export/world artifacts into compact pointers and never embeds raw scene JSON.
- Missing-reference fallback: partial worldgen iterations still produce a recallable entry with a `[no worldgen artifacts referenced for: ...]` note.
- `docs/memory-worldgen-save.md` with the recommended post-iteration save pattern and when to prefer it over generic `localgpt_design_log_save`.
- Tests for payload shaping, artifact excerpting, compactness caps, and missing-reference fallback behavior.

## [0.8.0] - 2026-06-28

### Added

- Roblox trend → prototype workflow via `localgpt_gen_plan_from_roblox_trend` and `/localgpt:plan-from-roblox-trend`.
- Stable prompt shaping that separates research facts from `speculative_ideas` with explicit guardrails.
- `docs/roblox-trend-prototype.md` with a trend-summary-to-prototype example.

## [0.7.0] - 2026-06-28

### Added

- Shareable world template metadata layer with five built-in starter templates.
- `localgpt_gen_list_templates` for discovering templates by id, tags, and style hints.
- `localgpt_gen_template` for loading named templates through the existing saved-world load flow.
- `docs/world-templates.md` with discovery, load, and custom-template examples.

## [0.6.0] - 2026-06-28

### Added

- Vault note → plan workflow via `localgpt_gen_plan_from_note` and `/localgpt:plan-from-note`.
- Markdown cleanup for frontmatter, headings, wiki links, and blockquotes before `gen_plan_layout`.
- Lightweight `[Source: ...]` trace header in shaped planning prompts.
- `docs/vault-note-plan-layout.md` with note-shape guidance and when to prefer `localgpt_gen_plan`.

## [0.5.0] - 2026-06-28

### Added

- Vault screenshot export plumbing for `localgpt_gen_export_screenshot` and `localgpt_gen_screenshot`.
- Resolve `4_Project/<project>/screenshots/` (or a custom `screenshots_dir`) from design-log workspace context or explicit `vault_root` / `vault_project`.
- Contextual filenames with `world` and `session` markers plus automatic screenshots folder creation.
- `docs/vault-screenshot-export.md` with an end-to-end export example.

## [0.4.3] - 2026-06-27

### Changed

- Aligned README install guidance with the Pi OSS template: GitHub install, project-local (`-l`), version pinning, and `pi -e npm:pi-localgpt` try-before-install paths.
- Documented `npm run ci` and `npm pack --dry-run` (`pack:check`) in the Development section.

## [0.4.2] - 2026-06-17

### Changed

- Renamed LocalGPT "memory" user-facing wording to "design log" across docs and tool descriptions.
- Added backward-compatible `localgpt_memory_*` legacy aliases so existing workflows continue to work while newer docs point to `localgpt_design_log_*` tools.
- Added LocalGPT workspace helper libraries and tests for design-log path/config handling.

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

