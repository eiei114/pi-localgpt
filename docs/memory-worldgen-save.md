# Link `memory_save` with WorldGen outputs

Save a concise design rationale memory that references recent WorldGen outputs (plan / evaluate / export / saved world) so later Pi sessions can recall **why** a generated world was built the way it was — without dumping whole scene JSON into the design log.

## When to use this

| Situation | Tool |
|---|---|
| Generic cross-session note unrelated to a specific world build | `localgpt_design_log_save` |
| A note that should be tied to specific worldgen artifacts (a plan result, an evaluate screenshot, an export path, a saved world) | `localgpt_remember_worldgen` |
| Just a timestamped daily scratch line | `localgpt_design_log_log` |

`localgpt_remember_worldgen` is a thin workflow wrapper: it shapes a structured rationale + artifact references into a compact markdown payload, then dispatches the same upstream `memory_save` tool as `localgpt_design_log_save`. It stays fully compatible with the 1-shot MCP bridge architecture — no new persistent process.

## Tool: `localgpt_remember_worldgen`

Parameters:

- `rationale` *(required)* — the durable design intent: why the world was built this way.
- `summary` — one-line summary used as the entry title when `title` is omitted.
- `title` — optional design log entry title. Default: `summary` or `"WorldGen design rationale"`.
- `tags` — array or comma/newline-separated string; normalized to lowercase kebab-case.
- `references` — object with optional `plan` / `evaluate` / `export` / `world` entries. Each value may be a short pointer string or a compact worldgen output object.
- `max_chars` — maximum memory entry length (default: `4000`).

Each artifact reference is **excerpted, not embedded**:

- Strings are trimmed and capped (~480 chars).
- Objects are reduced to a short summary (`description` / `summary` / `name` / `path`, plus `regions: N` / `entities: N` counts). Whole scene JSON is never written to memory.
- Unknown object shapes fall back to a tiny JSON fingerprint (≤200 chars).

Missing references are recorded in a fallback note rather than failing:

```text
[no worldgen artifacts referenced for: evaluate, export]
```

The tool details echo `referencesUsed`, `fallbacks`, and `truncated` so callers can verify what was actually persisted.

## Command: `/localgpt:remember-worldgen`

Quick shortcut that prompts for the rationale and saves with no references (use the tool form to attach worldgen artifacts):

```text
/localgpt:remember-worldgen Harbor chokepoint — lighthouse approach must be the only safe path.
```

## Recommended pattern after a worldgen iteration

1. Plan → blockout → populate → evaluate → export the world (any subset is fine).
2. Capture the design intent **while context is fresh**:

```json
{
  "rationale": "Harbor needs a defensible chokepoint at the lighthouse approach; warehouse_row is intentionally low cover.",
  "summary": "Harbor chokepoint rationale",
  "tags": ["world-building", "harbor"],
  "references": {
    "plan": { "description": "harbor layout", "regions": ["dock", "warehouse_row", "lighthouse"] },
    "evaluate": "score 7/10 — sightlines from lighthouse good, dock too open",
    "export": { "path": "4_Project/MyGame/screenshots/harbor.png" },
    "world": "harbor-v1"
  }
}
```

3. Recall it later with `localgpt_design_log_search` (e.g. `harbor chokepoint`).

## Why not just `memory_save`?

- `memory_save` accepts arbitrary markdown and will happily store a full scene JSON blob, which bloats the design log and hurts recall ranking.
- `localgpt_remember_worldgen` enforces a compact shape and a stable `worldgen:<kind>` marker per reference, so future searches surface the rationale + artifact pointers together.
- It adds a graceful missing-reference fallback, so a partial iteration (e.g. only `plan` available) still produces a useful, recallable entry.

## Limitations

- Shaping only — it does not fetch worldgen outputs itself; pass the results you already have from `gen_plan_layout` / `gen_evaluate_scene` / `gen_export_*` / `gen_save_world`.
- Excerpt keys are best-effort against the upstream worldgen output shape; unknown shapes degrade to a tiny fingerprint instead of failing.
- Requires `localgpt-gen` running interactively (Bevy window) for the 1-shot relay to work.
