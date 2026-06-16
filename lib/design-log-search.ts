import * as fs from "node:fs/promises";
import * as path from "node:path";
import { encodeDesignLogId } from "./design-log-read.ts";
import { relativeWorkspacePath, workspacePath } from "./localgpt-workspace.ts";

export interface DirentLike {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

export interface DesignLogSearchFs {
  readdir(dirPath: string, options: { withFileTypes: true }): Promise<DirentLike[]>;
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

export interface DesignLogSearchOptions {
  workspace: string;
  query: string;
  limit?: number;
  contextLines?: number;
  fs?: DesignLogSearchFs;
}

export interface DesignLogSearchResult {
  id: string;
  file: string;
  content: string;
  score: number;
  line_start: number;
  line_end: number;
  matches: string[];
}

function tokenize(query: string): string[] {
  const seen = new Set<string>();
  const tokens = query.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return tokens.filter((token) => {
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

async function listMarkdownFiles(searchFs: DesignLogSearchFs, workspace: string, dir: string): Promise<string[]> {
  const entries = await searchFs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = workspacePath(workspace, path.join(dir, entry.name));
    if (entry.isDirectory()) files.push(...await listMarkdownFiles(searchFs, workspace, fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(fullPath);
  }

  return files;
}

function countTokenMatches(line: string, tokens: string[]): { count: number; matched: string[] } {
  const lower = line.toLowerCase();
  const matched: string[] = [];
  let count = 0;

  for (const token of tokens) {
    let pos = lower.indexOf(token);
    if (pos >= 0) matched.push(token);
    while (pos >= 0) {
      count++;
      pos = lower.indexOf(token, pos + token.length);
    }
  }

  return { count, matched };
}

function splitLines(content: string): string[] {
  return content.length === 0 ? [] : content.split(/\r?\n/);
}

export async function searchDesignLog(options: DesignLogSearchOptions): Promise<DesignLogSearchResult[]> {
  const tokens = tokenize(options.query);
  if (tokens.length === 0) return [];

  const searchFs = options.fs ?? fs;
  const workspace = path.resolve(options.workspace);
  const limit = options.limit ?? 10;
  const contextLines = options.contextLines ?? 2;
  const files = await listMarkdownFiles(searchFs, workspace, workspace);
  const results: DesignLogSearchResult[] = [];

  for (const filePath of files) {
    const content = await searchFs.readFile(filePath, "utf8");
    const lines = splitLines(content);

    for (let i = 0; i < lines.length; i++) {
      const { count, matched } = countTokenMatches(lines[i]!, tokens);
      if (count === 0) continue;

      const startIndex = Math.max(0, i - contextLines);
      const endIndex = Math.min(lines.length - 1, i + contextLines);
      const lineStart = startIndex + 1;
      const lineEnd = endIndex + 1;
      const relativeFile = relativeWorkspacePath(workspace, filePath);
      const uniqueMatched = [...new Set(matched)];
      const coverage = uniqueMatched.length / tokens.length;

      results.push({
        id: encodeDesignLogId(relativeFile, lineStart, lineEnd),
        file: relativeFile,
        content: lines.slice(startIndex, endIndex + 1).join("\n"),
        score: count + coverage,
        line_start: lineStart,
        line_end: lineEnd,
        matches: uniqueMatched,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line_start - b.line_start);
  return results.slice(0, limit);
}
