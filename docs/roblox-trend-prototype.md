# Roblox trend → LocalGPT prototype workflow

Turn compact Roblox market-research summaries into stable LocalGPT `gen_plan_layout` prompts so trend analysis can quickly become a rough 3D concept scene.

This workflow **complements** separate Roblox research (charts, playtests, vault notes). It does **not** replace those tools or call Roblox-specific APIs.

## When to use this

| Situation | Tool |
|---|---|
| Short layout brief already in chat | `localgpt_gen_plan` |
| Design memo in vault markdown | `localgpt_gen_plan_from_note` |
| Compact Roblox trend/research summary (genre, theme, mechanics, market signals) | `localgpt_gen_plan_from_roblox_trend` |

`localgpt_gen_plan_from_roblox_trend` shapes a bounded summary into a repeatable prompt structure, labels speculative ideas separately from research facts, then calls the same upstream `gen_plan_layout` tool as `localgpt_gen_plan`.

## Input shape

Provide a **short structured summary** — not a giant report. Required and optional fields:

| Field | Required | Role |
|---|---|---|
| `genre` | yes | Roblox genre/category signal from research |
| `theme` | one of theme / mechanics / market_signals | Visual or thematic cues |
| `mechanics` | one of theme / mechanics / market_signals | Observed gameplay patterns (string or array) |
| `market_signals` | one of theme / mechanics / market_signals | Factual chart/research notes (string or array) |
| `title` | no | Short label for traceability |
| `audience` | no | Audience or session-length signals |
| `speculative_ideas` | no | Optional prototype hypotheses — kept separate from facts |

Pass the object inline as `summary`, or store it as JSON and pass `summary_path`.

## What this workflow does not infer

- Roblox Lua scripting, DataStore, or Studio-ready assets
- Monetization, retention loops, UGC systems, or platform policy compliance
- Live chart scraping or external Roblox research — you supply the summary
- Playtest-validated design — speculative ideas are labeled and must be verified

## Tool: `localgpt_gen_plan_from_roblox_trend`

Parameters:

- `summary` — inline JSON object (mutually exclusive with `summary_path`)
- `summary_path` — path to a `.json` file relative to the Pi working directory
- `style` — optional style hint forwarded to `gen_plan_layout` (`urban`, `sci-fi`, `nature`, …)
- `max_chars` — max planning description length after shaping (default: `6000`)

The shaped prompt always uses the same section order:

1. `[Roblox trend → LocalGPT prototype | …]` header
2. `## Trend facts` — research-only signals
3. `## Speculative additions` — only when `speculative_ideas` are present
4. `## Layout brief for gen_plan_layout` — concise blockout paragraph
5. `## Guardrails` — static list of non-inferred concerns

Tool details echo `source`, `planningDescription`, `layoutBrief`, `facts`, `speculative`, `guardrails`, and the upstream layout JSON.

## Command: `/localgpt:plan-from-roblox-trend`

JSON file shortcut when the trend summary already lives in your vault or project tree:

```text
/localgpt:plan-from-roblox-trend 4_Project/Roblox/trends/neon-obby.json
```

## Example: trend summary → prototype prompt

**Input summary** (`4_Project/Roblox/trends/neon-obby.json`):

```json
{
  "title": "Neon Tower Obby Rush",
  "genre": "obby / parkour",
  "theme": "neon cyberpunk towers at night",
  "mechanics": ["timed jumps", "checkpoint pads", "speed boosts"],
  "audience": "young teens, short mobile-friendly sessions",
  "market_signals": [
    "Top charts favor vertical tower obbies with bright accent colors",
    "Session length under 8 minutes in featured examples"
  ],
  "speculative_ideas": ["optional lava reset zones on failed jumps"]
}
```

**Shaped planning description** (excerpt):

```text
[Roblox trend → LocalGPT prototype | Neon Tower Obby Rush]

## Trend facts (from research — not playtest-validated)
Genre: obby / parkour
Theme: neon cyberpunk towers at night
Mechanics: timed jumps, checkpoint pads, speed boosts
Audience: young teens, short mobile-friendly sessions
Market signals:
- Top charts favor vertical tower obbies with bright accent colors
- Session length under 8 minutes in featured examples

## Speculative additions (optional — verify before shipping)
- optional lava reset zones on failed jumps

## Layout brief for gen_plan_layout
Roblox-inspired obby / parkour concept scene. Visual theme: neon cyberpunk towers at night. ...
```

**Next steps** in Pi:

```json
{
  "summary_path": "4_Project/Roblox/trends/neon-obby.json",
  "style": "urban"
}
```

Then continue the WorldGen pipeline with `localgpt_gen_blockout` and `localgpt_gen_populate`.

## Limitations

- Reads `summary_path` from the local filesystem only — no vault search or Roblox API integration.
- Input must stay compact; oversized summaries are truncated with `[truncated for gen_plan_layout]` rather than failing silently.
- Output is a rough LocalGPT 3D concept blockout, not a Roblox experience blueprint.
