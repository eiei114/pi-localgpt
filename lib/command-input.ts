import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Use inline command args when present; otherwise prompt only if a UI is available. */
export async function promptForCommandInput(
  ctx: ExtensionContext,
  title: string,
  placeholder: string,
  args: string,
): Promise<string | undefined> {
  const trimmedArgs = args.trim();
  if (trimmedArgs) return trimmedArgs;
  if (!ctx.hasUI) return undefined;

  const entered = await ctx.ui.input(title, placeholder);
  const value = String(entered ?? "").trim();
  return value || undefined;
}
