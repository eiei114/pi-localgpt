import assert from "node:assert/strict";
import test from "node:test";

const { searchWorkspaceMemory } = await import("../lib/memory-search.ts");

const files = new Map([
  ["/ws/MEMORY.md", "# Memory\n\nRust async patterns with tokio\n"],
  ["/ws/memory/2026-06-06.md", "# 2026-06-06\n\nDiscussed Rust error handling\n"],
]);

test("searchWorkspaceMemory returns keyword matches without spawning localgpt", async () => {
  const results = await searchWorkspaceMemory({
    workspacePath: "/ws",
    query: "rust async",
    platform: "linux",
    listDir: async () => ["2026-06-06.md"],
    readText: async (path) => files.get(path) ?? Promise.reject(new Error("missing")),
  });

  assert.ok(results.length >= 1);
  assert.equal(results[0].path, "MEMORY.md");
  assert.match(results[0].content, /tokio/i);
});
