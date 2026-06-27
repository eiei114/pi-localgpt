import { genCallTool, type GenCallOptions } from "./gen-mcp-client.ts";
import { formatGenStatus, inspectGenStatus, type GenStatusSummary } from "./gen-status.ts";
import { formatLocalGptStatus, inspectLocalGptStatus, type LocalGptStatusSummary } from "./localgpt-status.ts";

export const LOCALGPT_MEMORY_SEARCH_DEFAULT_MAX_CHARS = 12_000;
export const LOCALGPT_MEMORY_SEARCH_DEFAULT_LIMIT = 10;

export interface MemorySearchHit {
  id?: string;
  file?: string;
  content?: string;
  score?: number;
  line_start?: number;
  line_end?: number;
  matches?: string[];
}

export interface MemorySearchOutcome {
  ok: boolean;
  query: string;
  text: string;
  hits: MemorySearchHit[];
  searchMode?: "hybrid" | "unavailable";
  hints?: string[];
}

export interface RunMemorySearchOptions {
  limit?: number;
  maxChars?: number;
  signal?: AbortSignal;
  inspectLocal?: typeof inspectLocalGptStatus;
  inspectGen?: typeof inspectGenStatus;
  callTool?: (toolName: string, args: Record<string, unknown>, options?: GenCallOptions) => Promise<unknown>;
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]`;
}

function normalizeHit(raw: unknown): MemorySearchHit | null {
  if (!raw || typeof raw !== "object") return null;

  const hit = raw as Record<string, unknown>;
  const file = typeof hit.file === "string"
    ? hit.file
    : typeof hit.path === "string"
      ? hit.path
      : undefined;
  const content = typeof hit.content === "string"
    ? hit.content
    : typeof hit.snippet === "string"
      ? hit.snippet
      : undefined;

  return {
    id: typeof hit.id === "string" ? hit.id : undefined,
    file,
    content,
    score: typeof hit.score === "number" ? hit.score : undefined,
    line_start: typeof hit.line_start === "number"
      ? hit.line_start
      : typeof hit.lineStart === "number"
        ? hit.lineStart
        : undefined,
    line_end: typeof hit.line_end === "number"
      ? hit.line_end
      : typeof hit.lineEnd === "number"
        ? hit.lineEnd
        : undefined,
    matches: Array.isArray(hit.matches)
      ? hit.matches.filter((match): match is string => typeof match === "string")
      : undefined,
  };
}

export function extractMemorySearchHits(result: unknown): MemorySearchHit[] {
  if (Array.isArray(result)) {
    return result.map(normalizeHit).filter((hit): hit is MemorySearchHit => hit !== null);
  }

  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;

    if (Array.isArray(obj.results)) {
      return obj.results.map(normalizeHit).filter((hit): hit is MemorySearchHit => hit !== null);
    }

    if (Array.isArray(obj.content)) {
      const texts = obj.content
        .map((entry) => {
          if (!entry || typeof entry !== "object") return undefined;
          const contentEntry = entry as { type?: string; text?: string };
          return contentEntry.type === "text" && typeof contentEntry.text === "string"
            ? contentEntry.text
            : undefined;
        })
        .filter((text): text is string => typeof text === "string");

      const combined = texts.join("\n").trim();
      if (!combined) return [];

      try {
        return extractMemorySearchHits(JSON.parse(combined));
      } catch {
        return [{ content: combined }];
      }
    }
  }

  if (typeof result === "string") {
    const trimmed = result.trim();
    if (!trimmed) return [];

    try {
      return extractMemorySearchHits(JSON.parse(trimmed));
    } catch {
      return [{ content: trimmed }];
    }
  }

  return [];
}

function formatHitHeader(hit: MemorySearchHit): string {
  const parts: string[] = [];

  if (hit.id) parts.push(`id=${hit.id}`);
  if (hit.file) parts.push(hit.file);
  if (hit.line_start !== undefined && hit.line_end !== undefined) {
    parts.push(`lines ${hit.line_start}-${hit.line_end}`);
  }
  if (hit.score !== undefined) parts.push(`score=${hit.score}`);

  return parts.length > 0 ? parts.join(" · ") : "hit";
}

export function formatMemorySearchHits(
  hits: MemorySearchHit[],
  query: string,
  maxChars = LOCALGPT_MEMORY_SEARCH_DEFAULT_MAX_CHARS,
): string {
  if (hits.length === 0) {
    return `No memory hits for "${query}" in LocalGPT workspace.`;
  }

  const lines = [`LocalGPT memory search (hybrid) for "${query}":`, ""];

  for (const hit of hits) {
    lines.push(`## ${formatHitHeader(hit)}`);
    if (hit.content) lines.push(hit.content);
    if (hit.matches && hit.matches.length > 0) {
      lines.push(`matches: ${hit.matches.join(", ")}`);
    }
    lines.push("");
  }

  return truncateText(lines.join("\n").trim(), maxChars);
}

export function formatMemorySearchUnavailable(
  query: string,
  localStatus: LocalGptStatusSummary,
  genStatus: GenStatusSummary,
): string {
  return [
    "localgpt_memory_search: unavailable",
    `query: "${query}"`,
    "",
    formatLocalGptStatus(localStatus),
    "",
    formatGenStatus(genStatus),
  ].join("\n");
}

export async function runMemorySearch(
  query: string,
  options: RunMemorySearchOptions = {},
): Promise<MemorySearchOutcome> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      ok: false,
      query,
      text: "localgpt_memory_search: query is required.",
      hits: [],
      searchMode: "unavailable",
      hints: ["Provide a non-empty query string."],
    };
  }

  const limit = options.limit ?? LOCALGPT_MEMORY_SEARCH_DEFAULT_LIMIT;
  const maxChars = options.maxChars ?? LOCALGPT_MEMORY_SEARCH_DEFAULT_MAX_CHARS;
  const inspectLocal = options.inspectLocal ?? inspectLocalGptStatus;
  const inspectGen = options.inspectGen ?? inspectGenStatus;
  const callTool = options.callTool ?? genCallTool;

  const localStatus = await inspectLocal();
  const genStatus = await inspectGen();

  if (!localStatus.ok || !genStatus.ok) {
    return {
      ok: false,
      query: trimmedQuery,
      text: formatMemorySearchUnavailable(trimmedQuery, localStatus, genStatus),
      hits: [],
      searchMode: "unavailable",
      hints: [...localStatus.hints, ...genStatus.hints],
    };
  }

  try {
    const raw = await callTool("memory_search", { query: trimmedQuery, limit }, { signal: options.signal });
    const hits = extractMemorySearchHits(raw);
    return {
      ok: true,
      query: trimmedQuery,
      text: formatMemorySearchHits(hits, trimmedQuery, maxChars),
      hits,
      searchMode: "hybrid",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      query: trimmedQuery,
      text: [
        "localgpt_memory_search: upstream memory_search failed",
        `query: "${trimmedQuery}"`,
        "",
        formatGenStatus(genStatus),
        "",
        `error: ${message}`,
      ].join("\n"),
      hits: [],
      searchMode: "unavailable",
      hints: [message],
    };
  }
}
