# Vault prompt-pack export

Save reusable LocalGPT prompt-pack outputs (a worldgen description plus style and tags) as deterministic markdown files inside a chosen Obsidian vault project folder, so the same world-building recipe can be repeated without manual copy/paste.

This differs from one-off scratch output: prompt-packs land in a stable, vault-safe location next to the project notes that iterate on them, with a deterministic filename and frontmatter you can search later.

## Folder shape

Default target:

```text
<vault-root>/4_Project/<project>/prompt-packs/<timestamp>__<name>__<session>.md
```

Examples:

- `4_Project/OSS/pi-localgpt/prompt-packs/2026-06-28T05-15-30-000Z__Forest-Demo__pi-session-7.md`
- `4_Project/Roblox/LevelKit/prompt-packs/2026-06-28T05-15-30-000Z__Neon-Obby__review-1.md`

Use `prompt_packs_dir` when a project documents a different vault-safe folder, for example `assets/prompt-packs`.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `name` | Human-readable pack name embedded in the filename and markdown title. Default: `pack`. Sanitized for safe paths. |
| `description` | **Required.** The reusable worldgen prompt / planning description. Saved verbatim under `## Description`. |
| `style` | Optional style hint (medieval, sci-fi, urban, etc.) saved in frontmatter and under `## Style`. |
| `tags` | Optional comma/newline-separated tags or string array. Normalized to lowercase kebab-case. |
| `notes` | Optional extra markdown saved under `## Notes`. |
| `session` | Pi or LocalGPT session id embedded in the filename and frontmatter. Use a unique value per export run. |
| `filename` | Override the output filename (e.g. `forest-demo.md` or `lobby-layout`). When set, timestamp/name/session are not used in the filename. Extension defaults to `.md` when omitted. |
| `prompt_packs_dir` | Custom subfolder under the project root (default: `prompt-packs`). Example: `assets/prompt-packs`. |
| `vault_root` | Obsidian vault root path. Inferred from `[design-log].workspace` when under `4_Project/`. |
| `vault_project` | Project slug under `4_Project/` (e.g. `OSS/pi-localgpt`). Inferred from workspace path. |
| `overwrite` | Replace an existing file at the resolved path. Default: `false` (refuse with a clear error). |

## Overwrite rules

- The directory is created recursively when missing.
- An existing file at the resolved path is **refused by default** using an atomic exclusive-create (`wx`) write, so concurrent exports resolving the same filename cannot silently replace each other. On conflict the call fails with a clear message naming the vault-relative path and the `overwrite=true` flag.
- Pass `overwrite: true` to replace an existing file. The result reports `overwritten: true` only when a file already existed at the resolved path.

Two exports with the **same timestamp + name + session** (or the same `filename` override) resolve to the same path. Unlike screenshot export, the second call **fails by default** instead of silently overwriting.

To avoid accidental conflicts:

- Use a **unique `session` value** per export run (`dogfood-review`, `review-1`, `pi-session-7`, etc.)
- Use the **`filename` parameter** for stable, named packs you intend to revise with `overwrite: true`
- Space exports by **at least one second** if relying on timestamp uniqueness in auto-generated filenames

## Output content

Each prompt-pack is a markdown file with YAML frontmatter and fixed sections:

```markdown
---
title: "Forest Demo"
style: "nature"
tags: ["forest","altar"]
exported_at: 2026-06-28T05:15:30.000Z
session: "pi-session-7"
vault_project: "OSS/pi-localgpt"
---

# Forest Demo

## Description

A misty forest clearing with a stone altar and scattered fog particles.

## Style

nature

## Tags

- forest
- altar
```

Frontmatter values are YAML-serialized (double-quoted), so names, styles, sessions, or tags containing colons, commas, or other YAML-special characters remain valid frontmatter.

`## Style`, `## Tags`, and `## Notes` sections are omitted when the corresponding fields are not provided.

## Configuration

`localgpt_export_prompt_pack` reads the LocalGPT design-log workspace from `[design-log].workspace` in `config.toml`.

When that workspace path is already under `4_Project/<project>/`, Pi infers:

- `vault_root` = path before `4_Project/`
- `vault_project` = path after `4_Project/`

For workspaces outside the vault, pass `vault_root` and `vault_project` explicitly.

