import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  behaviorAssertions,
  EXTENSION_LOAD_ERROR_PATTERN,
  parseJsonLines,
  SDK_NAMES,
  SDK_VERSIONS,
  UNHANDLED_ERROR_PATTERN,
  VERIFICATION_CONTRACT,
} from "./pi-sdk-smoke-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const reportPath = resolve(root, "docs/verification/pi-sdk-smoke.json");
const PROBE_TIMEOUT_MS = 15_000;
const CLEANUP_GRACE_MS = 1_000;
const OUTPUT_LIMIT_BYTES = 2_000_000;
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson(resolve(root, "package.json"));
const sdkVersions = Object.fromEntries(SDK_NAMES.map((name) => {
  const version = readJson(resolve(root, "node_modules", name, "package.json")).version;
  if (manifest.devDependencies?.[name] !== version || SDK_VERSIONS[name] !== version) {
    throw new Error(`Smoke requires the exact Pi SDK 1.1.0 dev/test pin for ${name}; installed ${version}`);
  }
  return [name, version];
}));
const piPackageDir = resolve(root, "node_modules/@earendil-works/pi-coding-agent");
const piManifest = readJson(resolve(piPackageDir, "package.json"));
const piCli = resolve(piPackageDir, piManifest.bin.pi);
const isolatedRoot = mkdtempSync(join(tmpdir(), "pi-localgpt-sdk-smoke-"));
const piConfigDir = join(isolatedRoot, "pi-config");
const workspace = join(isolatedRoot, "workspace");
mkdirSync(piConfigDir, { recursive: true });
mkdirSync(workspace, { recursive: true });
writeFileSync(join(workspace, "DESIGN-LOG.md"), "# Isolated Pi SDK smoke workspace\n", "utf8");

const env = {
  ...process.env,
  PI_CODING_AGENT_DIR: piConfigDir,
  PI_OFFLINE: "1",
  LOCALGPT_CONFIG: join(isolatedRoot, "missing-config.toml"),
  LOCALGPT_WORKSPACE: workspace,
};
const piArgs = ["--offline", "--no-session", "--no-builtin-tools", "--no-extensions", "--no-skills",
  "--no-context-files", "--no-prompt-templates", "--no-mcp", "-e", ".", "--mode", "rpc"];
const rpc = (...commands) => `${commands.map((command) => JSON.stringify(command)).join("\n")}\n`;
const evidenceCommand = "npm run smoke:pi";
const quotePowerShell = (value) => `'${value.replaceAll("'", "''")}'`;

function redact(text) {
  const escapedPath = (path) => path.replaceAll("\\", "\\\\");
  return text.replaceAll(escapedPath(root), "<repo>")
    .replaceAll(escapedPath(isolatedRoot), "<isolated-temp>")
    .replaceAll(root, "<repo>")
    .replaceAll(isolatedRoot, "<isolated-temp>");
}

