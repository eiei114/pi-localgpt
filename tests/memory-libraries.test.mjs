import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

const { resolveLocalGptConfig } = await import("../lib/localgpt-config.ts");
const { assertInsideWorkspace, dailyLogPath, memoryFilePath, workspacePath } = await import("../lib/localgpt-workspace.ts");
const { searchMemory } = await import("../lib/memory-search.ts");
const { readMemoryEntry, readMemoryRange } = await import("../lib/memory-read.ts");
const { logMemory, saveMemory } = await import("../lib/memory-write.ts");

function enoent(filePath) {
  const error = new Error(`ENOENT: ${filePath}`);
  error.code = "ENOENT";
  return error;
}

class MemDirent {
  constructor(name, kind) {
    this.name = name;
    this.kind = kind;
  }
  isDirectory() { return this.kind === "dir"; }
  isFile() { return this.kind === "file"; }
}

class MemFs {
  constructor(files = {}) {
    this.files = new Map();
    this.dirs = new Set();
    for (const [filePath, content] of Object.entries(files)) this.writeInitial(filePath, content);
  }

  normalize(filePath) { return path.resolve(filePath); }

  writeInitial(filePath, content) {
    const normalized = this.normalize(filePath);
    this.files.set(normalized, content);
    this.addDir(path.dirname(normalized));
  }

  addDir(dirPath) {
    let current = this.normalize(dirPath);
    while (!this.dirs.has(current)) {
      this.dirs.add(current);
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  async readFile(filePath, _encoding) {
    const normalized = this.normalize(filePath);
    if (!this.files.has(normalized)) throw enoent(normalized);
    return this.files.get(normalized);
  }

  async readdir(dirPath, _options) {
    const normalized = this.normalize(dirPath);
    if (!this.dirs.has(normalized)) throw enoent(normalized);
    const entries = new Map();
    for (const filePath of this.files.keys()) {
      if (path.dirname(filePath) === normalized) entries.set(path.basename(filePath), "file");
    }
    for (const dir of this.dirs) {
      if (dir !== normalized && path.dirname(dir) === normalized) entries.set(path.basename(dir), "dir");
    }
    return [...entries.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, kind]) => new MemDirent(name, kind));
  }

  async mkdir(dirPath, _options) { this.addDir(dirPath); }

  async appendFile(filePath, data, _encoding) {
    const normalized = this.normalize(filePath);
    this.addDir(path.dirname(normalized));
    this.files.set(normalized, (this.files.get(normalized) ?? "") + data);
  }
}

test("resolveLocalGptConfig reads [memory].workspace from config.toml without spawning localgpt", async () => {
  const configPath = path.resolve("/tmp/localgpt-config/config.toml");
  const fs = new MemFs({
    [configPath]: `
[agent]
default_model = "openai/example"

[memory]
workspace = "../workspace" # relative to config file
`,
  });

  const config = await resolveLocalGptConfig({ configPath, cwd: "/ignored", fs, env: {} });

  assert.equal(config.configFound, true);
  assert.equal(config.workspaceSource, "config");
  assert.equal(config.workspace, path.resolve("/tmp/workspace"));
});

test("resolveLocalGptConfig falls back to XDG default workspace", async () => {
  const fs = new MemFs();
  const config = await resolveLocalGptConfig({
    cwd: "/tmp/project",
    fs,
    env: { XDG_CONFIG_HOME: "/xdg/config", XDG_DATA_HOME: "/xdg/data", LOCALGPT_PROFILE: "work" },
  });

  assert.equal(config.configFound, false);
  assert.equal(config.workspaceSource, "default");
  assert.equal(config.configPath, path.resolve("/xdg/config/localgpt-work/config.toml"));
  assert.equal(config.workspace, path.resolve("/xdg/data/localgpt-work/workspace"));
});

test("workspace helpers expose memory paths and block traversal", () => {
  const workspace = path.resolve("/tmp/ws");
  assert.equal(memoryFilePath(workspace), path.join(workspace, "MEMORY.md"));
  assert.equal(dailyLogPath(workspace, "2026-06-16"), path.join(workspace, "memory", "2026-06-16.md"));
  assert.equal(workspacePath(workspace, "memory/project.md"), path.join(workspace, "memory", "project.md"));
  assert.throws(() => assertInsideWorkspace(workspace, path.resolve("/tmp/ws2/evil.md")), /escapes/);
  assert.throws(() => workspacePath(workspace, "../evil.md"), /escapes/);
});

test("searchMemory performs keyword search over workspace markdown only", async () => {
  const workspace = path.resolve("/tmp/ws");
  const fs = new MemFs({
    [path.join(workspace, "MEMORY.md")]: "# Memory\n\nProject uses Rust and Bevy.\nKeep notes concise.",
    [path.join(workspace, "memory", "2026-06-16.md")]: "# Log\n\nDiscussed Bevy terrain generation.",
    [path.join(workspace, "notes.txt")]: "Bevy should not be searched from txt files.",
  });

  const results = await searchMemory({ workspace, query: "bevy", fs, contextLines: 0, limit: 5 });

  assert.equal(results.length, 2);
  assert.deepEqual(results.map((result) => result.file).sort(), ["MEMORY.md", "memory/2026-06-16.md"]);
  assert.ok(results[0].id.includes(":"));
  assert.ok(results.every((result) => result.content.toLowerCase().includes("bevy")));
});

test("readMemoryRange and readMemoryEntry read guarded 1-based line ranges", async () => {
  const workspace = path.resolve("/tmp/ws");
  const fs = new MemFs({
    [path.join(workspace, "MEMORY.md")]: "one\ntwo\nthree\nfour",
  });

  const range = await readMemoryRange({ workspace, file: "MEMORY.md", startLine: 2, endLine: 3, fs });

  assert.equal(range.id, "MEMORY.md:2-3");
  assert.equal(range.content, "two\nthree");

  const entry = await readMemoryEntry(workspace, range.id, fs);
  assert.deepEqual(entry, range);
  await assert.rejects(() => readMemoryRange({ workspace, file: "../outside.md", fs }), /escapes/);
});

test("saveMemory and logMemory append through fs and return readable ids", async () => {
  const workspace = path.resolve("/tmp/ws");
  const fs = new MemFs({ [path.join(workspace, "MEMORY.md")]: "# Memory\n" });
  const now = new Date("2026-06-16T04:05:06.000Z");

  const saved = await saveMemory({ workspace, title: "Project", content: "Use TypeScript modules.", now, fs });
  const logged = await logMemory({ workspace, content: "Implemented memory libraries.", now, fs });

  assert.equal(saved.file, "MEMORY.md");
  assert.ok(saved.appended.includes("## Project"));
  assert.equal(logged.file, "memory/2026-06-16.md");
  assert.ok(logged.appended.includes("## 04:05:06"));

  const savedEntry = await readMemoryEntry(workspace, saved.id, fs);
  const loggedEntry = await readMemoryEntry(workspace, logged.id, fs);
  assert.ok(savedEntry.content.includes("## Project"));
  assert.ok(savedEntry.content.includes("Use TypeScript modules."));
  assert.ok(loggedEntry.content.includes("## 04:05:06"));
  assert.ok(loggedEntry.content.includes("Implemented memory libraries."));
});
