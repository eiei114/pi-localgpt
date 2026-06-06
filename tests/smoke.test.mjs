import assert from "node:assert/strict";
import test from "node:test";

test("pi-localgpt library modules load", async () => {
  const client = await import("../lib/gen-mcp-client.ts");
  const genStatus = await import("../lib/gen-status.ts");
  const genTools = await import("../lib/gen-tools.ts");

  assert.equal(typeof client.checkGenBinary, "function");
  assert.equal(typeof client.genCallTool, "function");
  assert.equal(typeof client.genListTools, "function");
  assert.equal(typeof genStatus.formatGenStatus, "function");
  assert.equal(typeof genStatus.inspectGenStatus, "function");
  assert.equal(typeof genTools.genScreenshot, "function");
  assert.equal(typeof genTools.genMemorySearch, "function");
  assert.equal(typeof genTools.genMemorySave, "function");
});
