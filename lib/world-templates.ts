/**
 * Shareable world skill templates.
 *
 * Provides a lightweight template metadata layer on top of the existing
 * `gen_save_world` / `gen_load_world` tools.  Templates are named reusable
 * world patterns that users can discover and invoke without memorizing opaque
 * saved-world identifiers.
 *
 * A template is just metadata (name, description, tags, suggested style, and a
 * reference to the underlying saved-world name).  The actual world data lives
 * wherever `gen_load_world` stores it — this module only resolves a template
 * id → saved-world name and passes it through.
 */

import { Type } from "typebox";
import { genCallTool, type GenCallOptions } from "./gen-mcp-client.ts";
import { genLoadWorld } from "./gen-tools.ts";

// ── Types ───────────────────────────────────────────────────────────

/** Metadata shape for a world template. */
export interface WorldTemplate {
  /** Machine-readable template id used for lookup. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** One-line description shown in list output. */
  description: string;
  /** Free-form tags for categorisation (e.g. ["medieval", "outdoor", "starter"]). */
  tags: string[];
  /** Suggested style hint passed to gen_plan_layout when building from this template. */
  style?: string;
  /**
   * The saved-world name that `gen_load_world` expects.
   * When omitted the template id itself is used as the saved-world name.
   */
  worldName?: string;
}

/** Registry that holds available templates. */
export interface WorldTemplateRegistry {
  templates: WorldTemplate[];
}

// ── Built-in starter templates ───────────────────────────────────────

export const BUILTIN_TEMPLATES: WorldTemplate[] = [
  {
    id: "fantasy-village",
    name: "Fantasy Village",
    description: "A small medieval fantasy village with houses, a market square, well, and surrounding forest edges.",
    tags: ["medieval", "outdoor", "starter", "village"],
    style: "medieval",
    worldName: "fantasy-village",
  },
  {
    id: "horror-house",
    name: "Horror House",
    description: "A dark interior of a Victorian haunted house with narrow corridors, creaky doors, and dim lighting.",
    tags: ["horror", "interior", "atmospheric"],
    style: "dark",
    worldName: "horror-house",
  },
  {
    id: "sci-fi-station",
    name: "Sci-Fi Station",
    description: "A modular space station corridor hub with metallic walls, control panels, and holographic displays.",
    tags: ["sci-fi", "interior", "space", "starter"],
    style: "sci-fi",
    worldName: "sci-fi-station",
  },
  {
    id: "nature-campsite",
    name: "Nature Campsite",
    description: "A peaceful outdoor campsite beside a lake with tents, a campfire, trees, and gentle terrain.",
    tags: ["nature", "outdoor", "relaxing"],
    style: "nature",
    worldName: "nature-campsite",
  },
  {
    id: "dungeon-crawler",
    name: "Dungeon Crawler",
    description: "A grid-based dungeon layout with stone corridors, rooms, torches, and a treasure chamber.",
    tags: ["dungeon", "medieval", "interior", "game"],
    style: "medieval",
    worldName: "dungeon-crawler",
  },
];

// ── Default registry ─────────────────────────────────────────────────

export const defaultRegistry: WorldTemplateRegistry = {
  templates: BUILTIN_TEMPLATES,
};

// ── Resolution ──────────────────────────────────────────────────────

/**
 * Find a template by id in the given registry.
 * Returns `undefined` when the template is not found.
 */
export function resolveTemplate(
  id: string,
  registry: WorldTemplateRegistry = defaultRegistry,
): WorldTemplate | undefined {
  const normalizedId = id.toLowerCase();
  return registry.templates.find((t) => t.id.toLowerCase() === normalizedId);
}

/**
 * List templates matching an optional tag filter.
 * When `tag` is omitted, returns all templates.
 */
export function listTemplates(
  options: { tag?: string; registry?: WorldTemplateRegistry },
): WorldTemplate[] {
  const reg = options.registry ?? defaultRegistry;
  const all = reg.templates;
  if (!options.tag) return all;
  const lower = options.tag.toLowerCase();
  return all.filter((t) => t.tags.some((tg) => tg.toLowerCase() === lower));
}

/**
 * Format a template as a short one-line summary for listing output.
 */
export function formatTemplateShort(t: WorldTemplate): string {
  return `• ${t.id}: ${t.name} — ${t.description}`;
}

// ── Schemas ─────────────────────────────────────────────────────────

export const loadTemplateSchema = Type.Object({
  id: Type.String({ description: "Template id to load (e.g. fantasy-village, horror-house, sci-fi-station)." }),
});

export const listTemplatesSchema = Type.Object({
  tag: Type.Optional(Type.String({ description: "Optional tag filter (e.g. medieval, outdoor, sci-fi)." })),
});

// ── Tool wrappers ───────────────────────────────────────────────────

/**
 * Load a world template by resolving its id to a saved-world name
 * and delegating to `gen_load_world`.
 *
 * When the template is not found, returns a helpful error listing
 * available template ids instead of calling gen_load_world.
 */
export async function genLoadTemplate(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const id = params.id as string;
  const template = resolveTemplate(id);

  if (!template) {
    const available = defaultRegistry.templates.map(formatTemplateShort).join("\n");
    return {
      content: [
        {
          type: "text" as const,
          text: `Template not found: "${id}"\n\nAvailable templates:\n${available}`,
        },
      ],
      isError: true,
      details: { error: "template_not_found", requestedId: id, availableIds: defaultRegistry.templates.map((t) => t.id) },
    };
  }

  const worldName = template.worldName ?? template.id;
  const loadParams = { name: worldName };
  const result = await genLoadWorld(loadParams, options);

  return {
    ...result,
    details: {
      template,
      worldName,
      loadResult: result.details ?? result,
    },
  };
}

/**
 * List available world templates, optionally filtered by tag.
 * Returns a human-readable listing — does not require localgpt-gen running.
 */
export async function genListTemplates(
  params: Record<string, unknown>,
  _options?: GenCallOptions,
) {
  const tag = typeof params.tag === "string" ? params.tag : undefined;
  const templates = listTemplates({ tag });

  if (templates.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: tag
            ? `No templates found for tag "${tag}".\n\nAvailable tags: ${[...new Set(defaultRegistry.templates.flatMap((t) => t.tags))].join(", ")}`
            : "No templates available.",
        },
      ],
      details: { tag, count: 0 },
    };
  }

  const lines = templates.map((t) => {
    const styleHint = t.style ? ` [style: ${t.style}]` : "";
    return `• ${t.id}${styleHint}: ${t.name}\n  ${t.description}\n  Tags: ${t.tags.join(", ")}`;
  });

  return {
    content: [
      {
        type: "text" as const,
        text: `World templates (${templates.length}):\n\n${lines.join("\n\n")}`,
      },
    ],
    details: { tag, count: templates.length, ids: templates.map((t) => t.id) },
  };
}
