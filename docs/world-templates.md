# World Templates

World templates are **named, reusable world patterns** built on top of the existing `gen_save_world` / `gen_load_world` tools. Templates provide lightweight metadata so you can discover and invoke common world starters by human-friendly id instead of memorizing opaque saved-world identifiers.

## How Templates Work

A **template** is just metadata — it does not duplicate any world data:

```text
Template id  ──resolve──▶  saved-world name  ──gen_load_world──▶  world data
```

The template registry maps ids (like `fantasy-village`) to saved-world names and carries human-readable description, tags, and a style hint. The actual world scene data is stored wherever `gen_save_world` / `gen_load_world` manage it.

## Tools

| Tool | Description |
|------|-------------|
| `localgpt_gen_list_templates` | List all available templates (metadata-only, no localgpt-gen needed) |
| `localgpt_gen_template` | Load a template by id (delegates to `gen_load_world` via 1-shot CLI) |

### `localgpt_gen_list_templates`

```json
{ "tag": "medieval" }          // optional filter
```

Returns template ids, names, descriptions, and tags.

### `localgpt_gen_template`

```json
{ "id": "fantasy-village" }
```

Resolves the template to its underlying saved-world name and calls `gen_load_world`. If the template id is not found, returns a helpful error listing all available templates.

## Built-in Templates

| Id | Name | Tags |
|----|------|------|
| `fantasy-village` | Fantasy Village | medieval, outdoor, starter, village |
| `horror-house` | Horror House | horror, interior, atmospheric |
| `sci-fi-station` | Sci-Fi Station | sci-fi, interior, space, starter |
| `nature-campsite` | Nature Campsite | nature, outdoor, relaxing |
| `dungeon-crawler` | Dungeon Crawler | dungeon, medieval, interior, game |

## End-to-End Example

1. **Discover templates:**

   ```text
   localgpt_gen_list_templates  →  shows all 5 templates with tags
   localgpt_gen_list_templates { "tag": "sci-fi" }  →  filters to sci-fi-station
   ```

2. **Load a template:**

   ```text
   localgpt_gen_template { "id": "fantasy-village" }
   ```

   This resolves `fantasy-village` → saved-world name `fantasy-village` and calls:

   ```text
   localgpt_gen_load { "name": "fantasy-village" }
   ```

3. **Build on top of it:**

   Once loaded, modify the scene with any gen tool — `localgpt_gen_modify`, `localgpt_gen_spawn`, `localgpt_gen_set_sky`, etc.

## Templates vs. Saved Worlds

| Aspect | Templates | Arbitrary Saved Worlds |
|--------|-----------|------------------------|
| Discovery | Listed by `localgpt_gen_list_templates` with metadata | Must remember the exact name |
| Metadata | id, name, description, tags, style hint | None |
| Invocation | `localgpt_gen_template` with readable id | `localgpt_gen_load` with raw name |
| Storage | Same as saved worlds (via `gen_save_world`) | Same |
| Extensibility | Add to the registry in `lib/world-templates.ts` | Create via `localgpt_gen_save` |

Templates are a **convenience layer** — they don't replace `gen_save_world` / `gen_load_world`. You can still save and load arbitrary worlds with those tools. Templates just make the most common patterns easy to find and use.

## Adding Custom Templates

To add a template to the built-in registry, edit `lib/world-templates.ts` and append to the `BUILTIN_TEMPLATES` array:

```ts
{
  id: "my-custom-template",
  name: "My Custom Template",
  description: "A brief description of the world pattern.",
  tags: ["custom", "my-tag"],
  style: "my-style-hint",
  worldName: "my-custom-world",  // the name gen_save_world used
},
```

The `worldName` field is optional — when omitted the template `id` is used as the saved-world name.
