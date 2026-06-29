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

## Overwrite rules

- The directory is created recursively when missing.
- An existing file at the resolved path is **refused by default** using an atomic exclusive-create (`wx`) write, so concurrent exports resolving the same filename cannot silently replace each other. On conflict the call fails with a clear message naming the vault-relative path and the `overwrite=true` flag.
- Pass `overwrite: true` to replace an existing file. The result reports `overwritten: true` so you can tell a fresh write from a replacement.

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
