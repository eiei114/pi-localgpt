# Vault note → gen_plan_layout workflow

Turn Obsidian vault design memos into `gen_plan_layout` requests without hand-copying large markdown prompts.

## When to use this

| Situation | Tool |
|---|---|
| Short, clean layout brief already in chat | `localgpt_gen_plan` |
| Design memo in vault markdown with frontmatter, headings, wiki links, or blockquotes | `localgpt_gen_plan_from_note` |

`localgpt_gen_plan_from_note` is a thin workflow wrapper: it normalizes note text, adds a lightweight source reference, then calls the same upstream `gen_plan_layout` tool as `localgpt_gen_plan`.

## Supported note shapes

Works best with level-design memos that include:

- YAML frontmatter (`title`, tags, etc.) — stripped before planning
- Markdown headings — heading markers removed, text kept
- Obsidian wiki links (`[[Region/Keep|Keep]]`) — resolved to display text
- Blockquotes and HTML comments — flattened or removed

Avoid relying on this workflow for:

- Notes that are mostly embeds (`![[screenshot.png]]`) with no body text
- Tables or diagrams that only make sense visually — summarize the layout intent in prose first
- Extremely long research dumps — trim the note or pass a lower `max_chars`

## Tool: `localgpt_gen_plan_from_note`

Parameters:

- `note` — inline markdown text (mutually exclusive with `note_path`)
- `note_path` — path to a `.md` file relative to the Pi working directory
- `style` — optional style hint forwarded to `gen_plan_layout` (`medieval`, `sci-fi`, `nature`, `urban`, …)
- `max_chars` — max planning description length after cleanup (default: `8000`)

The shaped prompt always starts with a short trace header:

```text
[Source: 4_Project/MyGame/world-memo.md — World Memo]

Dockside warehouses with a lighthouse overlook.
```

Tool details echo `source`, `planningDescription`, truncation flags, and the upstream layout JSON for later debugging.

## Command: `/localgpt:plan-from-note`

File-path shortcut when you already know which vault note to plan from:

```text
/localgpt:plan-from-note 4_Project/MyGame/world-memo.md
```

The command reads the file, runs the same cleanup + `gen_plan_layout` path as the tool, and notifies with the layout result.

## Example flow

1. Write a design memo under your vault project, e.g. `4_Project/Roblox/LevelKit/harbor-blockout.md`.
2. Start `localgpt-gen` interactively and confirm relay with `localgpt_gen_status`.
3. Plan from the note:

```json
{
  "note_path": "4_Project/Roblox/LevelKit/harbor-blockout.md",
  "style": "coastal"
}
```

4. Continue the WorldGen pipeline with `localgpt_gen_blockout` using the returned layout JSON.

## Limitations

- Reads `note_path` from the local filesystem only — no vault search or note picker orchestration.
- Markdown cleanup is intentionally conservative; exotic syntax may survive unchanged.
- Oversized notes are truncated with a `[truncated for gen_plan_layout]` suffix rather than failing silently.
