import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

const {
  buildScreenshotFilename,
  ensureScreenshotDirectory,
  parseVaultContextFromWorkspace,
  prepareVaultScreenshotExport,
  resolveProjectScreenshotsDirectory,
  resolveVaultScreenshotPath,
  sanitizePathSegment,
  VaultScreenshotPathError,
} = await import("../lib/vault-screenshot-export.ts");

function createMockSpawn(responses) {
  let callCount = 0;
  const messages = [];

  return {
    spawnFn: (_command, _args, _opts) => {
      callCount++;
      const emitter = new EventEmitter();
      const stdout = Readable({ read() {} });
      const origPush = stdout.push.bind(stdout);
      const pushLine = (line) => {
        origPush(line + "\n");
      };

      const stdin = {
        write: (data, cb) => {
          try {
            const msg = JSON.parse(data.trim());
            messages.push(msg);
            const key = msg.method === "tools/call" ? msg.params?.name : msg.method;
            const response = responses.get(key) ?? responses.get(msg.method);
            if (response !== undefined) {
              setTimeout(() => {
                pushLine(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: response }));
              }, 10);
            }
          } catch {}
          cb?.(null);
        },
        end: () => {},
      };

      emitter.pid = 12345;
      emitter.killed = false;
      emitter.stdout = stdout;
      emitter.stdin = stdin;
      emitter.stderr = new EventEmitter();
      emitter.kill = () => { emitter.killed = true; };
      return emitter;
    },
    get callCount() { return callCount; },
    get messages() { return messages; },
  };
}

test("parseVaultContextFromWorkspace infers vault root and project slug", () => {
  const workspace = path.resolve("/vault/4_Project/OSS/pi-localgpt");
  assert.deepEqual(parseVaultContextFromWorkspace(workspace), {
    vaultRoot: path.resolve("/vault"),
    projectSlug: "OSS/pi-localgpt",
  });
});

test("parseVaultContextFromWorkspace returns null outside 4_Project", () => {
  assert.equal(parseVaultContextFromWorkspace("/tmp/localgpt/workspace"), null);
});

test("resolveProjectScreenshotsDirectory builds vault-safe project path", () => {
  const directory = resolveProjectScreenshotsDirectory(
    "/vault",
    "OSS/pi-localgpt",
  );

  assert.equal(
    directory,
    path.resolve("/vault/4_Project/OSS/pi-localgpt/screenshots"),
  );
});

test("resolveProjectScreenshotsDirectory rejects backslash traversal", () => {
  assert.throws(
    () => resolveProjectScreenshotsDirectory("/vault", "..\\escape"),
    VaultScreenshotPathError,
  );
});

test("resolveProjectScreenshotsDirectory supports custom screenshots subdir", () => {
  const directory = resolveProjectScreenshotsDirectory(
    "/vault",
    "OSS/pi-localgpt",
    "assets/renders",
  );

  assert.equal(
    directory,
    path.resolve("/vault/4_Project/OSS/pi-localgpt/assets/renders"),
  );
});

test("resolveVaultScreenshotPath preserves world and session context in filename", () => {
  const resolved = resolveVaultScreenshotPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    world: "Forest Demo",
    session: "pi-session-7",
    now: new Date("2026-06-28T05:15:30.000Z"),
  });

  assert.match(resolved.filename, /^2026-06-28T05-15-30-000Z__Forest-Demo__pi-session-7\.png$/);
  assert.equal(
    resolved.vaultRelativePath,
    "4_Project/OSS/pi-localgpt/screenshots/2026-06-28T05-15-30-000Z__Forest-Demo__pi-session-7.png",
  );
});

test("resolveVaultScreenshotPath rejects paths that escape the vault", () => {
  assert.throws(
    () => resolveProjectScreenshotsDirectory("/vault", "../escape"),
    VaultScreenshotPathError,
  );
});

test("sanitizePathSegment normalizes unsafe characters", () => {
  assert.equal(sanitizePathSegment(" hero/world:1 "), "hero-world-1");
  assert.equal(sanitizePathSegment(" hero\\world:1 "), "hero-world-1");
});

test("buildScreenshotFilename works without optional context", () => {
  const filename = buildScreenshotFilename({ now: new Date("2026-06-28T05:15:30.000Z") });
  assert.equal(filename, "2026-06-28T05-15-30-000Z.png");
});

test("ensureScreenshotDirectory creates missing folders", async () => {
  const created = [];
  const mkdirFs = {
    async mkdir(dirPath, options) {
      created.push({ dirPath, options });
    },
  };

  const target = path.resolve("/vault/4_Project/OSS/pi-localgpt/screenshots");
  await ensureScreenshotDirectory(target, mkdirFs);

  assert.deepEqual(created, [{ dirPath: target, options: { recursive: true } }]);
});

