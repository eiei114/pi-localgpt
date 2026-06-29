import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Type } from "typebox";
import { expandPath, resolveLocalGptConfig } from "./localgpt-config.ts";
import {
  VAULT_PROJECTS_SEGMENT,
  parseVaultContextFromWorkspace,
  type VaultContext,
} from "./vault-screenshot-export.ts";

/**
 * Vault prompt-pack export.
 *
 * Saves a reusable LocalGPT prompt-pack (description + style + tags) as a
 * deterministic markdown file under a chosen vault project folder, so the
 * same worldgen recipe can be repeated without manual copy/paste.
 *
 * Unlike screenshot export (which delegates the write to gen_export_screenshot),
 * prompt-pack export writes the file directly and enforces an explicit
 * overwrite rule: an existing file is refused unless `overwrite: true`.
 */

export const DEFAULT_PROMPT_PACKS_SUBDIR = "prompt-packs";
export const DEFAULT_PROMPT_PACK_EXT = ".md";
export const FALLBACK_PACK_NAME = "pack";

export interface PromptPackFs {
  mkdir(dirPath: string, options: { recursive: boolean }): Promise<unknown>;
  writeFile(filePath: string, data: string): Promise<unknown>;
  stat(filePath: string): Promise<{ isFile(): boolean }>;
}

export interface ResolvedVaultPromptPackPath {
  directory: string;
  absolutePath: string;
  vaultRelativePath: string;
  filename: string;
  context: VaultContext & {
    name?: string;
    session?: string;
  };
}

export interface ResolveVaultPromptPackPathOptions {
  vaultRoot: string;
  projectSlug: string;
  promptPacksSubdir?: string;
  filename?: string;
  name?: string;
  session?: string;
  now?: Date;
  ext?: string;
}

export interface VaultPromptPackPathErrorOptions {
  cause?: unknown;
}

export class VaultPromptPackPathError extends Error {
  constructor(message: string, options?: VaultPromptPackPathErrorOptions) {
    super(message, options);
    this.name = "VaultPromptPackPathError";
  }
}

