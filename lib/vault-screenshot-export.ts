import * as path from "node:path";
import * as fs from "node:fs/promises";
import { expandPath, resolveLocalGptConfig } from "./localgpt-config.ts";
import {
  VAULT_PROJECTS_SEGMENT,
  parseVaultContextFromWorkspace,
  resolveProjectVaultDirectory,
  resolveVaultFilePath,
  sanitizeVaultPathSegment,
  type VaultContext,
} from "./vault-path-utils.ts";

export { VAULT_PROJECTS_SEGMENT, parseVaultContextFromWorkspace } from "./vault-path-utils.ts";
export type { VaultContext } from "./vault-path-utils.ts";

export const DEFAULT_SCREENSHOTS_SUBDIR = "screenshots";
export const DEFAULT_SCREENSHOT_EXT = ".png";

export interface ResolvedVaultScreenshotPath {
  directory: string;
  absolutePath: string;
  vaultRelativePath: string;
  filename: string;
  context: VaultContext & {
    world?: string;
    session?: string;
  };
}

export interface ResolveVaultScreenshotPathOptions {
  vaultRoot: string;
  projectSlug: string;
  screenshotsSubdir?: string;
  filename?: string;
  world?: string;
  session?: string;
  now?: Date;
  ext?: string;
}

export interface MkdirFs {
  mkdir(dirPath: string, options: { recursive: boolean }): Promise<unknown>;
}

export class VaultScreenshotPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultScreenshotPathError";
  }
}

export function sanitizePathSegment(raw: string): string {
  return sanitizeVaultPathSegment(raw, (message) => new VaultScreenshotPathError(message));
}

export function resolveProjectScreenshotsDirectory(
  vaultRoot: string,
  projectSlug: string,
  screenshotsSubdir = DEFAULT_SCREENSHOTS_SUBDIR,
): string {
  return resolveProjectVaultDirectory(
    vaultRoot,
    projectSlug,
    screenshotsSubdir,
    (message) => new VaultScreenshotPathError(message),
  );
}

function formatTimestamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function buildScreenshotFilename(options: {
  world?: string;
  session?: string;
  now?: Date;
  ext?: string;
} = {}): string {
  const now = options.now ?? new Date();
  const ext = options.ext ?? DEFAULT_SCREENSHOT_EXT;
  const parts = [formatTimestamp(now)];

  if (options.world?.trim()) parts.push(sanitizePathSegment(options.world));
  if (options.session?.trim()) parts.push(sanitizePathSegment(options.session));

  return `${parts.join("__")}${ext.startsWith(".") ? ext : `.${ext}`}`;
}

export function resolveVaultScreenshotPath(
  options: ResolveVaultScreenshotPathOptions,
): ResolvedVaultScreenshotPath {
  const directory = resolveProjectScreenshotsDirectory(
    options.vaultRoot,
    options.projectSlug,
    options.screenshotsSubdir,
  );

  const filename = options.filename
    ? (() => {
      const base = path.basename(options.filename);
      const ext = path.extname(base) || DEFAULT_SCREENSHOT_EXT;
      const name = sanitizePathSegment(path.basename(base, ext));
      return `${name}${ext}`;
    })()
    : buildScreenshotFilename({
      world: options.world,
      session: options.session,
      now: options.now,
      ext: options.ext,
    });

  const { absolutePath, vaultRelativePath } = resolveVaultFilePath(
    options.vaultRoot,
    directory,
    filename,
    (message) => new VaultScreenshotPathError(message),
  );

  return {
    directory,
    absolutePath,
    vaultRelativePath,
    filename,
    context: {
      vaultRoot: path.resolve(options.vaultRoot),
      projectSlug: options.projectSlug,
      world: options.world,
      session: options.session,
    },
  };
}

export async function ensureScreenshotDirectory(
  directory: string,
  mkdirFs: MkdirFs = fs,
): Promise<void> {
  await mkdirFs.mkdir(directory, { recursive: true });
}

export interface VaultScreenshotExportParams {
  path?: unknown;
  vault_project?: unknown;
  vault_root?: unknown;
  screenshots_dir?: unknown;
  world?: unknown;
  session?: unknown;
  filename?: unknown;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function trimmedString(value: unknown): string | undefined {
  return nonEmptyString(value) ? value.trim() : undefined;
}

export function wantsVaultScreenshotExport(params: VaultScreenshotExportParams): boolean {
  if (nonEmptyString(params.path)) return false;
  return Boolean(
    nonEmptyString(params.vault_project)
    || nonEmptyString(params.vault_root)
    || nonEmptyString(params.world)
    || nonEmptyString(params.session)
    || nonEmptyString(params.filename)
    || nonEmptyString(params.screenshots_dir),
  );
}

export interface PrepareVaultScreenshotExportOptions {
  params: VaultScreenshotExportParams;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  workspace?: string;
  now?: Date;
  resolveConfig?: typeof resolveLocalGptConfig;
  mkdirFs?: MkdirFs;
}

export async function prepareVaultScreenshotExport(
  options: PrepareVaultScreenshotExportOptions,
): Promise<ResolvedVaultScreenshotPath | null> {
  if (!wantsVaultScreenshotExport(options.params)) return null;

  const explicitVaultRoot = trimmedString(options.params.vault_root);
  const explicitProjectSlug = trimmedString(options.params.vault_project);
  let inferred: VaultContext | null = null;

  if (!explicitVaultRoot || !explicitProjectSlug) {
    const resolveConfig = options.resolveConfig ?? resolveLocalGptConfig;
    const config = await resolveConfig({
      env: options.env,
      cwd: options.cwd,
      workspace: options.workspace,
    });
    inferred = parseVaultContextFromWorkspace(config.workspace);
  }

  const vaultRoot = explicitVaultRoot
    ? path.resolve(expandPath(explicitVaultRoot, options.env))
    : inferred?.vaultRoot;
  const projectSlug = explicitProjectSlug || inferred?.projectSlug;

  if (!vaultRoot) {
    throw new VaultScreenshotPathError(
      "vault_root is required when design-log workspace is not under 4_Project/<project>/.",
    );
  }
  if (!projectSlug) {
    throw new VaultScreenshotPathError(
      "vault_project is required when design-log workspace is not under 4_Project/<project>/.",
    );
  }

  const resolved = resolveVaultScreenshotPath({
    vaultRoot,
    projectSlug,
    screenshotsSubdir: trimmedString(options.params.screenshots_dir),
    filename: trimmedString(options.params.filename),
    world: trimmedString(options.params.world),
    session: trimmedString(options.params.session),
    now: options.now,
  });

  await ensureScreenshotDirectory(resolved.directory, options.mkdirFs);
  return resolved;
}
