import assert from "node:assert/strict";
import test from "node:test";

test("pi-localgpt library modules load", async () => {
  const client = await import("../lib/gen-mcp-client.ts");
  const genStatus = await import("../lib/gen-status.ts");
  const genTools = await import("../lib/gen-tools.ts");
  const localgptConfig = await import("../lib/localgpt-config.ts");
  const localgptWorkspace = await import("../lib/localgpt-workspace.ts");
  const memorySearch = await import("../lib/memory-search.ts");
  const memoryRead = await import("../lib/memory-read.ts");
  const memoryWrite = await import("../lib/memory-write.ts");

  assert.equal(typeof client.checkGenBinary, "function");
  assert.equal(typeof client.genCallTool, "function");
  assert.equal(typeof client.genListTools, "function");
  assert.equal(typeof genStatus.formatGenStatus, "function");
  assert.equal(typeof genStatus.inspectGenStatus, "function");
  assert.equal(typeof genTools.genScreenshot, "function");
  assert.equal(typeof genTools.genMemorySearch, "function");
  assert.equal(typeof genTools.genMemorySave, "function");
  assert.equal(typeof localgptConfig.resolveLocalGptConfig, "function");
  assert.equal(typeof localgptWorkspace.assertInsideWorkspace, "function");
  assert.equal(typeof memorySearch.searchMemory, "function");
  assert.equal(typeof memoryRead.readMemoryRange, "function");
  assert.equal(typeof memoryWrite.saveMemory, "function");
});
