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

## Parameters

| Parameter | Description |
|-----------|-------------|
| `world` | World or skill name embedded in the filename. Gets sanitized for safe paths. |
| `session` | Pi or LocalGPT session id embedded in the filename after the world. |
| `filename` | Override the entire output filename (e.g. `hero-shot.png`). When set, `world` and `session` are not included in the filename. |
| `screenshots_dir` | Custom subfolder under the project root (default: `screenshots`). Example: `assets/renders`. |
| `vault_root` | Obsidian vault root path. Inferred from `[design-log].workspace` when under `4_Project/`. |
| `vault_project` | Project slug under `4_Project/` (e.g. `Roblox/LevelKit`). Inferred from workspace path. |
| `path` | Absolute one-off destination. When set, vault inference is skipped entirely. |

## Overwrite behavior

Two exports with the **same timestamp + world + session** produce the same filename.
The second call **silently overwrites** the first file.

To avoid accidental overwrites:

- Use a **unique `session` value** per export run (`dogfood-review`, `review-1`, `pi-session-7`, etc.)
- Use the **`filename` parameter** for one-off named exports (e.g. `hero-shot.png`)
- Space exports by **at least one second** if relying on timestamp uniqueness

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

## Examples

### Custom screenshots subfolder

When a project uses `assets/renders` instead of the default `screenshots/`:

```json
{
  "tool": "localgpt_gen_export_screenshot",
  "args": {
    "world": "Lobby",
    "session": "review-1",
    "screenshots_dir": "assets/renders"
  }
}
```

Result: `4_Project/Roblox/LevelKit/assets/renders/2026-07-01T12-00-00-000Z__Lobby__review-1.png`

### Custom filename for a specific shot

```json
{
  "tool": "localgpt_gen_export_screenshot",
  "args": {
    "vault_project": "OSS/pi-localgpt",
    "filename": "hero-shot.png"
  }
}
```

Result: `4_Project/OSS/pi-localgpt/screenshots/hero-shot.png`

When `filename` is set, `world` and `session` are not embedded — the name is used as-is (sanitized for safe filesystem characters).

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

### Reverting from `path` back to vault export

After using `path` for a one-off destination, remove it from args to restore vault inference. `path` takes priority over all vault-related fields:

```json
{
  "tool": "localgpt_gen_export_screenshot",
  "args": {
    "path": "/tmp/debug-shot.png"
  }
}
```

→ removes `path` from args → vault inference works again:

```json
{
  "tool": "localgpt_gen_export_screenshot",
  "args": {
    "world": "Lobby",
    "session": "review-2"
  }
}
```
