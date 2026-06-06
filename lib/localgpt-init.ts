import { appendFile, mkdir, stat } from "node:fs/promises";
import { posix, win32 } from "node:path";
import { resolveLocalgptPaths } from "./localgpt-config.ts";
import { formatLocalgptStatus, inspectLocalgptStatus } from "./status.ts";

function joinPath(platform: NodeJS.Platform, ...parts: string[]): string {
  return platform === "win32" ? win32.join(...parts) : posix.join(...parts);
}

export interface InitResult {
  workspacePath: string;
  memoryMdPath: string;
  memoryDir: string;
  createdDirs: string[];
  createdFiles: string[];
  skipped: string[];
}

export async function initLocalgptWorkspace(): Promise<InitResult> {
  const paths = await resolveLocalgptPaths();
  const platform = process.platform;
  const workspacePath = paths.workspacePath;
  const memoryMdPath = joinPath(platform, workspacePath, "MEMORY.md");
  const memoryDir = joinPath(platform, workspacePath, "memory");

  const createdDirs: string[] = [];
  const createdFiles: string[] = [];
  const skipped: string[] = [];

  // workspace dir
  let wsExisted = false;
  try {
    await stat(workspacePath);
    wsExisted = true;
    skipped.push(workspacePath);
  } catch {
    await mkdir(workspacePath, { recursive: true });
    createdDirs.push(workspacePath);
  }

  // memory/ subdir
  let memExisted = false;
  try {
    await stat(memoryDir);
    memExisted = true;
    skipped.push(memoryDir);
  } catch {
    await mkdir(memoryDir, { recursive: true });
    createdDirs.push(memoryDir);
  }

  // MEMORY.md (only if missing)
  try {
    await stat(memoryMdPath);
    skipped.push(memoryMdPath);
  } catch {
    await appendFile(memoryMdPath, "");
    createdFiles.push(memoryMdPath);
  }

  return { workspacePath, memoryMdPath, memoryDir, createdDirs, createdFiles, skipped };
}

export function formatInitResult(result: InitResult): string {
  const lines = ["LocalGPT workspace initialized:", ""];

  if (result.createdDirs.length > 0) {
    lines.push("created dirs:");
    for (const d of result.createdDirs) lines.push(`  ${d}`);
  }

  if (result.createdFiles.length > 0) {
    lines.push("created files:");
    for (const f of result.createdFiles) lines.push(`  ${f}`);
  }

  if (result.skipped.length > 0) {
    lines.push("already existed:");
    for (const s of result.skipped) lines.push(`  ${s}`);
  }

  lines.push("");
  lines.push(`workspace: ${result.workspacePath}`);

  return lines.join("\n");
}
