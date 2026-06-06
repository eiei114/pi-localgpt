import assert from "node:assert/strict";
import test from "node:test";

const { readWorkspaceMemory } = await import("../lib/memory-read.ts");
const { appendMemoryLog, appendMemorySave } = await import("../lib/memory-write.ts");
const { resolveWorkspaceRelativePath } = await import("../lib/localgpt-workspace.ts");

test("readWorkspaceMemory returns a line range", async () => {
  const result = await readWorkspaceMemory({
    workspacePath: "/ws",
    path: "MEMORY.md",
    startLine: 2,
    endLine: 3,
    platform: "linux",
    readText: async () => "line1\nline2\nline3\n",
  });

  assert.equal(result.content, "line2\nline3");
});

test("resolveWorkspaceRelativePath blocks traversal", () => {
  assert.throws(
    () => resolveWorkspaceRelativePath("/ws", "../secret.md", "linux"),
    /outside LocalGPT workspace/,
  );
});

test("appendMemorySave and appendMemoryLog write under workspace", async () => {
  const writes = new Map();

  const append = async (path, data) => {
    writes.set(path, `${writes.get(path) ?? ""}${data}`);
  };

  await appendMemorySave({
    workspacePath: "/ws",
    content: "Long-term note",
    platform: "linux",
    append,
    ensureDir: async () => {},
  });

  await appendMemoryLog({
    workspacePath: "/ws",
    content: "Daily note",
    platform: "linux",
    now: new Date("2026-06-06T14:30:00"),
    append,
    ensureDir: async () => {},
  });

  assert.match(writes.get("/ws/MEMORY.md"), /Long-term note/);
  assert.match(writes.get("/ws/memory/2026-06-06.md"), /Daily note/);
  assert.match(writes.get("/ws/memory/2026-06-06.md"), /## 14:30/);
});
