import * as path from "node:path";

export const MEMORY_FILE = "MEMORY.md";
export const HEARTBEAT_FILE = "HEARTBEAT.md";
export const SOUL_FILE = "SOUL.md";
export const LOCALGPT_FILE = "LocalGPT.md";
export const DAILY_LOG_DIR = "memory";

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

function normalizeForCompare(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function assertInsideWorkspace(workspace: string, candidatePath: string): string {
  const workspaceRoot = path.resolve(workspace);
  const resolvedCandidate = path.resolve(candidatePath);
  const comparableRoot = normalizeForCompare(workspaceRoot);
  const comparableCandidate = normalizeForCompare(resolvedCandidate);

  if (comparableCandidate === comparableRoot || comparableCandidate.startsWith(`${comparableRoot}${path.sep}`)) {
    return resolvedCandidate;
  }

  throw new WorkspacePathError(`Path escapes LocalGPT workspace: ${candidatePath}`);
}

export function workspacePath(workspace: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) return assertInsideWorkspace(workspace, relativePath);
  return assertInsideWorkspace(workspace, path.join(workspace, relativePath));
}

export function relativeWorkspacePath(workspace: string, candidatePath: string): string {
  const inside = assertInsideWorkspace(workspace, candidatePath);
  return path.relative(path.resolve(workspace), inside).split(path.sep).join("/");
}

function isoDateString(date: Date | string = new Date()): string {
  if (typeof date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Expected date as YYYY-MM-DD, got: ${date}`);
    return date;
  }
  return date.toISOString().slice(0, 10);
}

export function memoryFilePath(workspace: string): string {
  return workspacePath(workspace, MEMORY_FILE);
}

export function dailyLogPath(workspace: string, date: Date | string = new Date()): string {
  return workspacePath(workspace, path.join(DAILY_LOG_DIR, `${isoDateString(date)}.md`));
}

export function workspacePaths(workspace: string, date: Date | string = new Date()) {
  return {
    root: path.resolve(workspace),
    memory: memoryFilePath(workspace),
    heartbeat: workspacePath(workspace, HEARTBEAT_FILE),
    soul: workspacePath(workspace, SOUL_FILE),
    localgpt: workspacePath(workspace, LOCALGPT_FILE),
    dailyLogDir: workspacePath(workspace, DAILY_LOG_DIR),
    dailyLog: dailyLogPath(workspace, date),
  };
}
