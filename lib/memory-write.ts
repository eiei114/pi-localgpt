import { mkdir, appendFile } from "node:fs/promises";
import { dirname, posix, win32 } from "node:path";
import { formatTodayDate, getWorkspaceMemoryPaths } from "./localgpt-workspace.ts";

export interface MemoryWriteOptions {
  workspacePath: string;
  content: string;
  platform?: NodeJS.Platform;
  now?: Date;
  append?: (path: string, data: string) => Promise<void>;
  ensureDir?: (dir: string) => Promise<void>;
}

function joinPath(platform: NodeJS.Platform, ...parts: string[]): string {
  return platform === "win32" ? win32.join(...parts) : posix.join(...parts);
}

function formatTimestamp(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

async function defaultAppend(path: string, data: string): Promise<void> {
  await appendFile(path, data, "utf8");
}

async function defaultEnsureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

function normalizeAppendBlock(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Content must not be empty");
  return `\n\n${trimmed}\n`;
}

export async function appendMemorySave(options: MemoryWriteOptions): Promise<{ path: string }> {
  const platform = options.platform ?? process.platform;
  const append = options.append ?? defaultAppend;
  const ensureDir = options.ensureDir ?? defaultEnsureDir;
  const paths = getWorkspaceMemoryPaths(options.workspacePath, platform, options.now);

  await ensureDir(dirname(paths.memoryMd));
  await append(paths.memoryMd, normalizeAppendBlock(options.content));

  return { path: "MEMORY.md" };
}

export async function appendMemoryLog(options: MemoryWriteOptions): Promise<{ path: string; date: string }> {
  const platform = options.platform ?? process.platform;
  const now = options.now ?? new Date();
  const append = options.append ?? defaultAppend;
  const ensureDir = options.ensureDir ?? defaultEnsureDir;
  const paths = getWorkspaceMemoryPaths(options.workspacePath, platform, now);
  const date = formatTodayDate(now);
  const relativePath = joinPath(platform, "memory", `${date}.md`);

  await ensureDir(dirname(paths.todayLog));

  const header = `\n\n## ${formatTimestamp(now)}\n`;
  await append(paths.todayLog, `${header}${options.content.trim()}\n`);

  return { path: relativePath.replace(/\\/g, "/"), date };
}
