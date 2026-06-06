import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolveLocalgptPaths, type LocalgptPaths } from "./localgpt-config.ts";
import { inspectWorkspaceFiles, type WorkspaceFileStatus } from "./localgpt-workspace.ts";

export interface LocalgptStatusSummary {
  ok: boolean;
  searchMode: "keyword";
  paths: LocalgptPaths;
  workspaceExists: boolean;
  files: WorkspaceFileStatus;
  hints: string[];
}

async function workspaceDirectoryExists(workspacePath: string): Promise<boolean> {
  try {
    await access(workspacePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function buildHints(summary: Omit<LocalgptStatusSummary, "hints" | "ok">): string[] {
  const hints: string[] = [];

  if (!summary.workspaceExists) {
    hints.push("Create the workspace directory or run `localgpt config init` if you use upstream LocalGPT.");
    hints.push("Or create MEMORY.md manually under the resolved workspace path.");
  } else if (!summary.files.memoryMdExists && !summary.files.todayLogExists) {
    hints.push("Workspace exists but MEMORY.md and today's log are missing. Use localgpt_memory_save or create MEMORY.md.");
  }

  if (!summary.paths.configExists) {
    hints.push("No config.toml found; using default workspace path. Set LOCALGPT_WORKSPACE to override.");
  }

  hints.push("Search mode is keyword-only (no localgpt binary spawn). Semantic sqlite-vec ranking is not replicated.");

  return hints;
}

export async function inspectLocalgptStatus(): Promise<LocalgptStatusSummary> {
  const paths = await resolveLocalgptPaths();
  const workspaceExists = await workspaceDirectoryExists(paths.workspacePath);
  const files = await inspectWorkspaceFiles(paths.workspacePath);
  const base = { searchMode: "keyword" as const, paths, workspaceExists, files };
  const hints = buildHints(base);
  const ok = workspaceExists && (files.memoryMdExists || files.todayLogExists);

  return { ok, ...base, hints };
}

export function formatLocalgptStatus(summary: LocalgptStatusSummary): string {
  const lines = [
    summary.ok ? "pi-localgpt status: ready" : "pi-localgpt status: setup needed",
    `search_mode: ${summary.searchMode}`,
    `config: ${summary.paths.configPath} (${summary.paths.configExists ? "found" : "missing"})`,
    `workspace: ${summary.paths.workspacePath} (${summary.workspaceExists ? "found" : "missing"})`,
    `MEMORY.md: ${summary.files.memoryMdExists ? "found" : "missing"}`,
    `today_log: ${summary.files.todayLog} (${summary.files.todayLogExists ? "found" : "missing"})`,
  ];

  if (summary.hints.length > 0) {
    lines.push("hints:");
    for (const hint of summary.hints) lines.push(`- ${hint}`);
  }

  return lines.join("\n");
}

export function statusNotificationLevel(summary: LocalgptStatusSummary): "info" | "warning" {
  return summary.ok ? "info" : "warning";
}

export async function notifyLocalgptStatus(ctx: ExtensionContext): Promise<LocalgptStatusSummary> {
  const summary = await inspectLocalgptStatus();
  ctx.ui.notify(formatLocalgptStatus(summary), statusNotificationLevel(summary));
  return summary;
}
