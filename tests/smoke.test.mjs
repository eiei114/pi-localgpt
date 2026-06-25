import assert from "node:assert/strict";
import test from "node:test";

test("pi-localgpt library modules load", async () => {
  const client = await import("../lib/gen-mcp-client.ts");
  const genStatus = await import("../lib/gen-status.ts");
  const localgptStatus = await import("../lib/localgpt-status.ts");
  const genTools = await import("../lib/gen-tools.ts");
  const localgptConfig = await import("../lib/localgpt-config.ts");
  const localgptWorkspace = await import("../lib/localgpt-workspace.ts");
  const designLogSearch = await import("../lib/design-log-search.ts");
  const designLogRead = await import("../lib/design-log-read.ts");
  const designLogWrite = await import("../lib/design-log-write.ts");
  const commandInput = await import("../lib/command-input.ts");

  assert.equal(typeof client.checkGenBinary, "function");
  assert.equal(typeof client.genCallTool, "function");
  assert.equal(typeof client.genListTools, "function");
  assert.equal(typeof genStatus.formatGenStatus, "function");
  assert.equal(typeof genStatus.inspectGenStatus, "function");
  assert.equal(typeof localgptStatus.formatLocalGptStatus, "function");
  assert.equal(typeof localgptStatus.inspectLocalGptStatus, "function");
  assert.equal(typeof genTools.genScreenshot, "function");
  assert.equal(typeof genTools.genDesignLogSearch, "function");
  assert.equal(typeof genTools.genDesignLogSave, "function");
  assert.equal(typeof genTools.genMemorySearch, "function");
  assert.equal(typeof genTools.genMemorySave, "function");
  assert.equal(typeof localgptConfig.resolveLocalGptConfig, "function");
  assert.equal(typeof localgptWorkspace.assertInsideWorkspace, "function");
  assert.equal(typeof localgptWorkspace.inspectWorkspaceFiles, "function");
  assert.equal(typeof designLogSearch.searchDesignLog, "function");
  assert.equal(typeof designLogRead.readDesignLogRange, "function");
  assert.equal(typeof designLogWrite.saveDesignLog, "function");
  assert.equal(typeof commandInput.promptForCommandInput, "function");
});
