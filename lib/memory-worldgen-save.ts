/**
 * Shape a compact memory entry that links design rationale with WorldGen
 * outputs (plan / evaluate / export / saved world).
 *
 * Design goals (DOT-361):
 * - Save a concise memory entry that references recent worldgen artifacts.
 * - Keep saved memory compact — never dump whole scene JSON blobs.
 * - Stay compatible with the existing `memory_save` tool and the 1-shot
 *   MCP bridge architecture. This module only shapes a markdown payload; the
 *   actual save is dispatched by the gen wrapper via `memory_save`.
 * - Provide graceful missing-reference fallback so a partial worldgen
 *   iteration still produces a useful, recallable memory entry.
 */

export const MEMORY_WORLDBUILD_DEFAULT_MAX_CHARS = 4_000;
export const MEMORY_WORLDBUILD_DEFAULT_EXCERPT_CHARS = 480;

export type WorldgenArtifactKind = "plan" | "evaluate" | "export" | "world";

export const WORLDBUILD_REFERENCE_KINDS: readonly WorldgenArtifactKind[] = [
  "plan",
  "evaluate",
  "export",
  "world",
] as const;

export class MemoryWorldgenSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryWorldgenSaveError";
  }
}

/** A single worldgen artifact reference. Strings are treated as inline notes/pointers. */
export type WorldgenArtifactInput = string | Record<string, unknown> | undefined | null;

export interface WorldgenReferencesInput {
  plan?: WorldgenArtifactInput;
  evaluate?: WorldgenArtifactInput;
  export?: WorldgenArtifactInput;
  world?: WorldgenArtifactInput;
}

export interface MemoryWorldgenSaveInput {
  rationale: unknown;
  references?: WorldgenReferencesInput;
  summary?: unknown;
  tags?: unknown;
  title?: unknown;
  max_chars?: unknown;
}

export interface PreparedMemoryWorldgenSave {
  /** Markdown body for the upstream `memory_save` `content` field. */
  content: string;
  /** Optional title for the design log entry. */
  title: string | undefined;
  /** Artifact kinds that produced a usable excerpt. */
  referencesUsed: WorldgenArtifactKind[];
  /** Artifact kinds that were absent or empty (missing-reference fallback). */
  fallbacks: WorldgenArtifactKind[];
  /** True when the rationale or an excerpt had to be truncated to fit `max_chars`. */
  truncated: boolean;
  maxChars: number;
}

const SUMMARY_KEYS = [
  "description",
  "summary",
  "note",
  "title",
  "name",
  "path",
  "filename",
  "file",
] as const;

const COUNT_KEYS = [
  "regions",
  "paths",
  "entities",
  "items",
  "objects",
  "children",
] as const;

