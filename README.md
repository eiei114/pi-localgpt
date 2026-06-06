# Pi LocalGPT

[![CI](https://github.com/eiei114/pi-localgpt/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-localgpt/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-localgpt/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-localgpt/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/pi-localgpt.svg)](https://www.npmjs.com/package/pi-localgpt)
[![npm downloads](https://img.shields.io/npm/dm/pi-localgpt.svg)](https://www.npmjs.com/package/pi-localgpt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](docs/release.md)

> 50 curated tools for LocalGPT memory + Gen 3D world building, via unified 1-shot MCP bridge.

## What this is

`pi-localgpt` gives Pi agents tools to work with **[LocalGPT](https://localgpt.app/)** — a Rust-powered real-time 3D level design tool (Bevy engine, 80+ MCP tools).

All tools use a **1-shot MCP bridge**: each call spawns `localgpt-gen mcp-server --connect`, sends one request, and exits. No persistent background process.

> **Not** the unrelated Python RAG project also named "LocalGPT".

## Features

- **Memory tools** — semantic + keyword search, read, save, daily log via MCP bridge
- **Scene building** — spawn/modify/delete entities, camera, lighting, environment
- **WorldGen pipeline** — text description → layout plan → blockout → populate → evaluate → refine
- **Game mechanics** — player, NPC, triggers, teleporters, collectibles, doors, physics
- **Terrain & environment** — procedural terrain, water, foliage, sky, audio
- **Export** — screenshot, glTF, HTML, world skills
- **Generic call** — unwrapped tools accessible via `localgpt_gen_call`

## Prerequisites

- `localgpt-gen` installed (`cargo install localgpt-gen`)
- **localgpt-gen running interactively** (Bevy window open) — all tools connect via `--connect` relay on port 9878

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

## Quick start

1. Start `localgpt-gen` interactively (Bevy window opens)
2. Check relay: `/localgpt:gen-status` or `localgpt_gen_status`
3. Search memory: `localgpt_memory_search` → `localgpt_memory_get`
4. Build world: `localgpt_gen_plan` → `localgpt_gen_blockout` → `localgpt_gen_populate`
5. Save design: `localgpt_memory_save`

See [`skills/localgpt-gen/SKILL.md`](skills/localgpt-gen/SKILL.md) for the full workflow guide.

## Package contents

| Path | Purpose |
|---|---|
| `extensions/` | Pi TypeScript extension entrypoints |
| `lib/` | Shared TypeScript helpers (MCP client, gen tools) |
| `skills/` | Agent Skills (`localgpt-gen`) |
| `scripts/` | CI helpers (version bump check) |
| `docs/` | Supporting docs (release, manual test checklist) |

## Tools

### Memory

| Tool | Purpose |
|---|---|
| `localgpt_memory_search` | Search workspace memory |
| `localgpt_memory_get` | Read entry by ID |
| `localgpt_memory_save` | Save durable knowledge |
| `localgpt_memory_log` | Append to daily log |

### Status

| Tool | Purpose |
|---|---|
| `localgpt_gen_status` | Binary + relay check |
| `localgpt_gen_call` | Generic tool wrapper |

### Scene

| Tool | Purpose |
|---|---|
| `localgpt_gen_screenshot` | Viewport screenshot |
| `localgpt_gen_scene` | Scene hierarchy |
| `localgpt_gen_entity` | Entity details |
| `localgpt_gen_spawn` / `_batch` | Spawn primitives |
| `localgpt_gen_modify` / `_delete` | Entity changes |
| `localgpt_gen_camera` / `_light` / `_environment` | Camera & lighting |
| `localgpt_gen_undo` / `_redo` / `_clear` | History & reset |

### Player & NPC

| Tool | Purpose |
|---|---|
| `localgpt_gen_spawn_player` | Spawn player character |
| `localgpt_gen_add_npc` | Create NPC |
| `localgpt_gen_npc_dialogue` | Conversation tree |

### Interactions

| Tool | Purpose |
|---|---|
| `localgpt_gen_add_trigger` | Proximity/click/area trigger |
| `localgpt_gen_add_teleporter` | Teleporter portal |
| `localgpt_gen_add_collectible` | Collectible pickup |
| `localgpt_gen_add_door` | Interactive door |

### Physics

| Tool | Purpose |
|---|---|
| `localgpt_gen_set_physics` | Physics body |
| `localgpt_gen_add_collider` | Collision shape |
| `localgpt_gen_add_force` | Force / impulse |
| `localgpt_gen_set_gravity` | Gravity preset |

### Terrain & Sky

| Tool | Purpose |
|---|---|
| `localgpt_gen_add_terrain` | Procedural terrain |
| `localgpt_gen_add_water` | Water plane |
| `localgpt_gen_add_foliage` | Vegetation scatter |
| `localgpt_gen_set_sky` | Sky & atmosphere |

### Audio

| Tool | Purpose |
|---|---|
| `localgpt_gen_set_ambience` | Ambient soundscape |
| `localgpt_gen_audio_emitter` | Positional audio |

### WorldGen Pipeline

| Tool | Purpose |
|---|---|
| `localgpt_gen_plan` | Text → layout plan |
| `localgpt_gen_blockout` | Apply blockout |
| `localgpt_gen_modify_blockout` | Edit blockout |
| `localgpt_gen_populate` | Fill region |
| `localgpt_gen_set_tier` / `_role` | Entity tier/role |
| `localgpt_gen_evaluate` | Scene evaluation |
| `localgpt_gen_refine` | Auto-improvement loop |
| `localgpt_gen_navmesh` | Walkability grid |
| `localgpt_gen_regenerate` | Refresh regions |

### Export & World Skills

| Tool | Purpose |
|---|---|
| `localgpt_gen_export_screenshot` | Screenshot to file |
| `localgpt_gen_export_gltf` | Export glTF |
| `localgpt_gen_export_html` | Export HTML |
| `localgpt_gen_save` / `_load` | World skills |

### Commands

| Command | Purpose |
|---|---|
| `/localgpt:gen-status` | Check binary + relay |

Arguments are not required. Details are entered after the command runs.

## Development

```bash
npm install
npm run ci
```

## Release

This package uses npm Trusted Publishing — no `NPM_TOKEN` required.

```bash
npm version patch
git push
```

See [`docs/release.md`](docs/release.md) for setup details.

## Security

Pi packages can execute code with your local permissions. Gen tools drive the Bevy 3D window via the `--connect` relay.

For vulnerability reporting, see [`SECURITY.md`](SECURITY.md).

## Links

- npm: https://www.npmjs.com/package/pi-localgpt
- GitHub: https://github.com/eiei114/pi-localgpt
- Issues: https://github.com/eiei114/pi-localgpt/issues

## License

MIT
