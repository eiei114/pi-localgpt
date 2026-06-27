import assert from "node:assert/strict";
import test from "node:test";

const {
  LOCALGPT_MEMORY_SEARCH_DEFAULT_MAX_CHARS,
  extractMemorySearchHits,
  formatMemorySearchHits,
  formatMemorySearchUnavailable,
  runMemorySearch,
} = await import("../lib/localgpt-memory-search.ts");

test("extractMemorySearchHits normalizes upstream results array", () => {
  const hits = extractMemorySearchHits({
    results: [
      {
        id: "mem_1",
        file: "DESIGN-LOG.md",
        snippet: "Project uses Rust + Bevy",
        score: 0.92,
        line_start: 10,
        line_end: 12,
      },
    ],
  });

  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.id, "mem_1");
  assert.equal(hits[0]?.file, "DESIGN-LOG.md");
  assert.equal(hits[0]?.content, "Project uses Rust + Bevy");
  assert.equal(hits[0]?.score, 0.92);
});

test("formatMemorySearchHits truncates long output for agent context", () => {
  const hits = [{ id: "mem_1", content: "x".repeat(100) }];
  const text = formatMemorySearchHits(hits, "rust", 50);

  assert.ok(text.includes("LocalGPT memory search (hybrid)"));
  assert.ok(text.includes("[truncated"));
  assert.ok(text.length <= 50 + 40);
});

test("formatMemorySearchUnavailable includes status-style hints", () => {
  const text = formatMemorySearchUnavailable("rust", {
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

  assert.match(text, /localgpt_memory_search: unavailable/);
  assert.match(text, /pi-localgpt status: setup needed/);
  assert.match(text, /localgpt-gen status: not available/);
  assert.match(text, /Create the workspace directory/);
});

test("runMemorySearch returns hybrid hits when workspace and gen are ready", async () => {
  const result = await runMemorySearch("rust", {
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
      tools: [{ name: "memory_search" }],
      hints: [],
    }),
    callTool: async (_tool, args) => ({
      results: [{ id: "mem_1", snippet: `matched ${args.query}` }],
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.searchMode, "hybrid");
  assert.equal(result.hits.length, 1);
  assert.match(result.text, /matched rust/);
});

test("runMemorySearch surfaces status-style hint when binary is missing", async () => {
  const result = await runMemorySearch("rust", {
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
      binary: { found: false, command: "localgpt-gen", error: "localgpt-gen not found" },
      relayReachable: false,
      toolCount: 0,
      tools: [],
      hints: ["localgpt-gen not found. Install: cargo install localgpt-gen"],
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.searchMode, "unavailable");
  assert.match(result.text, /localgpt-gen status: not available/);
  assert.ok(result.hints?.some((hint) => hint.includes("localgpt-gen not found")));
});

test("runMemorySearch rejects empty query without calling upstream", async () => {
  let called = false;
  const result = await runMemorySearch("   ", {
    callTool: async () => {
      called = true;
      return { results: [] };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.match(result.text, /query is required/);
});

test("formatMemorySearchHits uses default max chars constant", () => {
  assert.equal(LOCALGPT_MEMORY_SEARCH_DEFAULT_MAX_CHARS, 12_000);
});
