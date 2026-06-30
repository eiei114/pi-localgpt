import { genCallTool, type GenCallOptions } from "./gen-mcp-client.ts";
import { formatGenStatus, inspectGenStatus, type GenStatusSummary } from "./gen-status.ts";
import { formatLocalGptStatus, inspectLocalGptStatus, type LocalGptStatusSummary } from "./localgpt-status.ts";

export const LOCALGPT_MEMORY_GET_DEFAULT_MAX_CHARS = 12_000;

export interface MemoryGetSlice {
  path: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface MemoryGetOutcome {
  ok: boolean;
  path: string;
  text: string;
  slice?: MemoryGetSlice;
  getMode?: "slice" | "unavailable";
  errorKind?: "invalid_path" | "empty_result" | "upstream" | "validation" | "unavailable";
  hints?: string[];
}

export interface RunMemoryGetOptions {
  startLine?: number;
  endLine?: number;
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

function normalizeLineNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return value as number;
}

function validateLineRange(startLine?: number, endLine?: number): string | undefined {
  if (startLine !== undefined && endLine !== undefined && endLine < startLine) {
    return `Invalid line range: ${startLine}-${endLine}`;
  }
  return undefined;
}

function normalizeSlice(raw: unknown, fallbackPath: string): MemoryGetSlice | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const path = typeof obj.path === "string"
    ? obj.path
    : typeof obj.file === "string"
      ? obj.file
      : fallbackPath;
  const content = typeof obj.content === "string"
    ? obj.content
    : typeof obj.text === "string"
      ? obj.text
      : undefined;

  if (content === undefined) return null;

  const startLine = typeof obj.startLine === "number"
    ? obj.startLine
    : typeof obj.start_line === "number"
      ? obj.start_line
      : typeof obj.line_start === "number"
        ? obj.line_start
        : 1;
  const inferredEndLine = startLine + content.split(/\r?\n/).length - 1;
  const endLine = typeof obj.endLine === "number"
    ? obj.endLine
    : typeof obj.end_line === "number"
      ? obj.end_line
      : typeof obj.line_end === "number"
        ? obj.line_end
        : inferredEndLine;

  return { path, content, startLine, endLine };
}

export function extractMemoryGetSlice(result: unknown, fallbackPath: string): MemoryGetSlice | null {
  const direct = normalizeSlice(result, fallbackPath);
  if (direct) return direct;

  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;

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

      const combined = texts.join("\n");
      const parseInput = combined.trim();
      if (!parseInput) return null;

      try {
        return extractMemoryGetSlice(JSON.parse(parseInput), fallbackPath);
      } catch {
        return { path: fallbackPath, content: combined, startLine: 1, endLine: combined.split(/\r?\n/).length };
      }
    }
  }

  if (typeof result === "string") {
    const parseInput = result.trim();
    if (!parseInput) return null;

    try {
      return extractMemoryGetSlice(JSON.parse(parseInput), fallbackPath);
    } catch {
      return { path: fallbackPath, content: result, startLine: 1, endLine: result.split(/\r?\n/).length };
    }
  }

  return null;
}

export function formatMemoryGetSlice(
  slice: MemoryGetSlice,
  maxChars = LOCALGPT_MEMORY_GET_DEFAULT_MAX_CHARS,
): string {
  const header = `${slice.path} (lines ${slice.startLine}-${slice.endLine})`;
  return truncateText(`${header}\n\n${slice.content}`, maxChars);
}

export function formatMemoryGetUnavailable(
  path: string,
  localStatus: LocalGptStatusSummary,
  genStatus: GenStatusSummary,
): string {
  return [
    "localgpt_memory_get: unavailable",
    `path: "${path}"`,
    "",
    formatLocalGptStatus(localStatus),
    "",
    formatGenStatus(genStatus),
  ].join("\n");
}

function buildUpstreamArgs(path: string, startLine?: number, endLine?: number): Record<string, unknown> {
  const args: Record<string, unknown> = { path };
  if (startLine !== undefined) {
    args.from = startLine;
    if (endLine !== undefined) {
      args.lines = endLine - startLine + 1;
    }
  } else if (endLine !== undefined) {
    args.from = 1;
    args.lines = endLine;
  }
  return args;
}

export async function runMemoryGet(
  path: string,
  options: RunMemoryGetOptions = {},
): Promise<MemoryGetOutcome> {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return {
      ok: false,
      path,
      text: "localgpt_memory_get: path is required.",
      getMode: "unavailable",
      hints: ["Provide a non-empty path from localgpt_memory_search results."],
    };
  }

  let startLine: number | undefined;
  let endLine: number | undefined;

  try {
    startLine = normalizeLineNumber(options.startLine, "startLine");
    endLine = normalizeLineNumber(options.endLine, "endLine");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      path: trimmedPath,
      text: `localgpt_memory_get: ${message}`,
      getMode: "unavailable",
      hints: [message],
    };
  }

  const rangeError = validateLineRange(startLine, endLine);
  if (rangeError) {
    return {
      ok: false,
      path: trimmedPath,
      text: `localgpt_memory_get: ${rangeError}`,
      getMode: "unavailable",
      hints: [rangeError],
    };
  }

  const maxChars = options.maxChars ?? LOCALGPT_MEMORY_GET_DEFAULT_MAX_CHARS;
  const inspectLocal = options.inspectLocal ?? inspectLocalGptStatus;
  const inspectGen = options.inspectGen ?? inspectGenStatus;
  const callTool = options.callTool ?? genCallTool;

  const localStatus = await inspectLocal();
  const genStatus = await inspectGen();

  if (!localStatus.ok || !genStatus.ok) {
    return {
      ok: false,
      path: trimmedPath,
      text: formatMemoryGetUnavailable(trimmedPath, localStatus, genStatus),
      getMode: "unavailable",
      hints: [...localStatus.hints, ...genStatus.hints],
    };
  }

  try {
    const raw = await callTool(
      "memory_get",
      buildUpstreamArgs(trimmedPath, startLine, endLine),
      { signal: options.signal },
    );
    const slice = extractMemoryGetSlice(raw, trimmedPath);

    if (!slice) {
      return {
        ok: false,
        path: trimmedPath,
        text: [
          "localgpt_memory_get: invalid path or empty result",
          `path: "${trimmedPath}"`,
          startLine !== undefined || endLine !== undefined
            ? `lines: ${startLine ?? "?"}-${endLine ?? "?"}`
            : "",
          "",
          "Check that the path came from localgpt_memory_search and stays inside the LocalGPT workspace.",
        ].filter(Boolean).join("\n"),
        getMode: "unavailable",
        errorKind: "empty_result",
        hints: ["Verify the path from search results and retry with matching line_start/line_end."],
      };
    }

    return {
      ok: true,
      path: slice.path,
      text: formatMemoryGetSlice(slice, maxChars),
      slice,
      getMode: "slice",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const invalidPath = /not found|no such file|invalid path|outside.*workspace|does not exist/i.test(message);

    return {
      ok: false,
      path: trimmedPath,
      text: [
        invalidPath
          ? "localgpt_memory_get: invalid path"
          : "localgpt_memory_get: upstream memory_get failed",
        `path: "${trimmedPath}"`,
        startLine !== undefined || endLine !== undefined
          ? `lines: ${startLine ?? "?"}-${endLine ?? "?"}`
          : "",
        "",
        formatGenStatus(genStatus),
        "",
        `error: ${message}`,
      ].filter(Boolean).join("\n"),
      getMode: "unavailable",
      errorKind: invalidPath ? "invalid_path" : "upstream",
      hints: [message],
    };
  }
}
