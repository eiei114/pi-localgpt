import * as fs from "node:fs/promises";
import * as path from "node:path";
import { dailyLogPath, designLogFilePath, relativeWorkspacePath } from "./localgpt-workspace.ts";
import { encodeDesignLogId } from "./design-log-read.ts";

export interface DesignLogWriteFs {
  mkdir(dirPath: string, options: { recursive: true }): Promise<unknown>;
  appendFile(filePath: string, data: string, encoding: BufferEncoding): Promise<void>;
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

export interface DesignLogWriteResult {
  id: string;
  file: string;
  line_start: number;
  line_end: number;
  appended: string;
}

export interface SaveDesignLogOptions {
  workspace: string;
  content: string;
  title?: string;
  now?: Date;
  fs?: DesignLogWriteFs;
}

export interface LogDesignLogOptions {
  workspace: string;
  content: string;
  now?: Date;
  fs?: DesignLogWriteFs;
}

async function readExisting(writeFs: DesignLogWriteFs, filePath: string): Promise<string> {
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
  return cleanTitle ? `## ${cleanTitle}` : `## Design Log - ${now.toISOString()}`;
}

async function appendWorkspaceMarkdown(writeFs: DesignLogWriteFs, workspace: string, filePath: string, markdown: string): Promise<DesignLogWriteResult> {
  await writeFs.mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readExisting(writeFs, filePath);
  const prefix = existing.length === 0 ? "" : "\n\n";
  const body = markdown.trim();
  const appended = `${prefix}${body}\n`;
  const lineStart = existing.length === 0 ? 1 : (existing + prefix).split(/\r?\n/).length;
  const lineEnd = lineStart + body.split(/\r?\n/).length - 1;
  await writeFs.appendFile(filePath, appended, "utf8");
  const relativeFile = relativeWorkspacePath(workspace, filePath);
  return { id: encodeDesignLogId(relativeFile, lineStart, lineEnd), file: relativeFile, line_start: lineStart, line_end: lineEnd, appended };
}

export async function saveDesignLog(options: SaveDesignLogOptions): Promise<DesignLogWriteResult> {
  const writeFs = options.fs ?? fs;
  const now = options.now ?? new Date();
  const markdown = `${entryTitle(options.title, now)}\n\n${options.content.trim()}`;
  return appendWorkspaceMarkdown(writeFs, options.workspace, designLogFilePath(options.workspace), markdown);
}

export async function logDesignLog(options: LogDesignLogOptions): Promise<DesignLogWriteResult> {
  const writeFs = options.fs ?? fs;
  const now = options.now ?? new Date();
  const time = now.toISOString().slice(11, 19);
  const markdown = `## ${time}\n\n${options.content.trim()}`;
  return appendWorkspaceMarkdown(writeFs, options.workspace, dailyLogPath(options.workspace, now), markdown);
}
