import { checkGenBinary, genListTools, type GenBinaryStatus, type ToolDefinition } from "./gen-mcp-client.ts";

export interface GenStatusSummary {
  ok: boolean;
  binary: GenBinaryStatus;
  relayReachable: boolean;
  toolCount: number;
  tools: ToolDefinition[];
  hints: string[];
}

function buildHints(summary: Omit<GenStatusSummary, "hints">): string[] {
  const hints: string[] = [];

  if (!summary.binary.found) {
    hints.push(summary.binary.error ?? "localgpt-gen not found. Install: cargo install localgpt-gen");
  } else if (!summary.relayReachable) {
    hints.push("Binary found but relay not reachable. Start localgpt-gen interactively first, then gen tools will connect via --connect.");
  }

  if (summary.relayReachable && summary.toolCount === 0) {
    hints.push("Connected but no tools discovered. Check localgpt-gen version.");
  }

  return hints;
}

/**
 * Check gen status. Tries to connect to the relay and list tools.
 * Each check is a 1-shot spawn — no persistent process.
 */
export async function inspectGenStatus(
  binaryCheck?: (cmd: string) => Promise<GenBinaryStatus>,
  listTools?: (options: Record<string, unknown>) => Promise<ToolDefinition[]>,
): Promise<GenStatusSummary> {
  const binary = await (binaryCheck ?? checkGenBinary)('localgpt-gen');

  let relayReachable = false;
  let tools: ToolDefinition[] = [];

  if (binary.found) {
    try {
      tools = await (listTools ?? genListTools)({ signal: undefined });
      relayReachable = true;
    } catch {
      relayReachable = false;
    }
  }

  const base = {
    ok: binary.found && relayReachable,
    binary,
    relayReachable,
    toolCount: tools.length,
    tools,
  };

  return { ...base, hints: buildHints(base) };
}

export function formatGenStatus(summary: GenStatusSummary): string {
  const lines = [
    summary.ok ? "localgpt-gen status: available" : "localgpt-gen status: not available",
    `binary: ${summary.binary.command} (${summary.binary.found ? `v${summary.binary.version ?? "unknown"}` : "missing"})`,
    `relay: ${summary.relayReachable ? "reachable" : "not reachable (start localgpt-gen first)"}`,
    `tools: ${summary.toolCount}`,
  ];

  if (summary.hints.length > 0) {
    lines.push("hints:");
    for (const hint of summary.hints) lines.push(`- ${hint}`);
  }

  return lines.join("\n");
}