function runChild(name, executable, args, input = "", { closeAfterResponseIds = [] } = {}) {
  return new Promise((resolveResult) => {
    let child;
    let stdout = "";
    let stderr = "";
    let outputOverflow = false;
    let timedOut = false;
    let closed = false;
    let cleanupFailed = false;
    let spawnError;
    let signal = null;
    let deadlineTimer;
    let killTimer;
    let resolveAfterCleanup;
    let pendingResponseIds = new Set(closeAfterResponseIds);
    let stdoutLineBuffer = "";
    const completion = new Promise((resolveClose) => {
      resolveAfterCleanup = resolveClose;
    });
    try {
      child = spawn(executable, args, {
        cwd: root,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      resolveResult({ name, exit_code: -1, stdout, stderr, timedOut, closed, signal,
        outputOverflow, error: error instanceof Error ? error.message : String(error) });
      return;
    }

    const append = (target, chunk) => {
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + chunk.length > OUTPUT_LIMIT_BYTES) {
        outputOverflow = true;
        child.kill();
        return;
      }
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk) => {
      append("stdout", chunk);
      if (pendingResponseIds.size === 0) return;
      stdoutLineBuffer += chunk.toString("utf8");
      let lineEnd = stdoutLineBuffer.indexOf("\n");
      while (lineEnd !== -1) {
        const line = stdoutLineBuffer.slice(0, lineEnd).replace(/\r$/, "");
        stdoutLineBuffer = stdoutLineBuffer.slice(lineEnd + 1);
        try {
          const row = JSON.parse(line);
          if (row?.type === "response") pendingResponseIds.delete(row.id);
        } catch {
          // Ignore non-protocol diagnostics; full stdout is still captured below.
        }
        if (pendingResponseIds.size === 0) child.stdin.end();
        lineEnd = stdoutLineBuffer.indexOf("\n");
      }
    });
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.once("error", (error) => {
      spawnError = error instanceof Error ? error.message : String(error);
    });
    child.once("close", (code, closeSignal) => {
      closed = true;
      signal = closeSignal;
      clearTimeout(deadlineTimer);
      clearTimeout(killTimer);
      resolveAfterCleanup({ code, signal: closeSignal, closed: true, cleanupFailed });
    });
    deadlineTimer = setTimeout(() => {
      timedOut = true;
      child.kill();
      killTimer = setTimeout(() => {
        if (!closed) {
          cleanupFailed = true;
          child.kill("SIGKILL");
          child.stdin.destroy();
          child.stdout.destroy();
          child.stderr.destroy();
          child.unref();
          resolveAfterCleanup({ code: null, signal: null, closed: false, cleanupFailed });
        }
      }, CLEANUP_GRACE_MS);
    }, PROBE_TIMEOUT_MS);
    child.stdin.on("error", (error) => {
      spawnError ??= error instanceof Error ? error.message : String(error);
    });
    if (input.length > 0) child.stdin.write(input);
    if (pendingResponseIds.size === 0) child.stdin.end();

    void (async () => {
      const closedChild = await completion;
      resolveResult({
        name,
        exit_code: closedChild.code ?? -1,
        stdout,
        stderr,
        timedOut,
        closed: closedChild.closed,
        signal: closedChild.signal ?? signal,
        cleanupFailed: closedChild.cleanupFailed,
        outputOverflow,
        error: spawnError,
      });
    })();
  });
}

async function runRpcCase(name, commands) {
  return runChild(name, process.execPath, [piCli, ...piArgs], rpc(...commands), {
    closeAfterResponseIds: commands.map((command) => command.id),
  });
}

function presentCase(name, result, { responseOutput = result.stdout, firstProcess } = {}) {
  const responses = parseJsonLines(responseOutput);
  const assertions = behaviorAssertions(name, {
    responses,
    first_responses: parseJsonLines(firstProcess?.stdout ?? ""),
    stdout: result.stdout,
    stderr: result.stderr,
    exit_code: result.exit_code,
    timed_out: result.timedOut,
    closed: result.closed,
    first_exit_code: firstProcess?.exit_code,
    first_timed_out: firstProcess?.timedOut,
    first_closed: firstProcess?.closed,
    first_cleanup_failed: firstProcess?.cleanupFailed,
    expectedVersion: sdkVersions["@earendil-works/pi-coding-agent"],
  });
  const fullOutput = `${result.stdout}\n${result.stderr}`;
  const hasUnhandledError = UNHANDLED_ERROR_PATTERN.test(fullOutput);
  const hasLoadError = EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput);
  const passed = result.exit_code === 0 && result.closed && !result.timedOut
    && !result.cleanupFailed && !result.outputOverflow && !result.error
    && (!firstProcess || (firstProcess.exit_code === 0 && firstProcess.closed
      && !firstProcess.timedOut && !firstProcess.cleanupFailed && !firstProcess.outputOverflow && !firstProcess.error))
    && !hasUnhandledError && !hasLoadError
    && assertions.every((item) => item.passed);
  return {
    name,
    command: evidenceCommand,
    exit_code: result.exit_code,
    passed,
    evidence: redact(fullOutput).slice(-6_000) || result.error || "No output captured",
    assertions: assertions.map((item) => ({ ...item, observed: redact(item.observed) })),
    hasUnhandledError,
    hasLoadError,
  };
}

