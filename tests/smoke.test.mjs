import assert from "node:assert/strict";
import test from "node:test";

test("pi-localgpt library modules load", async () => {
  const config = await import("../lib/localgpt-config.ts");
  const workspace = await import("../lib/localgpt-workspace.ts");
  const search = await import("../lib/memory-search.ts");
  const read = await import("../lib/memory-read.ts");
  const write = await import("../lib/memory-write.ts");

  assert.equal(typeof config.resolveLocalgptPaths, "function");
  assert.equal(typeof workspace.inspectWorkspaceFiles, "function");
  assert.equal(typeof search.searchWorkspaceMemory, "function");
  assert.equal(typeof read.readWorkspaceMemory, "function");
  assert.equal(typeof write.appendMemorySave, "function");
});
