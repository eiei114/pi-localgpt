import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

const { inspectLocalGptStatus, formatLocalGptStatus, statusNotificationLevel } = await import("../lib/localgpt-status.ts");
const { inspectWorkspaceFiles } = await import("../lib/localgpt-workspace.ts");

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
