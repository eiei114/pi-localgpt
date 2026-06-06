import { readFile } from "node:fs/promises";
import { resolveWorkspaceRelativePath } from "./localgpt-workspace.ts";

export interface MemoryGetOptions {
  workspacePath: string;
  path: string;
  startLine?: number;
  endLine?: number;
  platform?: NodeJS.Platform;
  readText?: (path: string) => Promise<string>;
}

export interface MemoryGetResult {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
}

export async function readWorkspaceMemory(options: MemoryGetOptions): Promise<MemoryGetResult> {
  const platform = options.platform ?? process.platform;
  const readText = options.readText ?? ((path) => readFile(path, "utf8"));
  const absolutePath = resolveWorkspaceRelativePath(options.workspacePath, options.path, platform);
  const text = await readText(absolutePath);
  const lines = text.split(/\r?\n/);

  const startLine = Math.max(1, options.startLine ?? 1);
  const endLine = Math.min(lines.length, options.endLine ?? lines.length);

  if (startLine > endLine) {
    throw new Error(`Invalid line range: ${startLine}-${endLine}`);
  }

  const content = lines.slice(startLine - 1, endLine).join("\n");

  return {
    path: options.path.replace(/\\/g, "/"),
    startLine,
    endLine,
    content,
  };
}