test("prepareVaultScreenshotExport infers project from design-log workspace", async () => {
  const workspace = path.resolve("/vault/4_Project/Demo/GameA");
  const mkdirCalls = [];
  const resolved = await prepareVaultScreenshotExport({
    params: { world: "Lobby" },
    workspace,
    now: new Date("2026-06-28T05:15:30.000Z"),
    resolveConfig: async () => ({
      configPath: "/tmp/config.toml",
      configFound: true,
      workspace,
      workspaceSource: "option",
      designLog: { workspace },
    }),
    mkdirFs: {
      async mkdir(dirPath) {
        mkdirCalls.push(dirPath);
      },
    },
  });

  assert.ok(resolved);
  assert.equal(
    resolved.directory,
    path.resolve("/vault/4_Project/Demo/GameA/screenshots"),
  );
  assert.match(resolved.filename, /Lobby/);
  assert.deepEqual(mkdirCalls, [resolved.directory]);
});

test("prepareVaultScreenshotExport supports explicit vault_project override", async () => {
  const resolved = await prepareVaultScreenshotExport({
    params: {
      vault_root: "/vault",
      vault_project: "Roblox/LevelKit",
      session: "review-1",
    },
    resolveConfig: async () => ({
      configPath: "/tmp/config.toml",
      configFound: false,
      workspace: "/tmp/localgpt/workspace",
      workspaceSource: "default",
      designLog: { workspace: "/tmp/localgpt/workspace" },
    }),
    mkdirFs: { async mkdir() {} },
  });

  assert.ok(resolved);
  assert.equal(
    resolved.directory,
    path.resolve("/vault/4_Project/Roblox/LevelKit/screenshots"),
  );
  assert.match(resolved.filename, /review-1/);
});

test("prepareVaultScreenshotExport skips config resolution with explicit vault context", async () => {
  const resolved = await prepareVaultScreenshotExport({
    params: {
      vault_root: "/vault",
      vault_project: "Roblox/LevelKit",
      world: "Lobby",
    },
    resolveConfig: async () => {
      throw new Error("resolveConfig should not be called");
    },
    mkdirFs: { async mkdir() {} },
  });

  assert.ok(resolved);
  assert.equal(
    resolved.directory,
    path.resolve("/vault/4_Project/Roblox/LevelKit/screenshots"),
  );
});

test("prepareVaultScreenshotExport ignores non-string trigger fields", async () => {
  const resolved = await prepareVaultScreenshotExport({
    params: {
      world: 123,
      session: false,
      filename: {},
      screenshots_dir: [],
    },
    resolveConfig: async () => {
      throw new Error("resolveConfig should not be called");
    },
    mkdirFs: { async mkdir() {} },
  });

  assert.equal(resolved, null);
});

test("genExportScreenshot resolves vault path before MCP export", async () => {
  const { genExportScreenshot } = await import("../lib/gen-tools.ts");

  const workspace = path.resolve("/vault/4_Project/OSS/pi-localgpt");
  const expectedPath = path.resolve(
    "/vault/4_Project/OSS/pi-localgpt/screenshots/2026-06-28T05-15-30-000Z__Arena__sess-a.png",
  );

  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_export_screenshot", { path: expectedPath, status: "exported" }],
  ]);
  const mock = createMockSpawn(responses);

  const mkdirCalls = [];
  const result = await genExportScreenshot(
    {
      vault_root: "/vault",
      vault_project: "OSS/pi-localgpt",
      world: "Arena",
      session: "sess-a",
    },
    {
      spawnFn: mock.spawnFn,
      timeoutMs: 5000,
      now: new Date("2026-06-28T05:15:30.000Z"),
      resolveConfig: async () => ({
        configPath: "/tmp/config.toml",
        configFound: true,
        workspace,
        workspaceSource: "option",
        designLog: { workspace },
      }),
      mkdirFs: {
        async mkdir(dirPath) {
          mkdirCalls.push(dirPath);
        },
      },
    },
  );

  assert.ok(result.content[0].text.includes("4_Project/OSS/pi-localgpt/screenshots"));
  assert.equal(mock.callCount, 1);
  assert.deepEqual(mkdirCalls, [path.dirname(expectedPath)]);
  const toolCall = mock.messages.find((msg) => msg.method === "tools/call");
  assert.equal(toolCall?.params?.arguments?.path, expectedPath);
});
