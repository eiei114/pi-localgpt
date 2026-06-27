import * as path from "node:path";
import * as fs from "node:fs/promises";
import { expandPath, resolveLocalGptConfig } from "./localgpt-config.ts";

export const VAULT_PROJECTS_SEGMENT = "4_Project";
export const DEFAULT_SCREENSHOTS_SUBDIR = "screenshots";
export const DEFAULT_SCREENSHOT_EXT = ".png";

export interface VaultContext {
  vaultRoot: string;
  projectSlug: string;
}

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

function normalizeForCompare(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function sanitizePathSegment(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new VaultScreenshotPathError("Path segment cannot be empty");

  const sanitized = trimmed
    .replace(/[<>:"|?*\u0000-\u001f]/g, "-")
    .replace(/[\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new VaultScreenshotPathError(`Invalid path segment after sanitization: ${raw}`);
  }

  return sanitized;
}

export function parseVaultContextFromWorkspace(workspace: string): VaultContext | null {
  const resolved = path.resolve(workspace);
  const segments = resolved.split(path.sep);
  const projectIndex = segments.lastIndexOf(VAULT_PROJECTS_SEGMENT);
  if (projectIndex === -1 || projectIndex >= segments.length - 1) return null;

  const vaultRoot = path.resolve(segments.slice(0, projectIndex).join(path.sep) || ".");
  const projectSlug = segments.slice(projectIndex + 1).filter(Boolean).join("/");
  if (!projectSlug) return null;

  return { vaultRoot, projectSlug };
}

function assertInsideVault(vaultRoot: string, candidatePath: string): string {
  const resolvedVault = path.resolve(vaultRoot);
  const resolvedCandidate = path.resolve(candidatePath);
  const comparableVault = normalizeForCompare(resolvedVault);
  const comparableCandidate = normalizeForCompare(resolvedCandidate);

  if (
    comparableCandidate === comparableVault
    || comparableCandidate.startsWith(`${comparableVault}${path.sep}`)
  ) {
    return resolvedCandidate;
  }

  throw new VaultScreenshotPathError(`Path escapes vault root: ${candidatePath}`);
}

export function resolveProjectScreenshotsDirectory(
  vaultRoot: string,
  projectSlug: string,
  screenshotsSubdir = DEFAULT_SCREENSHOTS_SUBDIR,
): string {
  const normalizedProject = projectSlug
    .split(/[\/]+/)
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join(path.sep);

  const normalizedSubdir = screenshotsSubdir
    .split(/[\/]+/)
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join(path.sep);

  const projectRoot = assertInsideVault(
    vaultRoot,
    path.join(path.resolve(vaultRoot), VAULT_PROJECTS_SEGMENT, normalizedProject),
  );

  return assertInsideVault(vaultRoot, path.join(projectRoot, normalizedSubdir));
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

  const absolutePath = assertInsideVault(options.vaultRoot, path.join(directory, filename));
  const vaultRelativePath = path
    .relative(path.resolve(options.vaultRoot), absolutePath)
    .split(path.sep)
    .join("/");

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
  path?: string;
  vault_project?: string;
  vault_root?: string;
  screenshots_dir?: string;
  world?: string;
  session?: string;
  filename?: string;
}

export function wantsVaultScreenshotExport(params: VaultScreenshotExportParams): boolean {
  if (params.path?.trim()) return false;
  return Boolean(
    params.vault_project?.trim()
    || params.vault_root?.trim()
    || params.world?.trim()
    || params.session?.trim()
    || params.filename?.trim()
    || params.screenshots_dir?.trim(),
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

  const resolveConfig = options.resolveConfig ?? resolveLocalGptConfig;
  const config = await resolveConfig({
    env: options.env,
    cwd: options.cwd,
    workspace: options.workspace,
  });

  const inferred = parseVaultContextFromWorkspace(config.workspace);
  const vaultRoot = options.params.vault_root?.trim()
    ? path.resolve(expandPath(options.params.vault_root.trim(), options.env))
    : inferred?.vaultRoot;
  const projectSlug = options.params.vault_project?.trim() || inferred?.projectSlug;

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
    screenshotsSubdir: options.params.screenshots_dir,
    filename: options.params.filename,
    world: options.params.world,
    session: options.params.session,
    now: options.now,
  });

  await ensureScreenshotDirectory(resolved.directory, options.mkdirFs);
  return resolved;
}
