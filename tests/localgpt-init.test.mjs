import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { initLocalgptWorkspace } = await import("../lib/localgpt-init.ts");

test("initLocalgptWorkspace creates workspace dir, MEMORY.md, and memory/", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "pi-localgpt-init-"));
  const workspace = join(tmp, "ws");

  process.env.LOCALGPT_WORKSPACE = workspace;

  try {
    const result = await initLocalgptWorkspace();

    assert.equal(result.workspacePath, workspace);
    assert.ok(result.createdDirs.some((d) => d === workspace));
    assert.ok(result.createdDirs.some((d) => d.endsWith("memory")));

    // MEMORY.md exists
    const md = await stat(join(workspace, "MEMORY.md"));
    assert.ok(md.isFile());

    // memory/ dir exists
    const mem = await stat(join(workspace, "memory"));
    assert.ok(mem.isDirectory());
  } finally {
    delete process.env.LOCALGPT_WORKSPACE;
    await rm(tmp, { recursive: true, force: true });
  }
});

test("initLocalgptWorkspace is idempotent (second call skips)", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "pi-localgpt-init-"));
  const workspace = join(tmp, "ws2");

  process.env.LOCALGPT_WORKSPACE = workspace;

  try {
    await initLocalgptWorkspace();
    const result2 = await initLocalgptWorkspace();

    assert.ok(result2.skipped.length >= 1, "second call should skip existing items");
  } finally {
    delete process.env.LOCALGPT_WORKSPACE;
    await rm(tmp, { recursive: true, force: true });
  }
});
