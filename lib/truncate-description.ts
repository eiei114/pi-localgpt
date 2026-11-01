const GEN_PLAN_LAYOUT_TRUNCATION_SUFFIX = "\n\n[truncated for gen_plan_layout]";

export function truncateGenPlanDescription(
  description: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (description.length <= maxChars) return { text: description, truncated: false };
  if (maxChars <= GEN_PLAN_LAYOUT_TRUNCATION_SUFFIX.length) {
    return { text: description.slice(0, maxChars), truncated: true };
  }

  const limit = maxChars - GEN_PLAN_LAYOUT_TRUNCATION_SUFFIX.length;
  return {
    text: `${description.slice(0, limit).trimEnd()}${GEN_PLAN_LAYOUT_TRUNCATION_SUFFIX}`,
    truncated: true,
  };
}
