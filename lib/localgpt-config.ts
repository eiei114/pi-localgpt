import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";

export interface LocalgptPaths {
  configPath: string;
  workspacePath: string;
  configExists: boolean;
  workspaceFromConfig: boolean;
}

export interface LocalgptConfigOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (path: string) => Promise<boolean>;
  readText?: (path: string) => Promise<string>;
}

function joinPath(platform: NodeJS.Platform, ...parts: string[]): string {
  return platform === "win32" ? win32.join(...parts) : posix.join(...parts);
}

export function expandUserPath(
  input: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  let value = input.trim().replace(/^"|"$/g, "");
  const home = env.HOME ?? env.USERPROFILE ?? homedir();

  if (value === "~") return home;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    value = joinPath(platform, home, value.slice(2));
  }

  return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => env[name] ?? "");
}

export function getLocalgptConfigPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.LOCALGPT_CONFIG?.trim();
  if (override) return expandUserPath(override, platform, env);

  if (platform === "win32") {
    const appData = env.APPDATA ?? joinPath(platform, homedir(), "AppData", "Roaming");
    return joinPath(platform, appData, "localgpt", "config.toml");
  }

  const home = env.HOME ?? homedir();
  return joinPath(platform, home, ".config", "localgpt", "config.toml");
}

export function getDefaultWorkspacePath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.LOCALGPT_WORKSPACE?.trim();
  if (override) return expandUserPath(override, platform, env);

  if (platform === "win32") {
    const appData = env.APPDATA ?? joinPath(platform, homedir(), "AppData", "Roaming");
    return joinPath(platform, appData, "localgpt", "workspace");
  }

  const home = env.HOME ?? homedir();
  return joinPath(platform, home, ".local", "share", "localgpt", "workspace");
}

export function parseMemoryWorkspaceFromConfig(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  let inMemorySection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      inMemorySection = sectionMatch[1] === "memory";
      continue;
    }

    if (!inMemorySection) continue;

    const workspaceMatch = line.match(/^workspace\s*=\s*(.+)$/);
    if (workspaceMatch) return workspaceMatch[1].trim().replace(/^"|"$/g, "");
  }

  return undefined;
}

async function defaultExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveLocalgptPaths(options: LocalgptConfigOptions = {}): Promise<LocalgptPaths> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exists = options.exists ?? defaultExists;
  const readText = options.readText ?? ((path: string) => readFile(path, "utf8"));

  const configPath = getLocalgptConfigPath(platform, env);
  const configExists = await exists(configPath);

  let workspacePath = getDefaultWorkspacePath(platform, env);
  let workspaceFromConfig = false;

  if (configExists) {
    try {
      const configText = await readText(configPath);
      const configured = parseMemoryWorkspaceFromConfig(configText);
      if (configured) {
        workspacePath = expandUserPath(configured, platform, env);
        workspaceFromConfig = true;
      }
    } catch {
      // Fall back to default workspace when config cannot be read.
    }
  }

  return { configPath, workspacePath, configExists, workspaceFromConfig };
}
