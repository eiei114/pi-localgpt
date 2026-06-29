# Manual test checklist — pi-localgpt

Run after `pi -e .` or `pi install` with a local package path.

## Prerequisites

1. `localgpt-gen` installed (`cargo install localgpt-gen`).
2. **localgpt-gen running interactively** (Bevy window open) — all tools connect via `--connect` relay on port 9878.

## Status check

- [ ] `/localgpt:gen-status` shows binary found + relay reachable + tool count.
- [ ] `localgpt_gen_status` returns same info as a tool.

## Design log tools

- [ ] `localgpt_design_log_search` finds known phrases.
- [ ] `localgpt_design_log_get` returns full entry by ID from search results.
- [ ] `localgpt_design_log_save` persists content; returns entry ID.
- [ ] `localgpt_design_log_log` appends to today's log.

## Gen tools

- [ ] `localgpt_gen_scene` returns scene hierarchy.
- [ ] `localgpt_gen_spawn` with `{ "type": "cube", "position": [0, 1, 0] }` — cube appears in Bevy window.
- [ ] `localgpt_gen_screenshot` returns image data.
- [ ] `localgpt_gen_modify` changes entity color/position.
- [ ] `localgpt_gen_delete` removes an entity.
- [ ] `localgpt_gen_undo` reverts last edit.
- [ ] `localgpt_gen_redo` reapplies undone edit.
- [ ] `localgpt_gen_clear` clears the scene.

## WorldGen pipeline

- [ ] `localgpt_gen_plan` with description → structured layout JSON.
- [ ] `localgpt_gen_blockout` applies layout → terrain + regions appear.
- [ ] `localgpt_gen_modify_blockout` edits blockout regions.
- [ ] `localgpt_gen_populate` fills region with entities.
- [ ] `localgpt_gen_set_tier` / `localgpt_gen_set_role` tag entities.
- [ ] `localgpt_gen_evaluate` captures annotated screenshot.
- [ ] `localgpt_gen_refine` runs auto-improvement loop.
- [ ] `localgpt_gen_navmesh` builds walkability grid.
- [ ] `localgpt_gen_regenerate` refreshes regions after blockout changes.

## Export & World Skills

- [ ] `localgpt_gen_save` / `localgpt_gen_load` saves and loads worlds.
- [ ] `localgpt_gen_export_gltf` exports glTF file.
- [ ] `localgpt_gen_export_html` exports self-contained HTML.
- [ ] `localgpt_export_prompt_pack` writes a markdown prompt-pack into `4_Project/<project>/prompt-packs/`; refuses overwrite unless `overwrite=true`.

## Generic call

- [ ] `localgpt_gen_call` with unwrapped tool name (e.g. `gen_set_sky`) executes via 1-shot CLI.

## Regression

- [ ] Each tool call spawns a short-lived `localgpt-gen mcp-server --connect` process that exits after the call.
- [ ] No persistent `localgpt-gen` background process from pi-localgpt (only the interactive Bevy window).
