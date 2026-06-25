import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Use inline command args when present; otherwise prompt via ctx.ui.input. */
export async function promptForCommandInput(
  ctx: ExtensionContext,
  title: string,
  placeholder: string,
  args: string,
): Promise<string | undefined> {
  const trimmedArgs = args.trim();
  if (trimmedArgs) return trimmedArgs;

  const entered = await ctx.ui.input(title, placeholder);
  const value = String(entered ?? "").trim();
  return value || undefined;
}
