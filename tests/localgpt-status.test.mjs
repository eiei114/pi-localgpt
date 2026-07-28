import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

const { inspectLocalGptStatus, formatLocalGptStatus, statusNotificationLevel } = await import("../lib/localgpt-status.ts");
const { inspectWorkspaceFiles, assertInsideWorkspace, dailyLogPath, designLogFilePath, workspacePath } = await import("../lib/localgpt-workspace.ts");
const { resolveLocalGptConfig } = await import("../lib/localgpt-config.ts");

function enoent(filePath) {
  const error = new Error(`ENOENT: ${filePath}`);
  error.code = "ENOENT";
  return error;
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

test("inspectWorkspaceFiles reports design-log file presence", async () => {
  const workspace = path.resolve("/tmp/ws");
  const designLog = path.join(workspace, "DESIGN-LOG.md");
  const todayLog = path.join(workspace, "design-log", "2026-06-24.md");

  const exists = async (filePath) => filePath === designLog;

  const files = await inspectWorkspaceFiles(workspace, "2026-06-24", exists);

  assert.equal(files.designLog, designLog);
  assert.equal(files.todayLog, todayLog);
  assert.equal(files.designLogExists, true);
  assert.equal(files.todayLogExists, false);
});

test("inspectLocalGptStatus returns setup-needed summary without spawning localgpt", async () => {
  const summary = await inspectLocalGptStatus({
    now: new Date("2026-06-24T12:00:00.000Z"),
    workspaceExists: async () => false,
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.searchMode, "keyword");
  assert.equal(summary.workspaceExists, false);
  assert.equal(summary.files.designLogExists, false);
  assert.equal(summary.files.todayLogExists, false);
  assert.ok(summary.hints.some((hint) => hint.includes("localgpt config init")));
  assert.ok(summary.hints.some((hint) => hint.includes("DESIGN-LOG.md")));
  assert.equal(statusNotificationLevel(summary), "warning");
});

test("inspectLocalGptStatus returns ready summary when design log exists", async () => {
  const workspace = path.resolve("/tmp/ws-ready");
  const designLog = path.join(workspace, "DESIGN-LOG.md");

  const summary = await inspectLocalGptStatus({
    now: new Date("2026-06-24T12:00:00.000Z"),
    workspaceExists: async () => true,
    pathExists: async (filePath) => filePath === designLog,
    resolveConfig: async () => ({
      configPath: "/tmp/config.toml",
      configFound: true,
      workspace,
      workspaceSource: "config",
      designLog: { workspace },
    }),
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.workspaceExists, true);
  assert.equal(summary.files.designLogExists, true);
  assert.match(formatLocalGptStatus(summary), /pi-localgpt status: ready/);
  assert.equal(statusNotificationLevel(summary), "info");
});

test("formatLocalGptStatus mirrors structured fields for humans", async () => {
  const summary = await inspectLocalGptStatus({
    now: new Date("2026-06-24T12:00:00.000Z"),
    workspaceExists: async () => false,
  });
  const text = formatLocalGptStatus(summary);

  assert.match(text, /search_mode: keyword/);
  assert.match(text, new RegExp(`config: ${summary.configPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(text, new RegExp(`workspace: ${summary.workspace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(text, /DESIGN-LOG\.md: missing/);
  assert.match(text, /hints:/);
});
