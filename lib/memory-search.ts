import { readdir, readFile } from "node:fs/promises";
import { posix, relative, win32 } from "node:path";
import { isMarkdownMemoryFile } from "./localgpt-workspace.ts";

export interface MemorySearchResult {
  path: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  score: number;
}

export interface MemorySearchOptions {
  workspacePath: string;
  query: string;
  limit?: number;
  platform?: NodeJS.Platform;
  listDir?: (dir: string) => Promise<string[]>;
  readText?: (path: string) => Promise<string>;
}

const DEFAULT_LIMIT = 10;

function joinPath(platform: NodeJS.Platform, ...parts: string[]): string {
  return platform === "win32" ? win32.join(...parts) : posix.join(...parts);
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreLine(line: string, tokens: string[]): number {
  const lower = line.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (lower.includes(token)) score += 1;
  }

  return score;
}

async function collectMarkdownFiles(
  workspacePath: string,
  platform: NodeJS.Platform,
  listDir: (dir: string) => Promise<string[]>,
): Promise<string[]> {
  const files: string[] = [];
  const memoryMd = joinPath(platform, workspacePath, "MEMORY.md");
  const heartbeatMd = joinPath(platform, workspacePath, "HEARTBEAT.md");
  const memoryDir = joinPath(platform, workspacePath, "memory");

  files.push(memoryMd, heartbeatMd);

  try {
    const entries = await listDir(memoryDir);
    for (const entry of entries) {
      const fullPath = joinPath(platform, memoryDir, entry);
      if (isMarkdownMemoryFile(fullPath)) files.push(fullPath);
    }
  } catch {
    // memory/ may not exist yet.
  }

  return files;
}

function makeSnippet(lines: string[], centerIndex: number, radius = 1): { lineStart: number; lineEnd: number; content: string } {
  const start = Math.max(0, centerIndex - radius);
  const end = Math.min(lines.length - 1, centerIndex + radius);

  return {
    lineStart: start + 1,
    lineEnd: end + 1,
    content: lines.slice(start, end + 1).join("\n").trim(),
  };
}

export async function searchWorkspaceMemory(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
  const platform = options.platform ?? process.platform;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const tokens = tokenizeQuery(options.query);
  const listDir = options.listDir ?? ((dir) => readdir(dir));
  const readText = options.readText ?? ((path) => readFile(path, "utf8"));

  if (tokens.length === 0) return [];

  const files = await collectMarkdownFiles(options.workspacePath, platform, listDir);
  const results: MemorySearchResult[] = [];

  for (const filePath of files) {
    let text: string;
    try {
      text = await readText(filePath);
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    const relativePath = relative(options.workspacePath, filePath).replace(/\\/g, "/");

    for (let index = 0; index < lines.length; index += 1) {
      const lineScore = scoreLine(lines[index] ?? "", tokens);
      if (lineScore === 0) continue;

      const snippet = makeSnippet(lines, index);
      results.push({
        path: relativePath,
        lineStart: snippet.lineStart,
        lineEnd: snippet.lineEnd,
        content: snippet.content,
        score: lineScore,
      });
    }
  }

  results.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  return results.slice(0, limit);
}