This tool is a **local filesystem write** — it does not spawn `localgpt-gen` and does not require the relay to be running. (Contrast with `localgpt_gen_export_screenshot`, which delegates the actual image write to `gen_export_screenshot` over the bridge.)

## End-to-end example (worldgen / prototype)

1. Point LocalGPT design log at the vault project:

```toml
[design-log]
workspace = "/path/to/vault/4_Project/OSS/pi-localgpt"
```

2. Iterate on a worldgen description (via `localgpt_gen_plan`, a vault note, or a Roblox trend summary) until you have a recipe worth reusing.

3. Export the prompt-pack into the project prompt-packs folder from Pi:

```json
{
  "tool": "localgpt_export_prompt_pack",
  "args": {
    "name": "Forest Demo",
    "description": "A misty forest clearing with a stone altar and scattered fog particles. Central hero prop: a cracked stone altar. Medium props: fallen logs and mossy rocks. Decorative: hanging fog and fireflies.",
    "style": "nature",
    "tags": ["forest", "altar", "hero-props"],
    "session": "pi-session-7"
  }
}
```

4. Pi creates `prompt-packs/` when missing, resolves the vault-safe path, refuses to clobber an existing file unless `overwrite: true`, and writes the markdown.

5. Re-run the same worldgen later by pasting the saved `## Description` into `localgpt_gen_plan`, or feed the whole note to `localgpt_gen_plan_from_note`.

## Examples

### Custom prompt-packs subfolder

When a project uses `assets/prompt-packs` instead of the default `prompt-packs/`:

```json
{
  "tool": "localgpt_export_prompt_pack",
  "args": {
    "name": "Neon Lobby",
    "description": "Neon lobby with glass floor panels and spawn pads.",
    "session": "review-1",
    "prompt_packs_dir": "assets/prompt-packs"
  }
}
```

Result: `4_Project/OSS/pi-localgpt/assets/prompt-packs/2026-07-02T10-00-00-000Z__Neon-Lobby__review-1.md`

### Custom filename for a stable recipe

```json
{
  "tool": "localgpt_export_prompt_pack",
  "args": {
    "name": "Forest Demo",
    "description": "A misty forest clearing with a stone altar.",
    "filename": "forest-demo.md"
  }
}
```

Result: `4_Project/OSS/pi-localgpt/prompt-packs/forest-demo.md`

When `filename` is set, `name` and `session` are not embedded in the path — only the sanitized filename is used. Omit the extension to get `.md` automatically (`lobby-layout` → `lobby-layout.md`).

## Explicit multi-project export

To export into another vault project without changing config:

```json
{
  "tool": "localgpt_export_prompt_pack",
  "args": {
    "vault_root": "/path/to/vault",
    "vault_project": "Roblox/LevelKit",
    "name": "Neon Obby",
    "description": "A neon platforming obby with checkpoints every five jumps.",
    "session": "review-1"
  }
}
```

## Replacing a prompt-pack

To update an existing pack in place:

```json
{
  "tool": "localgpt_export_prompt_pack",
  "args": {
    "name": "Forest Demo",
    "description": "A misty forest clearing with a stone altar and a new northern path.",
    "filename": "forest-demo.md",
    "overwrite": true
  }
}
```

Without `overwrite: true`, the call fails rather than silently clobbering the previous version.

## Dogfood review recommendation (DOT-398)

Dogfooded against a vault-shaped `4_Project/OSS/pi-localgpt` workflow (worldgen recipe → `localgpt_export_prompt_pack` → reuse via `localgpt_gen_plan`).

**Friction reduced:** export writes markdown directly into the project `prompt-packs/` folder with YAML frontmatter and searchable tags, eliminating manual copy/paste into vault notes.

**Keep as-is:** default refuse-on-conflict (`wx`) is safer than screenshot export's silent overwrite; error messages name the vault-relative path and `overwrite=true`.

**Recommended usage:**

1. Use auto-generated filenames (`name` + unique `session`) while iterating on new recipes.
2. Promote a keeper recipe to a stable `filename` (e.g. `forest-demo.md`) and use `overwrite: true` for revisions.
3. Point `prompt_packs_dir` at project-documented folders when `prompt-packs/` is not the convention.

Fixture: `tests/fixtures/prompt-pack-dogfood-forest-demo.md` captures a representative dogfood export for regression.