async function main() {
  const cases = [];
  const extensionCommands = [{ id: "commands", type: "get_commands" }];
  const happyPath = [{ id: "feature", type: "prompt", message: "/localgpt:status" }];
  const errorPath = [{ id: "feature", type: "prompt", message: "/localgpt:get smoke.md 0" }];
  try {
    cases.push(presentCase("extension_load", await runRpcCase("extension_load", extensionCommands)));
    cases.push(presentCase("happy_path", await runRpcCase("happy_path", happyPath)));
    cases.push(presentCase("error_path", await runRpcCase("error_path", errorPath)));
    // Close one actual Pi host, then prove a fresh second host re-registers and handles the feature.
    const reloadInput = [...extensionCommands, ...happyPath];
    const firstReloadProcess = await runRpcCase("reload_cleanup:first", reloadInput);
    const secondReloadProcess = await runRpcCase("reload_cleanup:second", reloadInput);
    const reloadResult = {
      ...secondReloadProcess,
      stdout: `[first Pi process]\n${firstReloadProcess.stdout}[second Pi process]\n${secondReloadProcess.stdout}`,
      stderr: `[first Pi process]\n${firstReloadProcess.stderr}[second Pi process]\n${secondReloadProcess.stderr}`,
      closed: firstReloadProcess.closed && secondReloadProcess.closed,
      timedOut: firstReloadProcess.timedOut || secondReloadProcess.timedOut,
      cleanupFailed: firstReloadProcess.cleanupFailed || secondReloadProcess.cleanupFailed,
      outputOverflow: firstReloadProcess.outputOverflow || secondReloadProcess.outputOverflow,
      error: firstReloadProcess.error ?? secondReloadProcess.error,
    };
    cases.push(presentCase("reload_cleanup", reloadResult, {
      responseOutput: secondReloadProcess.stdout,
      firstProcess: firstReloadProcess,
    }));

    let hostShell;
    if (process.platform === "win32") {
      const shell = resolve(process.env.SystemRoot ?? "C:/Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe");
      const command = `& ${quotePowerShell(process.execPath)} ${quotePowerShell(piCli)} --no-extensions --version; exit $LASTEXITCODE`;
      hostShell = await runChild("host_shell", shell,
        ["-NoProfile", "-NonInteractive", "-Command", command]);
    } else {
      hostShell = await runChild("host_shell", "/bin/sh",
        ["-c", '"$1" "$2" --no-extensions --version', "pi-host-shell", process.execPath, piCli]);
    }
    cases.push(presentCase("host_shell", hostShell));

    const report = {
      schema_version: 1,
      verification_contract: VERIFICATION_CONTRACT,
      sdk_versions: sdkVersions,
      platform: process.platform,
      model_inference: "none; actual Pi 1.1.0 RPC host loads this extension and executes local commands",
      unhandled_errors: cases.filter((item) => item.hasUnhandledError).length,
      extension_load_errors: cases.filter((item) => item.hasLoadError
        || (item.name === "extension_load" && !item.passed)).length,
      cases: cases.map(({ hasUnhandledError, hasLoadError, ...item }) => item),
    };
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ verification_contract: VERIFICATION_CONTRACT, platform: process.platform,
      cases: cases.map(({ name, passed, exit_code }) => ({ name, passed, exit_code })) }));
    if (cases.length !== 5 || cases.some((item) => !item.passed)) process.exitCode = 1;
  } finally {
    rmSync(isolatedRoot, { recursive: true, force: true });
  }
}

await main();
