import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  formatMemoryGetResult,
  formatMemorySearchResults,
  LOCALGPT_DEFAULT_MAX_CHARS,
} from "./formatters.ts";
import { resolveLocalgptPaths } from "./localgpt-config.ts";
import { readWorkspaceMemory } from "./memory-read.ts";
import { searchWorkspaceMemory, type MemorySearchResult } from "./memory-search.ts";
import { appendMemoryLog, appendMemorySave } from "./memory-write.ts";
import { formatLocalgptStatus, inspectLocalgptStatus } from "./status.ts";

export interface LocalgptMemoryOptions {
  maxChars?: number;
  signal?: AbortSignal;
}

async function requireWorkspacePath(): Promise<string> {
  const summary = await inspectLocalgptStatus();
  if (!summary.workspaceExists) {
    throw new Error(formatLocalgptStatus(summary));
  }

  return summary.paths.workspacePath;
}

function actionableError(operation: string, error: unknown): Error {
  if (error instanceof Error) {
    if (error.message.includes("outside LocalGPT workspace")) {
      return new Error(`localgpt_memory_${operation}: ${error.message}`);
    }
    return new Error(`localgpt_memory_${operation}: ${error.message}`);
  }

  return new Error(`localgpt_memory_${operation}: ${String(error)}`);
}

export async function runMemorySearch(
  query: string,
  limit?: number,
  options: LocalgptMemoryOptions = {},
): Promise<{ text: string; results: MemorySearchResult[]; workspacePath: string }> {
  try {
    const paths = await resolveLocalgptPaths();
    const workspacePath = await requireWorkspacePath();
    const results = await searchWorkspaceMemory({
      workspacePath,
      query,
      limit,
    });

    return {
      text: formatMemorySearchResults(results, query, options.maxChars ?? LOCALGPT_DEFAULT_MAX_CHARS),
      results,
      workspacePath: paths.workspacePath,
    };
  } catch (error) {
    throw actionableError("search", error);
  }
}

export async function runMemoryGet(
  path: string,
  startLine?: number,
  endLine?: number,
  options: LocalgptMemoryOptions = {},
): Promise<{ text: string; path: string; startLine: number; endLine: number }> {
  try {
    const workspacePath = await requireWorkspacePath();
    const result = await readWorkspaceMemory({ workspacePath, path, startLine, endLine });

    return {
      text: formatMemoryGetResult(result.path, result.startLine, result.endLine, result.content, options.maxChars ?? LOCALGPT_DEFAULT_MAX_CHARS),
      path: result.path,
      startLine: result.startLine,
      endLine: result.endLine,
    };
  } catch (error) {
    throw actionableError("get", error);
  }
}

export async function runMemorySave(content: string): Promise<{ path: string }> {
  try {
    const workspacePath = await requireWorkspacePath();
    return await appendMemorySave({ workspacePath, content });
  } catch (error) {
    throw actionableError("save", error);
  }
}

export async function runMemoryLog(content: string): Promise<{ path: string; date: string }> {
  try {
    const workspacePath = await requireWorkspacePath();
    return await appendMemoryLog({ workspacePath, content });
  } catch (error) {
    throw actionableError("log", error);
  }
}

export async function promptForInput(
  ctx: ExtensionContext,
  title: string,
  placeholder: string,
  args: string,
): Promise<string | undefined> {
  const trimmedArgs = args.trim();
  if (trimmedArgs) return trimmedArgs;

  const entered = await ctx.ui.input(title, placeholder);
  const value = String(entered ?? "").trim();
  return value || undefined;
}
