import * as path from "node:path";

export const VAULT_NOTE_PLAN_DEFAULT_MAX_CHARS = 8_000;

export class VaultNotePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultNotePlanError";
  }
}

export interface VaultNoteSourceRef {
  path?: string;
  title?: string;
  reference: string;
}

export interface NormalizeVaultNoteResult {
  cleaned: string;
  title?: string;
  removedFrontmatter: boolean;
}

export interface PreparedVaultNotePlan {
  description: string;
  source: VaultNoteSourceRef;
  originalLength: number;
  cleanedLength: number;
  truncated: boolean;
  maxChars: number;
}

export interface ReadFileFs {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

const defaultReadFileFs: ReadFileFs = {
  async readFile(filePath, encoding) {
    const { readFile } = await import("node:fs/promises");
    return readFile(filePath, encoding);
  },
};

export function extractFrontmatterTitle(raw: string): string | undefined {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!match) return undefined;
  const titleLine = match[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return titleLine?.[1]?.trim();
}

export function extractFirstHeading(raw: string): string | undefined {
  const match = raw.match(/^#{1,6}\s+(.+)$/m);
  return match?.[1]?.trim();
}

export function stripYamlFrontmatter(raw: string): { body: string; removed: boolean } {
  const match = raw.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/);
  if (!match) return { body: raw, removed: false };
  return { body: raw.slice(match[0].length), removed: true };
}

export function normalizeVaultNoteMarkdown(raw: string): NormalizeVaultNoteResult {
  const titleFromFrontmatter = extractFrontmatterTitle(raw);
  const { body, removed } = stripYamlFrontmatter(raw);

  let text = body;
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/!\[\[[^\]]+\]\]/g, "");
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => (alias ?? target).trim());
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  const title = titleFromFrontmatter ?? extractFirstHeading(body);

  return {
    cleaned: text,
    title,
    removedFrontmatter: removed,
  };
}

export function formatSourceReference(source: VaultNoteSourceRef): string {
  if (source.path && source.title) return `${source.path} — ${source.title}`;
  if (source.path) return source.path;
  if (source.title) return source.title;
  return "inline note";
}

export function buildPlanLayoutDescription(cleaned: string, source: VaultNoteSourceRef): string {
  const header = `[Source: ${formatSourceReference(source)}]`;
  const body = cleaned.trim();
  if (!body) return header;
  return `${header}\n\n${body}`;
}

export function truncatePlanDescription(
  description: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (description.length <= maxChars) return { text: description, truncated: false };
  const suffix = "\n\n[truncated for gen_plan_layout]";
  const limit = Math.max(0, maxChars - suffix.length);
  return { text: `${description.slice(0, limit).trimEnd()}${suffix}`, truncated: true };
}

export function prepareVaultNotePlanFromRaw(
  raw: string,
  source: VaultNoteSourceRef,
  maxChars = VAULT_NOTE_PLAN_DEFAULT_MAX_CHARS,
): PreparedVaultNotePlan {
  const normalized = normalizeVaultNoteMarkdown(raw);
  if (!normalized.cleaned.trim()) {
    throw new VaultNotePlanError(
      "Vault note is empty after markdown cleanup. Add level-design body text or use localgpt_gen_plan for short descriptions.",
    );
  }

  const sourceWithTitle = { ...source, title: source.title ?? normalized.title };
  const fullDescription = buildPlanLayoutDescription(normalized.cleaned, sourceWithTitle);
  const { text, truncated } = truncatePlanDescription(fullDescription, maxChars);

  return {
    description: text,
    source: sourceWithTitle,
    originalLength: raw.length,
    cleanedLength: normalized.cleaned.length,
    truncated,
    maxChars,
  };
}

export interface VaultNotePlanInput {
  note?: unknown;
  note_path?: unknown;
  style?: unknown;
  max_chars?: unknown;
}

export interface LoadVaultNoteOptions {
  cwd?: string;
  readFileFs?: ReadFileFs;
}

export async function loadVaultNoteRaw(
  params: VaultNotePlanInput,
  options: LoadVaultNoteOptions = {},
): Promise<{ raw: string; source: VaultNoteSourceRef }> {
  const noteText = typeof params.note === "string" ? params.note.trim() : "";
  const notePath = typeof params.note_path === "string" ? params.note_path.trim() : "";

  if (noteText && notePath) {
    throw new VaultNotePlanError("Provide either note or note_path, not both.");
  }
  if (!noteText && !notePath) {
    throw new VaultNotePlanError("Provide note text or note_path to a vault markdown file.");
  }

  if (noteText) {
    return {
      raw: noteText,
      source: {
        reference: "inline note",
        title: extractFirstHeading(noteText) ?? extractFrontmatterTitle(noteText),
      },
    };
  }

  const cwd = options.cwd ?? process.cwd();
  const absolutePath = path.resolve(cwd, notePath);
  const readFileFs = options.readFileFs ?? defaultReadFileFs;

  let raw: string;
  try {
    raw = await readFileFs.readFile(absolutePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VaultNotePlanError(`Failed to read note_path ${notePath}: ${message}`);
  }

  return {
    raw,
    source: {
      path: notePath.replace(/\\/g, "/"),
      reference: notePath.replace(/\\/g, "/"),
      title: path.basename(notePath, path.extname(notePath)),
    },
  };
}

export async function prepareVaultNotePlanRequest(
  params: VaultNotePlanInput,
  options: LoadVaultNoteOptions = {},
): Promise<PreparedVaultNotePlan> {
  const { raw, source } = await loadVaultNoteRaw(params, options);
  const maxChars = typeof params.max_chars === "number" && params.max_chars > 0
    ? params.max_chars
    : VAULT_NOTE_PLAN_DEFAULT_MAX_CHARS;

  return prepareVaultNotePlanFromRaw(raw, source, maxChars);
}
