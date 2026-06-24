import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolveLocalGptConfig, type LocalGptConfig } from "./localgpt-config.ts";
import { inspectWorkspaceFiles, type PathExistsFn, type WorkspaceFileStatus } from "./localgpt-workspace.ts";

export interface LocalGptStatusSummary {
  ok: boolean;
  searchMode: "keyword";
  configPath: string;
  configFound: boolean;
  workspace: string;
  workspaceSource: LocalGptConfig["workspaceSource"];
  workspaceExists: boolean;
  files: WorkspaceFileStatus;
  hints: string[];
}

export type WorkspaceExistsFn = (workspacePath: string) => Promise<boolean>;

async function defaultWorkspaceExists(workspacePath: string): Promise<boolean> {
  try {
    await access(workspacePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function buildHints(summary: Omit<LocalGptStatusSummary, "hints" | "ok">): string[] {
  const hints: string[] = [];

  if (!summary.workspaceExists) {
    hints.push("Create the workspace directory or run `localgpt config init` if you use upstream LocalGPT.");
    hints.push("Or create DESIGN-LOG.md manually under the resolved workspace path.");
  } else if (!summary.files.designLogExists && !summary.files.todayLogExists) {
    hints.push("Workspace exists but DESIGN-LOG.md and today's log are missing. Use localgpt_design_log_save or create DESIGN-LOG.md.");
  }

  if (!summary.configFound) {
    hints.push("No config.toml found; using default workspace path. Set LOCALGPT_WORKSPACE to override.");
  }

  hints.push("Search mode is keyword-only (no localgpt binary spawn). Semantic sqlite-vec ranking is not replicated.");

  return hints;
}

export async function inspectLocalGptStatus(options: {
  now?: Date;
  workspaceExists?: WorkspaceExistsFn;
  pathExists?: PathExistsFn;
  resolveConfig?: typeof resolveLocalGptConfig;
} = {}): Promise<LocalGptStatusSummary> {
  const config = await (options.resolveConfig ?? resolveLocalGptConfig)();
  const workspaceExists = await (options.workspaceExists ?? defaultWorkspaceExists)(config.workspace);
  const files = await inspectWorkspaceFiles(config.workspace, options.now ?? new Date(), options.pathExists);
  const base = {
    searchMode: "keyword" as const,
    configPath: config.configPath,
    configFound: config.configFound,
    workspace: config.workspace,
    workspaceSource: config.workspaceSource,
    workspaceExists,
    files,
  };
  const hints = buildHints(base);
  const ok = workspaceExists && (files.designLogExists || files.todayLogExists);

  return { ok, ...base, hints };
}

export function formatLocalGptStatus(summary: LocalGptStatusSummary): string {
  const lines = [
    summary.ok ? "pi-localgpt status: ready" : "pi-localgpt status: setup needed",
    `search_mode: ${summary.searchMode}`,
    `config: ${summary.configPath} (${summary.configFound ? "found" : "missing"})`,
    `workspace: ${summary.workspace} (${summary.workspaceExists ? "found" : "missing"})`,
    `DESIGN-LOG.md: ${summary.files.designLogExists ? "found" : "missing"}`,
    `today_log: ${summary.files.todayLog} (${summary.files.todayLogExists ? "found" : "missing"})`,
  ];

  if (summary.hints.length > 0) {
    lines.push("hints:");
    for (const hint of summary.hints) lines.push(`- ${hint}`);
  }

  return lines.join("\n");
}

export function statusNotificationLevel(summary: LocalGptStatusSummary): "info" | "warning" {
  return summary.ok ? "info" : "warning";
}
