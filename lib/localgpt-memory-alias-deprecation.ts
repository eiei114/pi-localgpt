/** Planned semver when legacy `localgpt_memory_*` tool names are removed. */
export const LOCALGPT_MEMORY_ALIAS_REMOVAL_VERSION = "0.12.0";

const REPLACEMENT_BY_ALIAS: Record<string, string> = {
  localgpt_memory_search: "localgpt_design_log_search",
  localgpt_memory_get: "localgpt_design_log_get",
  localgpt_memory_save: "localgpt_design_log_save",
  localgpt_memory_log: "localgpt_design_log_log",
};

export const LOCALGPT_MEMORY_ALIAS_TOOL_NAMES = Object.keys(REPLACEMENT_BY_ALIAS);

let hasWarnedGlobally = false;

export function replacementForMemoryAlias(alias: string): string | undefined {
  return REPLACEMENT_BY_ALIAS[alias];
}

/** Short suffix for tool descriptions and docs. */
export function deprecationSuffixFor(alias: string): string {
  const replacement = replacementForMemoryAlias(alias);
  if (!replacement) return "";
  return ` Deprecated legacy alias — use ${replacement} instead. Planned removal in v${LOCALGPT_MEMORY_ALIAS_REMOVAL_VERSION}.`;
}

/** One-time stderr hint on first legacy alias invocation per process. */
export function warnOnceOnMemoryAliasUse(alias: string): void {
  if (hasWarnedGlobally) return;
  hasWarnedGlobally = true;
  const replacement = replacementForMemoryAlias(alias) ?? "localgpt_design_log_*";
  console.warn(
    `[pi-localgpt] ${alias} is deprecated and will be removed in v${LOCALGPT_MEMORY_ALIAS_REMOVAL_VERSION}. Migrate to ${replacement}.`,
  );
}

/** Test-only reset for one-time warning state. */
export function resetMemoryAliasDeprecationWarningsForTests(): void {
  hasWarnedGlobally = false;
}
