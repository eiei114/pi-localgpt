import * as fs from "node:fs/promises";
import { designLogFilePath, relativeWorkspacePath, workspacePath } from "./localgpt-workspace.ts";

export interface DesignLogReadFs {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

export interface DesignLogRange {
  id: string;
  file: string;
  content: string;
  line_start: number;
  line_end: number;
}

export interface ReadDesignLogRangeOptions {
  workspace: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  fs?: DesignLogReadFs;
}

export function encodeDesignLogId(file: string, lineStart: number, lineEnd: number): string {
  return `${file}:${lineStart}-${lineEnd}`;
}

export function parseDesignLogId(id: string): { file: string; lineStart: number; lineEnd: number } {
  const match = id.match(/^(.+):(\d+)-(\d+)$/);
  if (!match) throw new Error(`Invalid design log id: ${id}`);
  return { file: match[1]!, lineStart: Number.parseInt(match[2]!, 10), lineEnd: Number.parseInt(match[3]!, 10) };
}

function splitLines(content: string): string[] {
  return content.length === 0 ? [] : content.split(/\r?\n/);
}

export async function readDesignLogRange(options: ReadDesignLogRangeOptions): Promise<DesignLogRange> {
  const readFs = options.fs ?? fs;
  const absolutePath = options.file ? workspacePath(options.workspace, options.file) : designLogFilePath(options.workspace);
  const relativeFile = relativeWorkspacePath(options.workspace, absolutePath);
  const content = await readFs.readFile(absolutePath, "utf8");
  const lines = splitLines(content);
  const startLine = options.startLine ?? 1;
  const endLine = options.endLine ?? Math.max(startLine, lines.length);

  if (!Number.isInteger(startLine) || startLine < 1) throw new Error(`Invalid startLine: ${startLine}`);
  if (!Number.isInteger(endLine) || endLine < startLine) throw new Error(`Invalid endLine: ${endLine}`);

  const selectedLines = lines.slice(startLine - 1, Math.min(endLine, lines.length));
  const actualEnd = selectedLines.length === 0 ? startLine : startLine + selectedLines.length - 1;
  return {
    id: encodeDesignLogId(relativeFile, startLine, actualEnd),
    file: relativeFile,
    content: selectedLines.join("\n"),
    line_start: startLine,
    line_end: actualEnd,
  };
}

export async function readDesignLogEntry(workspace: string, id: string, readFs?: DesignLogReadFs): Promise<DesignLogRange> {
  const parsed = parseDesignLogId(id);
  return readDesignLogRange({ workspace, file: parsed.file, startLine: parsed.lineStart, endLine: parsed.lineEnd, fs: readFs });
}
