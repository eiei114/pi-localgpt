import type { MemorySearchResult } from "./memory-search.ts";

export const LOCALGPT_DEFAULT_MAX_CHARS = 12_000;

function truncateText(value: string, maxChars = LOCALGPT_DEFAULT_MAX_CHARS): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]`;
}

export function formatMemorySearchResults(results: MemorySearchResult[], query: string, maxChars = LOCALGPT_DEFAULT_MAX_CHARS): string {
  if (results.length === 0) {
    return `No keyword matches for "${query}" in LocalGPT workspace memory.`;
  }

  const lines = [`LocalGPT memory search (keyword) for "${query}":`, ""];
  for (const result of results) {
    lines.push(`## ${result.path} (lines ${result.lineStart}-${result.lineEnd}, score=${result.score})`);
    lines.push(result.content);
    lines.push("");
  }

  return truncateText(lines.join("\n").trim(), maxChars);
}

export function formatMemoryGetResult(path: string, startLine: number, endLine: number, content: string, maxChars = LOCALGPT_DEFAULT_MAX_CHARS): string {
  const header = `${path} (lines ${startLine}-${endLine})`;
  return truncateText(`${header}\n\n${content}`, maxChars);
}
