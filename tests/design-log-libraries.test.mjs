import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

const { resolveLocalGptConfig } = await import("../lib/localgpt-config.ts");
const { assertInsideWorkspace, dailyLogPath, designLogFilePath, workspacePath } = await import("../lib/localgpt-workspace.ts");
const { searchDesignLog } = await import("../lib/design-log-search.ts");
const { readDesignLogEntry, readDesignLogRange } = await import("../lib/design-log-read.ts");
const { logDesignLog, saveDesignLog } = await import("../lib/design-log-write.ts");

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

test("resolveLocalGptConfig reads [design-log].workspace from config.toml without spawning localgpt", async () => {
  const configPath = path.resolve("/tmp/localgpt-config/config.toml");
  const fs = new MemFs({
    [configPath]: `
[agent]
default_model = "openai/example"

[design-log]
workspace = "../workspace" # relative to config file
`,
  });

  const config = await resolveLocalGptConfig({ configPath, cwd: "/ignored", fs, env: {} });

  assert.equal(config.configFound, true);
  assert.equal(config.workspaceSource, "config");
  assert.equal(config.workspace, path.resolve("/tmp/workspace"));
});

test("resolveLocalGptConfig preserves escaped backslashes in double-quoted workspace strings", async () => {
  const configPath = path.resolve("/tmp/localgpt-config/config.toml");
  const fs = new MemFs({
    [configPath]: String.raw`
[design-log]
workspace = "C:\\Users\\name"
`,
  });

  const config = await resolveLocalGptConfig({ configPath, cwd: "/ignored", fs, env: {} });

  assert.equal(config.workspace, path.resolve("/tmp/localgpt-config", "C:\\Users\\name"));
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

test("workspace helpers expose design-log paths and block traversal", () => {
  const workspace = path.resolve("/tmp/ws");
  assert.equal(designLogFilePath(workspace), path.join(workspace, "DESIGN-LOG.md"));
  assert.equal(dailyLogPath(workspace, "2026-06-16"), path.join(workspace, "design-log", "2026-06-16.md"));
  assert.equal(workspacePath(workspace, "design-log/project.md"), path.join(workspace, "design-log", "project.md"));
  assert.throws(() => assertInsideWorkspace(workspace, path.resolve("/tmp/ws2/evil.md")), /escapes/);
  assert.throws(() => workspacePath(workspace, "../evil.md"), /escapes/);
});

test("searchDesignLog performs keyword search over workspace markdown only", async () => {
  const workspace = path.resolve("/tmp/ws");
  const fs = new MemFs({
    [path.join(workspace, "DESIGN-LOG.md")]: "# Design Log\n\nProject uses Rust and Bevy.\nKeep notes concise.",
    [path.join(workspace, "design-log", "2026-06-16.md")]: "# Log\n\nDiscussed Bevy terrain generation.",
    [path.join(workspace, "notes.txt")]: "Bevy should not be searched from txt files.",
  });

  const results = await searchDesignLog({ workspace, query: "bevy", fs, contextLines: 0, limit: 5 });

  assert.equal(results.length, 2);
  assert.deepEqual(results.map((result) => result.file).sort(), ["DESIGN-LOG.md", "design-log/2026-06-16.md"]);
  assert.ok(results[0].id.includes(":"));
  assert.ok(results.every((result) => result.content.toLowerCase().includes("bevy")));
});

test("readDesignLogRange and readDesignLogEntry read guarded 1-based line ranges", async () => {
  const workspace = path.resolve("/tmp/ws");
  const fs = new MemFs({
    [path.join(workspace, "DESIGN-LOG.md")]: "one\ntwo\nthree\nfour",
  });

  const range = await readDesignLogRange({ workspace, file: "DESIGN-LOG.md", startLine: 2, endLine: 3, fs });

  assert.equal(range.id, "DESIGN-LOG.md:2-3");
  assert.equal(range.content, "two\nthree");

  const entry = await readDesignLogEntry(workspace, range.id, fs);
  assert.deepEqual(entry, range);
  await assert.rejects(() => readDesignLogRange({ workspace, file: "../outside.md", fs }), /escapes/);
});

test("readDesignLogRange returns replayable ids for empty files", async () => {
  const workspace = path.resolve("/tmp/ws");
  const fs = new MemFs({
    [path.join(workspace, "DESIGN-LOG.md")]: "",
  });

  const range = await readDesignLogRange({ workspace, fs });

  assert.equal(range.id, "DESIGN-LOG.md:1-1");
  assert.equal(range.line_start, 1);
  assert.equal(range.line_end, 1);
  assert.equal(range.content, "");

  const replayed = await readDesignLogEntry(workspace, range.id, fs);
  assert.deepEqual(replayed, range);
});

test("saveDesignLog and logDesignLog append through fs and return readable ids", async () => {
  const workspace = path.resolve("/tmp/ws");
  const fs = new MemFs({ [path.join(workspace, "DESIGN-LOG.md")]: "# Design Log\n" });
  const now = new Date("2026-06-16T04:05:06.000Z");

  const saved = await saveDesignLog({ workspace, title: "Project", content: "Use TypeScript modules.", now, fs });
  const logged = await logDesignLog({ workspace, content: "Implemented design-log libraries.", now, fs });

  assert.equal(saved.file, "DESIGN-LOG.md");
  assert.ok(saved.appended.includes("## Project"));
  assert.equal(logged.file, "design-log/2026-06-16.md");
  assert.ok(logged.appended.includes("## 04:05:06"));

  const savedEntry = await readDesignLogEntry(workspace, saved.id, fs);
  const loggedEntry = await readDesignLogEntry(workspace, logged.id, fs);
  assert.ok(savedEntry.content.includes("## Project"));
  assert.ok(savedEntry.content.includes("Use TypeScript modules."));
  assert.ok(loggedEntry.content.includes("## 04:05:06"));
  assert.ok(loggedEntry.content.includes("Implemented design-log libraries."));
});

test("searchDesignLog validates limit and contextLines", async () => {
  const workspace = path.resolve("/tmp/ws");
  const fs = new MemFs({
    [path.join(workspace, "DESIGN-LOG.md")]: "hello world",
  });

  await assert.rejects(() => searchDesignLog({ workspace, query: "hello", fs, limit: -1 }), /Invalid limit/);
  await assert.rejects(() => searchDesignLog({ workspace, query: "hello", fs, contextLines: 1.5 }), /Invalid contextLines/);
});