function normalizeForCompare(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function sanitizePathSegment(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new VaultPromptPackPathError("Path segment cannot be empty");

  const sanitized = trimmed
    .replace(/[<>:"|?*\u0000-\u001f]/g, "-")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new VaultPromptPackPathError(`Invalid path segment after sanitization: ${raw}`);
  }

  return sanitized;
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

  throw new VaultPromptPackPathError(`Path escapes vault root: ${candidatePath}`);
}

export function resolveProjectPromptPacksDirectory(
  vaultRoot: string,
  projectSlug: string,
  promptPacksSubdir = DEFAULT_PROMPT_PACKS_SUBDIR,
): string {
  const normalizedProject = projectSlug
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join(path.sep);

  const normalizedSubdir = promptPacksSubdir
    .split(/[\\/]+/)
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

export function buildPromptPackFilename(options: {
  name?: string;
  session?: string;
  now?: Date;
  ext?: string;
} = {}): string {
  const now = options.now ?? new Date();
  const ext = options.ext ?? DEFAULT_PROMPT_PACK_EXT;
  const parts = [formatTimestamp(now)];

  const name = options.name?.trim();
  parts.push(name ? sanitizePathSegment(name) : FALLBACK_PACK_NAME);

  if (options.session?.trim()) parts.push(sanitizePathSegment(options.session));

  return `${parts.join("__")}${ext.startsWith(".") ? ext : `.${ext}`}`;
}

export function resolveVaultPromptPackPath(
  options: ResolveVaultPromptPackPathOptions,
): ResolvedVaultPromptPackPath {
  const directory = resolveProjectPromptPacksDirectory(
    options.vaultRoot,
    options.projectSlug,
    options.promptPacksSubdir,
  );

  const filename = options.filename
    ? (() => {
      const base = path.basename(options.filename);
      const ext = path.extname(base) || DEFAULT_PROMPT_PACK_EXT;
      const name = sanitizePathSegment(path.basename(base, ext));
      return `${name}${ext}`;
    })()
    : buildPromptPackFilename({
      name: options.name,
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
      name: options.name,
      session: options.session,
    },
  };
}

export async function ensurePromptPackDirectory(
  directory: string,
  mkdirFs: Pick<PromptPackFs, "mkdir"> = fs,
): Promise<void> {
  await mkdirFs.mkdir(directory, { recursive: true });
}

export interface NormalizeTagsOptions {
  maxTags?: number;
}

export function normalizePackTags(
  tags: string | string[] | undefined,
  options: NormalizeTagsOptions = {},
): string[] {
  const max = options.maxTags ?? 20;
  if (tags === undefined || tags === null) return [];

  const list = Array.isArray(tags)
    ? tags
    : String(tags)
      .split(/[,\n]/)
      .map((t) => t.trim());

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (!raw) continue;
    const kebab = sanitizePathSegment(raw).toLowerCase();
    if (!kebab || seen.has(kebab)) continue;
    seen.add(kebab);
    out.push(kebab);
    if (out.length >= max) break;
  }
  return out;
}

export interface ShapePromptPackContentInput {
  name?: string;
  description: string;
  style?: string;
  tags?: string | string[];
  notes?: string;
  session?: string;
  projectSlug?: string;
  now?: Date;
}

export function shapePromptPackContent(input: ShapePromptPackContentInput): string {
  const now = input.now ?? new Date();
  const name = input.name?.trim() || FALLBACK_PACK_NAME;
  const description = input.description.trim();
  const style = input.style?.trim();
  const tags = normalizePackTags(input.tags);
  const notes = input.notes?.trim();
  const session = input.session?.trim();
  const projectSlug = input.projectSlug?.trim();

  if (!description) {
    throw new VaultPromptPackPathError("prompt-pack description cannot be empty");
  }

  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: ${name}`);
  if (style) lines.push(`style: ${style}`);
  if (tags.length > 0) lines.push(`tags: [${tags.join(", ")}]`);
  lines.push(`exported_at: ${now.toISOString()}`);
  if (session) lines.push(`session: ${session}`);
  if (projectSlug) lines.push(`vault_project: ${projectSlug}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${name}`);
  lines.push("");
  lines.push("## Description");
  lines.push("");
  lines.push(description);

  if (style) {
    lines.push("");
    lines.push("## Style");
    lines.push("");
    lines.push(style);
  }

  if (tags.length > 0) {
    lines.push("");
    lines.push("## Tags");
    lines.push("");
    for (const tag of tags) lines.push(`- ${tag}`);
  }

  if (notes) {
    lines.push("");
    lines.push("## Notes");
    lines.push("");
    lines.push(notes);
  }

  lines.push("");
  return lines.join("\n");
}

export interface VaultPromptPackExportParams {
  name?: unknown;
  description?: unknown;
  style?: unknown;
  tags?: unknown;
  notes?: unknown;
  vault_project?: unknown;
  vault_root?: unknown;
  prompt_packs_dir?: unknown;
  session?: unknown;
  filename?: unknown;
  overwrite?: unknown;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function trimmedString(value: unknown): string | undefined {
  return nonEmptyString(value) ? value.trim() : undefined;
}

export function wantsVaultPromptPackExport(params: VaultPromptPackExportParams): boolean {
  return Boolean(
    nonEmptyString(params.description)
    || nonEmptyString(params.name)
    || nonEmptyString(params.vault_project)
    || nonEmptyString(params.vault_root)
    || nonEmptyString(params.session)
    || nonEmptyString(params.filename)
    || nonEmptyString(params.prompt_packs_dir),
  );
}

export interface PrepareVaultPromptPackExportOptions {
  params: VaultPromptPackExportParams;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  workspace?: string;
  now?: Date;
  resolveConfig?: typeof resolveLocalGptConfig;
  fs?: PromptPackFs;
}

export interface ResolvedVaultPromptPackExport {
  directory: string;
  absolutePath: string;
  vaultRelativePath: string;
  filename: string;
  content: string;
  wrote: boolean;
  overwritten: boolean;
  context: VaultContext & {
    name?: string;
    session?: string;
  };
}

export async function prepareVaultPromptPackExport(
  options: PrepareVaultPromptPackExportOptions,
): Promise<ResolvedVaultPromptPackExport | null> {
  if (!wantsVaultPromptPackExport(options.params)) return null;

  const description = trimmedString(options.params.description);
  if (!description) {
    throw new VaultPromptPackPathError(
      "prompt-pack description is required for vault export",
    );
  }

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
    throw new VaultPromptPackPathError(
      "vault_root is required when design-log workspace is not under 4_Project/<project>/.",
    );
  }
  if (!projectSlug) {
    throw new VaultPromptPackPathError(
      "vault_project is required when design-log workspace is not under 4_Project/<project>/.",
    );
  }

  const name = trimmedString(options.params.name);
  const session = trimmedString(options.params.session);
  const promptPacksFs = options.fs ?? fs;

  const resolved = resolveVaultPromptPackPath({
    vaultRoot,
    projectSlug,
    promptPacksSubdir: trimmedString(options.params.prompt_packs_dir),
    filename: trimmedString(options.params.filename),
    name,
    session,
    now: options.now,
  });

  const content = shapePromptPackContent({
    name,
    description,
    style: trimmedString(options.params.style),
    tags: options.params.tags as string | string[] | undefined,
    notes: trimmedString(options.params.notes),
    session,
    projectSlug,
    now: options.now,
  });

  await ensurePromptPackDirectory(resolved.directory, promptPacksFs);

  const overwrite = options.params.overwrite === true;
  let alreadyExists = false;
  try {
    const stat = await promptPacksFs.stat(resolved.absolutePath);
    alreadyExists = stat.isFile();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    alreadyExists = false;
  }

  if (alreadyExists && !overwrite) {
    throw new VaultPromptPackPathError(
      `prompt-pack already exists at ${resolved.vaultRelativePath}; pass overwrite=true to replace it.`,
    );
  }

  await promptPacksFs.writeFile(resolved.absolutePath, content);

  return {
    directory: resolved.directory,
    absolutePath: resolved.absolutePath,
    vaultRelativePath: resolved.vaultRelativePath,
    filename: resolved.filename,
    content,
    wrote: true,
    overwritten: alreadyExists,
    context: resolved.context,
  };
}

// ── Tool wrapper ────────────────────────────────────────────────────

export const exportPromptPackSchema = Type.Object({
  name: Type.Optional(Type.String({
    description: "Human-readable prompt-pack name. Embedded in the output filename and the markdown title. Default: 'pack'.",
  })),
  description: Type.String({
    description: "The reusable worldgen prompt / planning description. Required. Saved verbatim under the Description heading.",
  }),
  style: Type.Optional(Type.String({
    description: "Optional style hint (medieval, sci-fi, urban, etc.) saved under the Style heading.",
  })),
  tags: Type.Optional(Type.Union([
    Type.String({ description: "Comma- or newline-separated tags." }),
    Type.Array(Type.String()),
  ], { description: "Optional tags, normalized to lowercase kebab-case." })),
  notes: Type.Optional(Type.String({
    description: "Optional extra markdown saved under a Notes heading.",
  })),
  vault_project: Type.Optional(Type.String({
    description: "Vault project slug under 4_Project/, e.g. OSS/pi-localgpt. Default: inferred from [design-log].workspace when it lives under 4_Project/<project>/.",
  })),
  vault_root: Type.Optional(Type.String({
    description: "Obsidian vault root. Default: inferred from design-log workspace path before 4_Project/.",
  })),
  prompt_packs_dir: Type.Optional(Type.String({
    description: "Prompt-packs folder relative to the project root. Default: prompt-packs.",
  })),
  session: Type.Optional(Type.String({
    description: "Pi or LocalGPT session id embedded in the filename and frontmatter.",
  })),
  filename: Type.Optional(Type.String({
    description: "Output filename override (for example forest-lobby.md).",
  })),
  overwrite: Type.Optional(Type.Boolean({
    description: "Replace an existing prompt-pack at the resolved path. Default: false (refuse to overwrite).",
  })),
});

export interface ExportPromptPackToolOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  workspace?: string;
  now?: Date;
  resolveConfig?: typeof resolveLocalGptConfig;
  fs?: PromptPackFs;
}

export async function exportPromptPack(
  params: Record<string, unknown>,
  options?: ExportPromptPackToolOptions,
) {
  const resolved = await prepareVaultPromptPackExport({
    params: params as VaultPromptPackExportParams,
    env: options?.env,
    cwd: options?.cwd,
    workspace: options?.workspace,
    now: options?.now,
    resolveConfig: options?.resolveConfig,
    fs: options?.fs,
  });

  if (!resolved) {
    throw new VaultPromptPackPathError(
      "exportPromptPack requires a description (and vault_project/vault_root unless inferred from the design-log workspace).",
    );
  }

  const summary = resolved.overwritten
    ? `Replaced existing prompt-pack at vault path: ${resolved.vaultRelativePath}`
    : `Exported prompt-pack to vault path: ${resolved.vaultRelativePath}`;

  return {
    content: [{ type: "text" as const, text: summary }],
    details: {
      directory: resolved.directory,
      absolutePath: resolved.absolutePath,
      vaultRelativePath: resolved.vaultRelativePath,
      filename: resolved.filename,
      wrote: resolved.wrote,
      overwritten: resolved.overwritten,
      contentLength: resolved.content.length,
    },
  };
}
