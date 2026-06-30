import assert from "node:assert/strict";
import test from "node:test";

const {
  LOCALGPT_MEMORY_GET_DEFAULT_MAX_CHARS,
  extractMemoryGetSlice,
  formatMemoryGetSlice,
  formatMemoryGetUnavailable,
  runMemoryGet,
} = await import("../lib/localgpt-memory-get.ts");

test("extractMemoryGetSlice normalizes upstream slice payload", () => {
  const slice = extractMemoryGetSlice({
    path: "DESIGN-LOG.md",
    content: "line one\nline two",
    line_start: 10,
    line_end: 11,
  }, "fallback.md");

  assert.equal(slice?.path, "DESIGN-LOG.md");
  assert.equal(slice?.content, "line one\nline two");
  assert.equal(slice?.startLine, 10);
  assert.equal(slice?.endLine, 11);
});

test("formatMemoryGetSlice truncates long output for agent context", () => {
  const slice = {
    path: "DESIGN-LOG.md",
    content: "x".repeat(100),
    startLine: 1,
    endLine: 5,
  };
  const text = formatMemoryGetSlice(slice, 50);

  assert.ok(text.includes("DESIGN-LOG.md (lines 1-5)"));
  assert.ok(text.includes("[truncated"));
  assert.ok(text.length <= 50 + 40);
});

test("formatMemoryGetUnavailable includes status-style hints", () => {
  const text = formatMemoryGetUnavailable("DESIGN-LOG.md", {
    ok: false,
    searchMode: "keyword",
    configPath: "/tmp/config.toml",
    configFound: false,
    workspace: "/tmp/ws",
    workspaceSource: "default",
    workspaceExists: false,
    files: {
      designLog: "/tmp/ws/DESIGN-LOG.md",
      todayLog: "/tmp/ws/design-log/2026-06-24.md",
      designLogExists: false,
      todayLogExists: false,
    },
    hints: ["Create the workspace directory"],
  }, {
    ok: false,
    binary: { found: false, command: "localgpt-gen", error: "localgpt-gen not found" },
    relayReachable: false,
    toolCount: 0,
    tools: [],
    hints: ["localgpt-gen not found. Install: cargo install localgpt-gen"],
  });

  assert.match(text, /localgpt_memory_get: unavailable/);
  assert.match(text, /pi-localgpt status: setup needed/);
  assert.match(text, /localgpt-gen status: not available/);
  assert.match(text, /Create the workspace directory/);
});

test("runMemoryGet returns line slice when workspace and gen are ready", async () => {
  let toolName;
  const result = await runMemoryGet("DESIGN-LOG.md", {
    startLine: 10,
    endLine: 12,
    inspectLocal: async () => ({
      ok: true,
      searchMode: "keyword",
      configPath: "/tmp/config.toml",
      configFound: true,
      workspace: "/tmp/ws",
      workspaceSource: "config",
      workspaceExists: true,
      files: {
        designLog: "/tmp/ws/DESIGN-LOG.md",
        todayLog: "/tmp/ws/design-log/2026-06-24.md",
        designLogExists: true,
        todayLogExists: false,
      },
      hints: [],
    }),
    inspectGen: async () => ({
      ok: true,
      binary: { found: true, command: "localgpt-gen", version: "0.5.0" },
      relayReachable: true,
      toolCount: 4,
      tools: [{ name: "memory_get" }],
      hints: [],
    }),
    callTool: async (tool, args) => {
      toolName = tool;
      return {
        path: args.path,
        content: "matched slice",
        start_line: args.from,
        end_line: (args.from ?? 1) + (args.lines ?? 1) - 1,
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(toolName, "memory_get");
  assert.equal(result.getMode, "slice");
  assert.equal(result.slice?.path, "DESIGN-LOG.md");
  assert.equal(result.slice?.startLine, 10);
  assert.equal(result.slice?.endLine, 12);
  assert.match(result.text, /matched slice/);
});

test("runMemoryGet returns unavailable status without calling upstream when memory_get is unavailable", async () => {
  let called = false;
  const result = await runMemoryGet("DESIGN-LOG.md", {
    inspectLocal: async () => ({
      ok: true,
      searchMode: "keyword",
      configPath: "/tmp/config.toml",
      configFound: true,
      workspace: "/tmp/ws",
      workspaceSource: "config",
      workspaceExists: true,
      files: {
        designLog: "/tmp/ws/DESIGN-LOG.md",
        todayLog: "/tmp/ws/design-log/2026-06-24.md",
        designLogExists: true,
        todayLogExists: false,
      },
      hints: [],
    }),
    inspectGen: async () => ({
      ok: false,
      binary: { found: false, command: "localgpt-gen", error: "missing" },
      relayReachable: false,
      toolCount: 0,
      tools: [],
      hints: ["install localgpt-gen"],
    }),
    callTool: async () => {
      called = true;
      return { content: "noop" };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.equal(result.getMode, "unavailable");
  assert.match(result.text, /localgpt_memory_get: unavailable/);
});

test("runMemoryGet surfaces structured invalid path error from upstream", async () => {
  const result = await runMemoryGet("missing.md", {
    inspectLocal: async () => ({
      ok: true,
      searchMode: "keyword",
      configPath: "/tmp/config.toml",
      configFound: true,
      workspace: "/tmp/ws",
      workspaceSource: "config",
      workspaceExists: true,
      files: {
        designLog: "/tmp/ws/DESIGN-LOG.md",
        todayLog: "/tmp/ws/design-log/2026-06-24.md",
        designLogExists: true,
        todayLogExists: false,
      },
      hints: [],
    }),
    inspectGen: async () => ({
      ok: true,
      binary: { found: true, command: "localgpt-gen", version: "0.5.0" },
      relayReachable: true,
      toolCount: 4,
      tools: [{ name: "memory_get" }],
      hints: [],
    }),
    callTool: async () => {
      throw new Error("path not found: missing.md");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.getMode, "unavailable");
  assert.equal(result.errorKind, "invalid_path");
  assert.match(result.text, /invalid path/);
  assert.match(result.text, /missing\.md/);
});

test("runMemoryGet rejects empty path without calling upstream", async () => {
  let called = false;
  const result = await runMemoryGet("   ", {
    callTool: async () => {
      called = true;
      return { content: "noop" };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.match(result.text, /path is required/);
});

test("runMemoryGet rejects invalid line range locally", async () => {
  let called = false;
  const result = await runMemoryGet("DESIGN-LOG.md", {
    startLine: 20,
    endLine: 10,
    callTool: async () => {
      called = true;
      return { content: "noop" };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.match(result.text, /Invalid line range/);
});

test("formatMemoryGetSlice uses default max chars constant", () => {
  assert.equal(LOCALGPT_MEMORY_GET_DEFAULT_MAX_CHARS, 12_000);
});
