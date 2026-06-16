import * as fs from "node:fs/promises";
import * as path from "node:path";
import { dailyLogPath, memoryFilePath, relativeWorkspacePath } from "./localgpt-workspace.ts";
import { encodeMemoryId } from "./memory-read.ts";

export interface MemoryWriteFs {
  mkdir(dirPath: string, options: { recursive: true }): Promise<unknown>;
  appendFile(filePath: string, data: string, encoding: BufferEncoding): Promise<void>;
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

export interface MemoryWriteResult {
  id: string;
  file: string;
  line_start: number;
  line_end: number;
  appended: string;
}

export interface SaveMemoryOptions {
  workspace: string;
  content: string;
  title?: string;
  now?: Date;
  fs?: MemoryWriteFs;
}

export interface LogMemoryOptions {
  workspace: string;
  content: string;
  now?: Date;
  fs?: MemoryWriteFs;
}

async function readExisting(writeFs: MemoryWriteFs, filePath: string): Promise<string> {
  try {
    return await writeFs.readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return "";
    throw error;
  }
}

function entryTitle(title: string | undefined, now: Date): string {
  const cleanTitle = title?.trim();
  return cleanTitle ? `## ${cleanTitle}` : `## Memory - ${now.toISOString()}`;
}

async function appendWorkspaceMarkdown(writeFs: MemoryWriteFs, workspace: string, filePath: string, markdown: string): Promise<MemoryWriteResult> {
  await writeFs.mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readExisting(writeFs, filePath);
  const prefix = existing.length === 0 ? "" : "\n\n";
  const body = markdown.trim();
  const appended = `${prefix}${body}\n`;
  const lineStart = existing.length === 0 ? 1 : (existing + prefix).split(/\r?\n/).length;
  const lineEnd = lineStart + body.split(/\r?\n/).length - 1;
  await writeFs.appendFile(filePath, appended, "utf8");
  const relativeFile = relativeWorkspacePath(workspace, filePath);
  return { id: encodeMemoryId(relativeFile, lineStart, lineEnd), file: relativeFile, line_start: lineStart, line_end: lineEnd, appended };
}

export async function saveMemory(options: SaveMemoryOptions): Promise<MemoryWriteResult> {
  const writeFs = options.fs ?? fs;
  const now = options.now ?? new Date();
  const markdown = `${entryTitle(options.title, now)}\n\n${options.content.trim()}`;
  return appendWorkspaceMarkdown(writeFs, options.workspace, memoryFilePath(options.workspace), markdown);
}

export async function logMemory(options: LogMemoryOptions): Promise<MemoryWriteResult> {
  const writeFs = options.fs ?? fs;
  const now = options.now ?? new Date();
  const time = now.toISOString().slice(11, 19);
  const markdown = `## ${time}\n\n${options.content.trim()}`;
  return appendWorkspaceMarkdown(writeFs, options.workspace, dailyLogPath(options.workspace, now), markdown);
}
