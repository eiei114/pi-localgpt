import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";

export interface ConfigFs {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

export interface ResolveLocalGptConfigOptions {
  configPath?: string;
  workspace?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  fs?: ConfigFs;
}

export interface LocalGptConfig {
  configPath: string;
  configFound: boolean;
  workspace: string;
  workspaceSource: "option" | "env" | "config" | "default";
  designLog: { workspace: string };
}

export function expandPath(rawPath: string, env: NodeJS.ProcessEnv = process.env): string {
  let expanded = rawPath;

  if (expanded === "~" || expanded.startsWith("~/") || expanded.startsWith(`~${path.sep}`)) {
    expanded = path.join(os.homedir(), expanded.slice(2));
  }

  return expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => env[name] ?? "");
}

function profileSuffix(env: NodeJS.ProcessEnv): string {
  const profile = env.LOCALGPT_PROFILE?.trim();
  return profile ? `-${profile}` : "";
}

export function defaultConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const configHome = env.XDG_CONFIG_HOME ? expandPath(env.XDG_CONFIG_HOME, env) : path.join(os.homedir(), ".config");
  return path.join(configHome, `localgpt${profileSuffix(env)}`, "config.toml");
}

export function defaultWorkspacePath(env: NodeJS.ProcessEnv = process.env): string {
  const dataHome = env.XDG_DATA_HOME ? expandPath(env.XDG_DATA_HOME, env) : path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, `localgpt${profileSuffix(env)}`, "workspace");
}

function stripTomlComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inDouble) { escaped = true; continue; }
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "#" && !inSingle && !inDouble) return line.slice(0, i);
  }

  return line;
}

function unquoteTomlString(raw: string): string {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const body = value.slice(1, -1);
    if (value.startsWith("'")) return body;
    return body
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return value;
}

export function parseDesignLogWorkspaceFromToml(toml: string): string | undefined {
  let section = "";

  for (const originalLine of toml.split(/\r?\n/)) {
    const line = stripTomlComment(originalLine).trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[\s*([^\]]+)\s*\]$/);
    if (sectionMatch) {
      section = sectionMatch[1]!.trim();
      continue;
    }

    if (section !== "design-log" && section !== "design_log" && section !== "memory") continue;
    const assignment = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.+)$/);
    if (!assignment || assignment[1] !== "workspace") continue;
    const value = unquoteTomlString(assignment[2]!);
    return value || undefined;
  }

  return undefined;
}

function resolveMaybeRelative(rawPath: string, baseDir: string, env: NodeJS.ProcessEnv): string {
  const expanded = expandPath(rawPath, env);
  return path.resolve(path.isAbsolute(expanded) ? expanded : path.join(baseDir, expanded));
}

export async function resolveLocalGptConfig(options: ResolveLocalGptConfigOptions = {}): Promise<LocalGptConfig> {
  const env = options.env ?? process.env;
  const configFs = options.fs ?? fs;
  const cwd = options.cwd ?? process.cwd();
  const rawConfigPath = options.configPath ?? env.LOCALGPT_CONFIG ?? defaultConfigPath(env);
  const configPath = resolveMaybeRelative(rawConfigPath, cwd, env);

  let configFound = false;
  let configuredWorkspace: string | undefined;

  try {
    const toml = await configFs.readFile(configPath, "utf8");
    configFound = true;
    configuredWorkspace = parseDesignLogWorkspaceFromToml(toml);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }

  let rawWorkspace: string;
  let workspaceSource: LocalGptConfig["workspaceSource"];
  let workspaceBase = cwd;

  if (options.workspace) {
    rawWorkspace = options.workspace;
    workspaceSource = "option";
  } else if (env.LOCALGPT_WORKSPACE) {
    rawWorkspace = env.LOCALGPT_WORKSPACE;
    workspaceSource = "env";
  } else if (configuredWorkspace) {
    rawWorkspace = configuredWorkspace;
    workspaceSource = "config";
    workspaceBase = path.dirname(configPath);
  } else {
    rawWorkspace = defaultWorkspacePath(env);
    workspaceSource = "default";
  }

  const workspace = resolveMaybeRelative(rawWorkspace, workspaceBase, env);
  return { configPath, configFound, workspace, workspaceSource, designLog: { workspace } };
}
