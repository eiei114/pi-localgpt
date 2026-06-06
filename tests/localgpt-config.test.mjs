import assert from "node:assert/strict";
import test from "node:test";

const {
  expandUserPath,
  getDefaultWorkspacePath,
  getLocalgptConfigPath,
  parseMemoryWorkspaceFromConfig,
  resolveLocalgptPaths,
} = await import("../lib/localgpt-config.ts");

test("getLocalgptConfigPath uses XDG layout on Unix", () => {
  const path = getLocalgptConfigPath("linux", { HOME: "/home/alice" });
  assert.equal(path, "/home/alice/.config/localgpt/config.toml");
});

test("getLocalgptConfigPath uses APPDATA on Windows", () => {
  const path = getLocalgptConfigPath("win32", { APPDATA: "C:\\Users\\alice\\AppData\\Roaming" });
  assert.equal(path, "C:\\Users\\alice\\AppData\\Roaming\\localgpt\\config.toml");
});

test("parseMemoryWorkspaceFromConfig reads workspace from [memory]", () => {
  const text = `
[agent]
default_model = "claude-cli/opus"

[memory]
workspace = "~/notes/localgpt"
`;

  assert.equal(parseMemoryWorkspaceFromConfig(text), "~/notes/localgpt");
});

test("resolveLocalgptPaths expands configured workspace", async () => {
  const paths = await resolveLocalgptPaths({
    platform: "linux",
    env: { HOME: "/home/alice" },
    exists: async (path) => path === "/home/alice/.config/localgpt/config.toml",
    readText: async () => "[memory]\nworkspace = \"~/workspace\"\n",
  });

  assert.equal(paths.configExists, true);
  assert.equal(paths.workspaceFromConfig, true);
  assert.equal(paths.workspacePath, "/home/alice/workspace");
});

test("resolveLocalgptPaths falls back to default workspace", async () => {
  const paths = await resolveLocalgptPaths({
    platform: "linux",
    env: { HOME: "/home/alice" },
    exists: async () => false,
  });

  assert.equal(paths.configExists, false);
  assert.equal(paths.workspacePath, "/home/alice/.local/share/localgpt/workspace");
});

test("expandUserPath expands tilde and env vars", () => {
  assert.equal(expandUserPath("~/data", "linux", { HOME: "/home/alice" }), "/home/alice/data");
  assert.equal(expandUserPath("${DATA}/ws", "linux", { DATA: "/srv" }), "/srv/ws");
});
