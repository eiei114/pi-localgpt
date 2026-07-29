import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { StringDecoder } from "node:string_decoder";

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
const STDERR_MAX_CHARS = 2_000;
const STDERR_MAX_LINES = 20;
const ANSI_ESCAPE_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

function sanitizeStderrText(text: string): string {
  return text
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(CONTROL_CHAR_PATTERN, " ")
    .replace(/\r\n?/g, "\n");
}

function trimStderrTail(text: string): string {
  return text.length > STDERR_MAX_CHARS ? text.slice(-STDERR_MAX_CHARS) : text;
}

function formatStderrExcerpt(text: string): string | undefined {
  const lines = sanitizeStderrText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-STDERR_MAX_LINES);
  if (lines.length === 0) return undefined;

  const excerpt = trimStderrTail(lines.join(" | "));
  return excerpt.trim() || undefined;
}

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
  let stderrTail = "";
  const stderrDecoder = new StringDecoder("utf8");

  function appendStderrText(text: string): void {
    stderrTail = trimStderrTail(stderrTail + sanitizeStderrText(text));
  }

  const onStderrData = (chunk: Buffer | string): void => {
    appendStderrText(typeof chunk === "string" ? chunk : stderrDecoder.write(chunk));
  };

  proc.stderr?.on("data", onStderrData);

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
      let settled = false;
      let pollTimer: NodeJS.Timeout | undefined;

      const deadline = setTimeout(() => {
        finishReject(new Error(`Timed out waiting for MCP response id=${targetId} (${ms}ms)`));
      }, ms);

      const finishResolve = (value: JsonRpcResponse) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        if (pollTimer) clearTimeout(pollTimer);
        resolve(value);
      };

      const finishReject = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        if (pollTimer) clearTimeout(pollTimer);
        reject(err);
      };

      const poll = () => {
        if (settled) return;
        for (let i = lineBuffer.length - 1; i >= 0; i--) {
          try {
            const msg = JSON.parse(lineBuffer[i]!) as JsonRpcResponse;
            if (msg.id === targetId) {
              lineBuffer.splice(i, 1);
              finishResolve(msg);
              return;
            }
          } catch {
            // Non-JSON line, skip
          }
        }
        // Retry after short delay
        pollTimer = setTimeout(poll, 50);
      };

      poll();
    });
  }

  function errorWithStderr(message: string): Error {
    appendStderrText(stderrDecoder.end());
    const stderrExcerpt = formatStderrExcerpt(stderrTail);
    return new Error(stderrExcerpt ? `${message}; stderr: ${stderrExcerpt}` : message);
  }

  let onAbort: (() => void) | undefined;

  function cleanup() {
    proc.stderr?.removeListener("data", onStderrData);
    rl.close();
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
    if (!proc.killed) {
      try { proc.stdin!.end(); } catch { /* already closed */ }
      proc.kill();
    }
  }

  if (signal) {
    onAbort = () => cleanup();
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw errorWithStderr(message);
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
