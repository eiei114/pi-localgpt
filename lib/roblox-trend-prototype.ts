import * as path from "node:path";

export const ROBLOX_TREND_PROTOTYPE_DEFAULT_MAX_CHARS = 6_000;

export const ROBLOX_TREND_GUARDRAILS = [
  "Does not call Roblox APIs, chart scrapers, or external research tools — input must be supplied by you or a separate Roblox research workflow.",
  "Does not infer monetization, retention loops, UGC systems, or platform policy compliance.",
  "Does not generate Roblox Lua scripts or Studio-ready assets; output targets LocalGPT rough 3D concept blockouts only.",
  "Speculative design ideas are labeled separately from research facts and must be validated in playtests.",
] as const;

export class RobloxTrendPrototypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RobloxTrendPrototypeError";
  }
}

export interface RobloxTrendSummaryFields {
  title?: unknown;
  genre?: unknown;
  theme?: unknown;
  mechanics?: unknown;
  audience?: unknown;
  market_signals?: unknown;
  speculative_ideas?: unknown;
}

export interface RobloxTrendPrototypeInput {
  summary?: unknown;
  summary_path?: unknown;
  style?: unknown;
  max_chars?: unknown;
}

export interface NormalizedRobloxTrendSummary {
  title?: string;
  genre: string;
  theme?: string;
  mechanics: string[];
  audience?: string;
  marketSignals: string[];
  speculativeIdeas: string[];
}

export interface PreparedRobloxTrendPrototype {
  planningDescription: string;
  layoutBrief: string;
  title: string;
  facts: {
    genre: string;
    theme?: string;
    mechanics: string[];
    audience?: string;
    marketSignals: string[];
  };
  speculative: string[];
  guardrails: readonly string[];
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

export function coerceStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  return [];
}

export function asRobloxTrendSummaryFields(value: unknown): RobloxTrendSummaryFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RobloxTrendPrototypeError(
      "summary must be a JSON object with genre and at least one other trend signal.",
    );
  }
  return value as RobloxTrendSummaryFields;
}

export function validateRobloxTrendSummary(input: RobloxTrendSummaryFields): void {
  const genre = typeof input.genre === "string" ? input.genre.trim() : "";
  if (!genre) {
    throw new RobloxTrendPrototypeError(
      "genre is required — provide the Roblox genre or category signal from your research summary.",
    );
  }

  const hasFactualSignal = Boolean(
    (typeof input.theme === "string" && input.theme.trim())
    || coerceStringList(input.mechanics).length > 0
    || coerceStringList(input.market_signals).length > 0,
  );

  if (!hasFactualSignal) {
    throw new RobloxTrendPrototypeError(
      "Provide at least one factual trend signal besides genre: theme, mechanics, or market_signals.",
    );
  }
}

export function normalizeRobloxTrendSummary(input: RobloxTrendSummaryFields): NormalizedRobloxTrendSummary {
  validateRobloxTrendSummary(input);

  return {
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : undefined,
    genre: (input.genre as string).trim(),
    theme: typeof input.theme === "string" && input.theme.trim() ? input.theme.trim() : undefined,
    mechanics: coerceStringList(input.mechanics),
    audience: typeof input.audience === "string" && input.audience.trim() ? input.audience.trim() : undefined,
    marketSignals: coerceStringList(input.market_signals),
    speculativeIdeas: coerceStringList(input.speculative_ideas),
  };
}

export function buildLayoutBrief(summary: NormalizedRobloxTrendSummary): string {
  const parts: string[] = [];
  parts.push(`Roblox-inspired ${summary.genre} concept scene.`);
  if (summary.theme) parts.push(`Visual theme: ${summary.theme}.`);
  if (summary.mechanics.length) parts.push(`Highlight mechanics: ${summary.mechanics.join(", ")}.`);
  if (summary.audience) parts.push(`Audience feel: ${summary.audience}.`);
  if (summary.marketSignals.length) parts.push(`Trend cues: ${summary.marketSignals.join("; ")}.`);
  if (summary.speculativeIdeas.length) {
    parts.push(`Optional prototype additions (speculative): ${summary.speculativeIdeas.join("; ")}.`);
  }
  parts.push("Blockout as a rough playable-feel 3D concept, not a Roblox Studio replica.");
  return parts.join(" ");
}

export function truncatePrototypeDescription(
  description: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (description.length <= maxChars) return { text: description, truncated: false };
  const suffix = "\n\n[truncated for gen_plan_layout]";
  if (maxChars <= suffix.length) {
    return { text: description.slice(0, maxChars), truncated: true };
  }
  const limit = maxChars - suffix.length;
  return { text: `${description.slice(0, limit).trimEnd()}${suffix}`, truncated: true };
}

