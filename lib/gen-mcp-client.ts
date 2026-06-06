import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

// ── Types ───────────────────────────────────────────────────────────

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface GenCallOptions {
  command?: string;
  connectArgs?: string[];
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Override spawn for testing */
  spawnFn?: (command: string, args: string[], opts: Record<string, unknown>) => ChildProcess;
}

const DEFAULT_COMMAND = "localgpt-gen";
const DEFAULT_CONNECT_ARGS = ["mcp-server", "--connect"];
const DEFAULT_TIMEOUT_MS = 30_000;

// ── 1-shot MCP call ─────────────────────────────────────────────────

/**
 * Spawn `localgpt-gen mcp-server --connect`, perform MCP handshake +
 * one request, then kill the child. No persistent process.
 */
async function genMcpOneShot(
  method: "tools/call" | "tools/list",
  params: Record<string, unknown>,
  options: GenCallOptions = {},
): Promise<unknown> {
  const command = options.command ?? DEFAULT_COMMAND;
  const connectArgs = options.connectArgs ?? DEFAULT_CONNECT_ARGS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const spawnFn = options.spawnFn ?? spawn;
  const signal = options.signal;

  const proc = spawnFn(command, connectArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    env: options.env ?? process.env,
  });

  let nextId = 1;
  const lineBuffer: string[] = [];

  const rl = createInterface({ input: proc.stdout! });
  rl.on("line", (line: string) => {
    if (line.trim()) lineBuffer.push(line);
  });

  function writeRequest(m: string, p: Record<string, unknown>): number {
    const id = nextId++;
    proc.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method: m, params: p }) + "\n");
    return id;
  }

  function writeNotification(m: string, p: Record<string, unknown>): void {
    proc.stdin!.write(JSON.stringify({ jsonrpc: "2.0", method: m, params: p }) + "\n");
  }

  function waitForResponse(targetId: number, ms: number): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        reject(new Error(`Timed out waiting for MCP response id=${targetId} (${ms}ms)`));
      }, ms);

      const poll = () => {
        for (let i = lineBuffer.length - 1; i >= 0; i--) {
          try {
            const msg = JSON.parse(lineBuffer[i]!) as JsonRpcResponse;
            if (msg.id === targetId) {
              lineBuffer.splice(i, 1);
              clearTimeout(deadline);
              resolve(msg);
              return;
            }
          } catch {
            // Non-JSON line, skip
          }
        }
        // Retry after short delay
        setTimeout(poll, 50);
      };

      poll();
    });
  }

  function cleanup() {
    rl.close();
    if (!proc.killed) {
      try { proc.stdin!.end(); } catch { /* already closed */ }
      proc.kill();
    }
  }

  if (signal) {
    const onAbort = () => cleanup();
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    // Wait for process to spawn
    await new Promise<void>((resolve, reject) => {
      proc.on("error", (err) => reject(new Error(`Spawn ${command} failed: ${err.message}`)));
      if (proc.pid && proc.pid > 0) { resolve(); return; }
      setTimeout(() => {
        if (proc.pid && proc.pid > 0) resolve();
        else reject(new Error(`Spawn ${command} failed: no PID`));
      }, 100);
    });

    // MCP initialize
    const initId = writeRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "pi-localgpt", version: "0.1.0" },
    });
    const initResp = await waitForResponse(initId, timeoutMs);
    if (initResp.error) {
      throw new Error(`MCP initialize error: ${initResp.error.message}`);
    }

    // Initialized notification
    writeNotification("notifications/initialized", {});

    // Actual request
    const reqId = writeRequest(method, params);
    const resp = await waitForResponse(reqId, timeoutMs);
    if (resp.error) {
      throw new Error(`MCP ${method} error (${resp.error.code}): ${resp.error.message}`);
    }

    return resp.result;
  } finally {
    cleanup();
  }
}

// ── High-level API ──────────────────────────────────────────────────

export async function genCallTool(
  toolName: string,
  args: Record<string, unknown>,
  options: GenCallOptions = {},
): Promise<unknown> {
  return genMcpOneShot("tools/call", { name: toolName, arguments: args }, options);
}

export async function genListTools(
  options: GenCallOptions = {},
): Promise<ToolDefinition[]> {
  const result = await genMcpOneShot("tools/list", {}, options) as { tools?: ToolDefinition[] } | null;
  return result?.tools ?? [];
}

// ── Binary discovery ────────────────────────────────────────────────

export interface GenBinaryStatus {
  found: boolean;
  command: string;
  version?: string;
  error?: string;
}

export async function checkGenBinary(
  command = "localgpt-gen",
  execFn: (cmd: string) => Promise<string> = defaultExec,
): Promise<GenBinaryStatus> {
  try {
    const output = await execFn(`${command} --version`);
    const version = output.trim().split(/\s+/).pop() ?? undefined;
    return { found: true, command, version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      found: false,
      command,
      error: `${command} not found. Install: cargo install localgpt-gen (${message})`,
    };
  }
}

async function defaultExec(cmd: string): Promise<string> {
  const { exec } = await import("node:child_process");
  return new Promise<string>((resolve, reject) => {
    exec(cmd, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}