const KIND_LABELS: Record<WorldgenArtifactKind, string> = {
  plan: "Plan",
  evaluate: "Evaluate",
  export: "Export",
  world: "World",
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asString(value: unknown): string | undefined {
  if (isNonEmptyString(value)) return value.trim();
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => entry !== undefined);
  }
  if (isNonEmptyString(value)) {
    return value
      .split(/[,\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function truncateExcerpt(text: string, maxChars: number): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return { text: trimmed, truncated: false };
  if (maxChars <= 1) return { text: "", truncated: true };
  const ellipsis = "…";
  const limit = maxChars - ellipsis.length;
  if (limit <= 0) return { text: trimmed.slice(0, maxChars), truncated: true };
  return { text: `${trimmed.slice(0, limit).trimEnd()}${ellipsis}`, truncated: true };
}

function buildStructuralFingerprint(record: Record<string, unknown>): string {
  // Emit only derived structural metadata (keys, value types, array/number
  // counts) — never raw artifact values — so unknown shapes cannot leak
  // scene/entity payloads into the saved memory entry.
  const entries = Object.keys(record)
    .sort()
    .map((key) => {
      const value = record[key];
      if (Array.isArray(value)) return `${key}[${value.length}]`;
      if (value === null) return `${key}=null`;
      if (typeof value === "object") return `${key}:object`;
      return `${key}:${typeof value}`;
    });
  return entries.length > 0 ? entries.join(", ") : "object";
}

/**
 * Reduce an arbitrary worldgen artifact (plan result, evaluate screenshot
 * payload, export path object, saved-world name) into a compact excerpt that
 * is safe to embed in a memory entry. Never returns the raw object verbatim.
 */
export function summarizeWorldgenArtifact(
  artifact: WorldgenArtifactInput,
  maxChars = MEMORY_WORLDBUILD_DEFAULT_EXCERPT_CHARS,
): string | undefined {
  if (artifact === undefined || artifact === null) return undefined;

  if (typeof artifact === "string") {
    const text = artifact.trim();
    if (!text) return undefined;
    return truncateExcerpt(text, maxChars).text;
  }

  if (typeof artifact === "object") {
    const record = artifact as Record<string, unknown>;

    const summaryParts: string[] = [];
    for (const key of SUMMARY_KEYS) {
      const value = asString(record[key]);
      if (value) summaryParts.push(value);
      if (summaryParts.length >= 2) break;
    }

    for (const key of COUNT_KEYS) {
      const value = record[key];
      if (Array.isArray(value)) {
        summaryParts.push(`${key}: ${value.length}`);
      } else if (typeof value === "number") {
        summaryParts.push(`${key}: ${value}`);
      }
    }

    if (summaryParts.length > 0) {
      return truncateExcerpt(summaryParts.join(" · "), maxChars).text;
    }

    // Unknown object shape: keep a tiny structural fingerprint (keys/types/counts
    // only) instead of the whole blob. Raw artifact values are never embedded.
    return truncateExcerpt(buildStructuralFingerprint(record), Math.min(maxChars, 200)).text;
  }

  return undefined;
}

export interface WorldgenReferenceSection {
  kind: WorldgenArtifactKind;
  excerpt: string;
}

/**
 * Build the artifact-reference markdown block. Returns the rendered lines and
 * the lists of used / fallback kinds so callers can assert the
 * missing-reference fallback contract.
 */
export function buildWorldgenReferenceSections(
  references: WorldgenReferencesInput | undefined,
  excerptChars: number,
): { sections: WorldgenReferenceSection[]; used: WorldgenArtifactKind[]; fallbacks: WorldgenArtifactKind[] } {
  const safeReferences = references ?? {};
  const sections: WorldgenReferenceSection[] = [];
  const used: WorldgenArtifactKind[] = [];
  const fallbacks: WorldgenArtifactKind[] = [];

  for (const kind of WORLDBUILD_REFERENCE_KINDS) {
    const excerpt = summarizeWorldgenArtifact(safeReferences[kind], excerptChars);
    if (excerpt) {
      sections.push({ kind, excerpt });
      used.push(kind);
    } else {
      fallbacks.push(kind);
    }
  }

  return { sections, used, fallbacks };
}

function clampMaxChars(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Preserve caller intent: clamp tiny positive caps up to the minimum
    // supported size instead of widening them to the default.
    return Math.max(256, Math.floor(value));
  }
  return MEMORY_WORLDBUILD_DEFAULT_MAX_CHARS;
}

/**
 * Compose the final markdown `content` payload from a rationale and the
 * rendered reference sections. Truncates the rationale first so artifact
 * references (the recallable pointers) are preserved preferentially.
 */
export function composeMemoryWorldgenContent(
  rationaleText: string,
  sections: WorldgenReferenceSection[],
  tags: string[],
  fallbacks: WorldgenArtifactKind[],
  maxChars: number,
): { content: string; truncated: boolean } {
  const tagLine = tags.length > 0 ? `\n\ntags: ${tags.join(", ")}` : "";
  const fallbackLine = fallbacks.length > 0
    ? `\n\n[no worldgen artifacts referenced for: ${fallbacks.join(", ")}]`
    : "";

  const referenceBlock = sections.length > 0
    ? sections.map((section) => `- worldgen:${section.kind} — ${KIND_LABELS[section.kind]}: ${section.excerpt}`).join("\n")
    : "";

  const referenceLine = referenceBlock ? `\n\n## WorldGen references\n\n${referenceBlock}` : "";

  // Reserve space for everything except the rationale, then truncate rationale.
  const overhead = (tagLine + fallbackLine + referenceLine).length;
  const rationaleBudget = Math.max(64, maxChars - overhead);
  const { text: rationaleBody, truncated: rationaleTruncated } = truncateExcerpt(
    rationaleText,
    rationaleBudget,
  );

  const content = `${rationaleBody}${referenceLine}${tagLine}${fallbackLine}`.trim();
  // If even after rationale truncation we are still over budget (defensive),
  // hard-cap the whole entry.
  if (content.length <= maxChars) {
    return { content, truncated: rationaleTruncated };
  }

  return {
    content: truncateExcerpt(content, maxChars).text,
    truncated: true,
  };
}

export function prepareMemoryWorldgenSave(
  input: MemoryWorldgenSaveInput,
): PreparedMemoryWorldgenSave {
  const rationale = asString(input.rationale);
  if (!rationale) {
    throw new MemoryWorldgenSaveError(
      "rationale is required — describe why the world was built this way, or use memory_save for generic notes.",
    );
  }

  const maxChars = clampMaxChars(input.max_chars);
  const excerptChars = Math.min(MEMORY_WORLDBUILD_DEFAULT_EXCERPT_CHARS, Math.floor(maxChars / 4));

  const { sections, used, fallbacks } = buildWorldgenReferenceSections(
    input.references,
    excerptChars,
  );

  const tags = asStringArray(input.tags).map((tag) => tag.replace(/\s+/g, "-").toLowerCase());

  const { content, truncated } = composeMemoryWorldgenContent(
    rationale,
    sections,
    tags,
    fallbacks,
    maxChars,
  );

  const summary = asString(input.summary);
  const explicitTitle = asString(input.title);
  const title = explicitTitle ?? summary ?? "WorldGen design rationale";

  return {
    content,
    title,
    referencesUsed: used,
    fallbacks,
    truncated,
    maxChars,
  };
}