export function buildRobloxTrendPrototypePrompt(
  summary: NormalizedRobloxTrendSummary,
  maxChars = ROBLOX_TREND_PROTOTYPE_DEFAULT_MAX_CHARS,
): PreparedRobloxTrendPrototype {
  const title = summary.title ?? "untitled trend";
  const layoutBrief = buildLayoutBrief(summary);
  const lines: string[] = [];

  lines.push(`[Roblox trend → LocalGPT prototype | ${title}]`);
  lines.push("");
  lines.push("## Trend facts (from research — not playtest-validated)");
  lines.push(`Genre: ${summary.genre}`);
  if (summary.theme) lines.push(`Theme: ${summary.theme}`);
  if (summary.mechanics.length) lines.push(`Mechanics: ${summary.mechanics.join(", ")}`);
  if (summary.audience) lines.push(`Audience: ${summary.audience}`);
  if (summary.marketSignals.length) {
    lines.push("Market signals:");
    for (const signal of summary.marketSignals) lines.push(`- ${signal}`);
  }

  if (summary.speculativeIdeas.length) {
    lines.push("");
    lines.push("## Speculative additions (optional — verify before shipping)");
    for (const idea of summary.speculativeIdeas) lines.push(`- ${idea}`);
  }

  lines.push("");
  lines.push("## Layout brief for gen_plan_layout");
  lines.push(layoutBrief);
  lines.push("");
  lines.push("## Guardrails (this workflow does not infer)");
  for (const guardrail of ROBLOX_TREND_GUARDRAILS) lines.push(`- ${guardrail}`);

  const fullDescription = lines.join("\n");
  const { text, truncated } = truncatePrototypeDescription(fullDescription, maxChars);

  return {
    planningDescription: text,
    layoutBrief,
    title,
    facts: {
      genre: summary.genre,
      theme: summary.theme,
      mechanics: summary.mechanics,
      audience: summary.audience,
      marketSignals: summary.marketSignals,
    },
    speculative: summary.speculativeIdeas,
    guardrails: ROBLOX_TREND_GUARDRAILS,
    truncated,
    maxChars,
  };
}

export interface LoadRobloxTrendSummaryOptions {
  cwd?: string;
  readFileFs?: ReadFileFs;
}

export async function loadRobloxTrendSummary(
  params: RobloxTrendPrototypeInput,
  options: LoadRobloxTrendSummaryOptions = {},
): Promise<{ summary: NormalizedRobloxTrendSummary; source: string }> {
  const inlineSummary = params.summary;
  const summaryPath = typeof params.summary_path === "string" ? params.summary_path.trim() : "";

  if (inlineSummary !== undefined && summaryPath) {
    throw new RobloxTrendPrototypeError("Provide either summary or summary_path, not both.");
  }
  if (inlineSummary === undefined && !summaryPath) {
    throw new RobloxTrendPrototypeError("Provide summary object or summary_path to a JSON trend file.");
  }

  if (inlineSummary !== undefined) {
    const normalized = normalizeRobloxTrendSummary(asRobloxTrendSummaryFields(inlineSummary));
    return {
      summary: normalized,
      source: normalized.title ?? "inline summary",
    };
  }

  const cwd = options.cwd ?? process.cwd();
  const absolutePath = path.resolve(cwd, summaryPath);
  const relativePath = path.relative(cwd, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new RobloxTrendPrototypeError("summary_path must stay within the configured working directory.");
  }
  if (!/\.json$/i.test(absolutePath)) {
    throw new RobloxTrendPrototypeError("summary_path must point to a JSON trend summary file.");
  }

  const readFileFs = options.readFileFs ?? defaultReadFileFs;
  let raw: string;
  try {
    raw = await readFileFs.readFile(absolutePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RobloxTrendPrototypeError(`Failed to read summary_path ${summaryPath}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RobloxTrendPrototypeError(`summary_path ${summaryPath} is not valid JSON: ${message}`);
  }

  const normalized = normalizeRobloxTrendSummary(asRobloxTrendSummaryFields(parsed));
  return {
    summary: normalized,
    source: summaryPath.replace(/\\/g, "/"),
  };
}

export async function prepareRobloxTrendPrototypeRequest(
  params: RobloxTrendPrototypeInput,
  options: LoadRobloxTrendSummaryOptions = {},
): Promise<PreparedRobloxTrendPrototype & { source: string }> {
  const { summary, source } = await loadRobloxTrendSummary(params, options);
  const maxChars = typeof params.max_chars === "number" && params.max_chars > 0
    ? params.max_chars
    : ROBLOX_TREND_PROTOTYPE_DEFAULT_MAX_CHARS;

  return {
    ...buildRobloxTrendPrototypePrompt(summary, maxChars),
    source,
  };
}
