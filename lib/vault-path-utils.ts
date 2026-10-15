import * as path from "node:path";

export const VAULT_PROJECTS_SEGMENT = "4_Project";

export interface VaultContext {
  vaultRoot: string;
  projectSlug: string;
}

export type VaultPathErrorFactory = (message: string) => Error;

function normalizeForCompare(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function assertInsideVault(
  vaultRoot: string,
  candidatePath: string,
  createError: VaultPathErrorFactory,
): string {
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

  throw createError(`Path escapes vault root: ${candidatePath}`);
}

export function sanitizeVaultPathSegment(
  raw: string,
  createError: VaultPathErrorFactory,
): string {
  const trimmed = raw.trim();
  if (!trimmed) throw createError("Path segment cannot be empty");

  const sanitized = trimmed
    .replace(/[<>:"|?*\u0000-\u001f]/g, "-")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw createError(`Invalid path segment after sanitization: ${raw}`);
  }

  return sanitized;
}

export function resolveProjectVaultDirectory(
  vaultRoot: string,
  projectSlug: string,
  subdir: string,
  createError: VaultPathErrorFactory,
): string {
  const normalizedProject = projectSlug
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((segment) => sanitizeVaultPathSegment(segment, createError))
    .join(path.sep);

  const normalizedSubdir = subdir
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((segment) => sanitizeVaultPathSegment(segment, createError))
    .join(path.sep);

  const projectRoot = assertInsideVault(
    vaultRoot,
    path.join(path.resolve(vaultRoot), VAULT_PROJECTS_SEGMENT, normalizedProject),
    createError,
  );

  return assertInsideVault(vaultRoot, path.join(projectRoot, normalizedSubdir), createError);
}

export function resolveVaultFilePath(
  vaultRoot: string,
  directory: string,
  filename: string,
  createError: VaultPathErrorFactory,
): { absolutePath: string; vaultRelativePath: string } {
  const absolutePath = assertInsideVault(
    vaultRoot,
    path.join(directory, filename),
    createError,
  );
  const vaultRelativePath = path
    .relative(path.resolve(vaultRoot), absolutePath)
    .split(path.sep)
    .join("/");

  return { absolutePath, vaultRelativePath };
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
