import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { posix, relative, resolve, win32 } from "node:path";

export interface WorkspaceFileStatus {
  memoryMd: string;
  todayLog: string;
  memoryMdExists: boolean;
  todayLogExists: boolean;
}

function joinPath(platform: NodeJS.Platform, ...parts: string[]): string {
  return platform === "win32" ? win32.join(...parts) : posix.join(...parts);
}

export function formatTodayDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWorkspaceMemoryPaths(
  workspacePath: string,
  platform: NodeJS.Platform = process.platform,
  date = new Date(),
): WorkspaceFileStatus {
  const memoryMd = joinPath(platform, workspacePath, "MEMORY.md");
  const todayLog = joinPath(platform, workspacePath, "memory", `${formatTodayDate(date)}.md`);

  return {
    memoryMd,
    todayLog,
    memoryMdExists: false,
    todayLogExists: false,
  };
}

export async function inspectWorkspaceFiles(
  workspacePath: string,
  platform: NodeJS.Platform = process.platform,
  date = new Date(),
): Promise<WorkspaceFileStatus> {
  const paths = getWorkspaceMemoryPaths(workspacePath, platform, date);

  const memoryMdExists = await pathExists(paths.memoryMd);
  const todayLogExists = await pathExists(paths.todayLog);

  return { ...paths, memoryMdExists, todayLogExists };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveWorkspaceRelativePath(
  workspacePath: string,
  requestedPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const joiner = platform === "win32" ? win32 : posix;
  const normalizedWorkspace = resolve(workspacePath);
  const candidate = joiner.isAbsolute(requestedPath)
    ? resolve(requestedPath)
    : resolve(normalizedWorkspace, requestedPath);

  const rel = relative(normalizedWorkspace, candidate);
  if (rel.startsWith("..") || joiner.isAbsolute(rel)) {
    throw new Error(`Path is outside LocalGPT workspace: ${requestedPath}`);
  }

  return candidate;
}

export function isMarkdownMemoryFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md");
}
