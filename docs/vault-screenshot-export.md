# Vault screenshot export

Export LocalGPT viewport screenshots into Obsidian vault project folders so generated images stay next to the project notes that use them.

## Folder shape

Default target:

```text
<vault-root>/4_Project/<project>/screenshots/<timestamp>__<world>__<session>.png
```

Examples:

- `4_Project/OSS/pi-localgpt/screenshots/2026-06-28T05-15-30-000Z__Forest-Demo__pi-session-7.png`
- `4_Project/Roblox/LevelKit/screenshots/2026-06-28T05-15-30-000Z__Arena__review-1.png`

Use `screenshots_dir` when a project documents a different vault-safe folder, for example `assets/renders`.

## Configuration

`localgpt_gen_export_screenshot` and `localgpt_gen_screenshot` read the LocalGPT design-log workspace from `[design-log].workspace` in `config.toml`.

When that workspace path is already under `4_Project/<project>/`, Pi infers:

- `vault_root` = path before `4_Project/`
- `vault_project` = path after `4_Project/`

For workspaces outside the vault, pass `vault_root` and `vault_project` explicitly.

## End-to-end example

1. Point LocalGPT design log at the vault project:

```toml
[design-log]
workspace = "/path/to/vault/4_Project/OSS/pi-localgpt"
```

2. Build or refine a world in LocalGPT.

3. Export a screenshot into the project screenshots folder from Pi:

```json
{
  "tool": "localgpt_gen_export_screenshot",
  "args": {
    "world": "Forest Demo",
    "session": "pi-session-7"
  }
}
```

4. Pi creates `screenshots/` when missing, resolves the vault-safe path, and calls `gen_export_screenshot` with the absolute output path.

5. Link the image from project notes under `4_Project/OSS/pi-localgpt/`.

## Explicit multi-project export

To export into another vault project without changing config:

```json
{
  "tool": "localgpt_gen_export_screenshot",
  "args": {
    "vault_root": "/path/to/vault",
    "vault_project": "Roblox/LevelKit",
    "world": "Lobby",
    "session": "review-1"
  }
}
```

`path` still overrides vault export when you need a one-off absolute destination.
