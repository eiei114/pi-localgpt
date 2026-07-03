import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const {
  DEFAULT_PROMPT_PACKS_SUBDIR,
  VaultPromptPackPathError,
  buildPromptPackFilename,
  ensurePromptPackDirectory,
  exportPromptPack,
  normalizePackTags,
  prepareVaultPromptPackExport,
  resolveProjectPromptPacksDirectory,
  resolveVaultPromptPackPath,
  shapePromptPackContent,
} = await import("../lib/vault-prompt-pack-export.ts");

const NOW = new Date("2026-06-28T05:15:30.000Z");

function createMemoryFs(seed) {
  const files = seed instanceof Map ? new Map(seed) : new Map(Object.entries(seed ?? {}));
  const dirs = new Set();
  return {
    files,
    dirs,
    async mkdir(dirPath, options) {
      dirs.add(path.resolve(String(dirPath)));
      if (options?.recursive) return undefined;
      return undefined;
    },
    async writeFile(filePath, data, options) {
      const resolved = path.resolve(String(filePath));
      if (options?.flag === "wx" && files.has(resolved)) {
        const err = new Error(`EEXIST: ${resolved}`);
        err.code = "EEXIST";
        throw err;
      }
      files.set(resolved, String(data));
    },
    async stat(filePath) {
      const resolved = path.resolve(String(filePath));
      if (files.has(resolved)) {
        return { isFile: () => true };
      }
      const err = new Error(`ENOENT: ${resolved}`);
      err.code = "ENOENT";
      throw err;
    },
  };
}

test("resolveProjectPromptPacksDirectory builds vault-safe project path", () => {
  const directory = resolveProjectPromptPacksDirectory("/vault", "OSS/pi-localgpt");
  assert.equal(
    directory,
    path.resolve("/vault/4_Project/OSS/pi-localgpt/prompt-packs"),
  );
});

test("resolveProjectPromptPacksDirectory supports a custom subdir", () => {
  const directory = resolveProjectPromptPacksDirectory(
    "/vault",
    "OSS/pi-localgpt",
    "assets/prompt-packs",
  );
  assert.equal(
    directory,
    path.resolve("/vault/4_Project/OSS/pi-localgpt/assets/prompt-packs"),
  );
});

test("resolveProjectPromptPacksDirectory rejects traversal", () => {
  assert.throws(
    () => resolveProjectPromptPacksDirectory("/vault", "../escape"),
    VaultPromptPackPathError,
  );
  assert.throws(
    () => resolveProjectPromptPacksDirectory("/vault", "..\\escape"),
    VaultPromptPackPathError,
  );
});

test("buildPromptPackFilename is deterministic and human-readable", () => {
  assert.equal(
    buildPromptPackFilename({ name: "Forest Lobby", session: "pi-7", now: NOW }),
    "2026-06-28T05-15-30-000Z__Forest-Lobby__pi-7.md",
  );
  assert.equal(
    buildPromptPackFilename({ now: NOW }),
    "2026-06-28T05-15-30-000Z__pack.md",
  );
});

test("resolveVaultPromptPackPath preserves name and session in filename", () => {
  const resolved = resolveVaultPromptPackPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    name: "Forest Demo",
    session: "pi-session-7",
    now: NOW,
  });

  assert.match(resolved.filename, /^2026-06-28T05-15-30-000Z__Forest-Demo__pi-session-7\.md$/);
  assert.equal(
    resolved.vaultRelativePath,
    "4_Project/OSS/pi-localgpt/prompt-packs/2026-06-28T05-15-30-000Z__Forest-Demo__pi-session-7.md",
  );
});

test("resolveVaultPromptPackPath honors a filename override", () => {
  const resolved = resolveVaultPromptPackPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    filename: "forest-lobby.md",
    now: NOW,
  });
  assert.equal(resolved.filename, "forest-lobby.md");
  assert.match(
    resolved.vaultRelativePath,
    /4_Project\/OSS\/pi-localgpt\/prompt-packs\/forest-lobby\.md$/,
  );
});

test("normalizePackTags dedupes and kebab-cases", () => {
  assert.deepEqual(
    normalizePackTags("Forest, Forest, Cool World\nfast"),
    ["forest", "cool-world", "fast"],
  );
  assert.deepEqual(normalizePackTags(["A B", "a-b"]), ["a-b"]);
  assert.deepEqual(normalizePackTags(undefined), []);
});

test("shapePromptPackContent renders frontmatter + sections", () => {
  const content = shapePromptPackContent({
    name: "Forest Lobby",
    description: "A misty forest clearing with a stone altar.",
    style: "nature",
    tags: "forest, altar",
    session: "pi-7",
    projectSlug: "OSS/pi-localgpt",
    now: NOW,
  });

  assert.match(content, /^---\n/);
  assert.match(content, /title: "Forest Lobby"/);
  assert.match(content, /style: "nature"/);
  assert.match(content, /tags: \["forest","altar"\]/);
  assert.match(content, /exported_at: 2026-06-28T05:15:30.000Z/);
  assert.match(content, /session: "pi-7"/);
  assert.match(content, /# Forest Lobby/);
  assert.match(content, /## Description[\s\S]*A misty forest clearing with a stone altar\./);
  assert.match(content, /## Style[\s\S]*nature/);
  assert.match(content, /## Tags[\s\S]*- forest[\s\S]*- altar/);
});

test("shapePromptPackContent rejects empty description", () => {
  assert.throws(
    () => shapePromptPackContent({ description: "   " }),
    VaultPromptPackPathError,
  );
});

test("shapePromptPackContent YAML-quotes values with special characters", () => {
  const content = shapePromptPackContent({
    name: "Forest: Lobby",
    description: "desc",
    style: "nature, dark",
    tags: ["forest tag", "altar"],
    session: "pi:7",
    now: NOW,
  });

  // Colons/commas are enclosed in double-quoted YAML scalars so they cannot
  // break frontmatter parsing or inject extra keys.
  assert.match(content, /title: "Forest: Lobby"/);
  assert.match(content, /style: "nature, dark"/);
  assert.match(content, /tags: \["forest-tag","altar"\]/);
  assert.match(content, /session: "pi:7"/);
  // No unquoted bare-key injection.
  assert.doesNotMatch(content, /\nevil: true/);
});

test("ensurePromptPackDirectory creates missing folders", async () => {
  const created = [];
  await ensurePromptPackDirectory("/vault/4_Project/OSS/pi-localgpt/prompt-packs", {
    async mkdir(dirPath, options) { created.push({ dirPath, options }); },
  });
  assert.deepEqual(created, [
    { dirPath: "/vault/4_Project/OSS/pi-localgpt/prompt-packs", options: { recursive: true } },
  ]);
});

test("prepareVaultPromptPackExport writes a new file into an inferred project folder", async () => {
  const workspace = path.resolve("/vault/4_Project/OSS/pi-localgpt");
  const memfs = createMemoryFs();

  const resolved = await prepareVaultPromptPackExport({
    params: {
      name: "Forest Demo",
      description: "A misty forest clearing.",
      style: "nature",
      tags: ["forest"],
      session: "pi-session-7",
    },
    workspace,
    now: NOW,
    resolveConfig: async () => ({
      configPath: "/tmp/config.toml",
      configFound: true,
      workspace,
      workspaceSource: "option",
      designLog: { workspace },
    }),
    fs: memfs,
  });

  assert.ok(resolved);
  assert.equal(resolved.wrote, true);
  assert.equal(resolved.overwritten, false);
  assert.equal(
    resolved.directory,
    path.resolve("/vault/4_Project/OSS/pi-localgpt/prompt-packs"),
  );
  assert.match(
    resolved.vaultRelativePath,
    /4_Project\/OSS\/pi-localgpt\/prompt-packs\/2026-06-28T05-15-30-000Z__Forest-Demo__pi-session-7\.md$/,
  );
  assert.ok(memfs.files.has(path.resolve(resolved.absolutePath)));
  assert.match(resolved.content, /# Forest Demo/);
});

test("prepareVaultPromptPackExport supports explicit vault_project override", async () => {
  const memfs = createMemoryFs();
  const resolved = await prepareVaultPromptPackExport({
    params: {
      vault_root: "/vault",
      vault_project: "Roblox/LevelKit",
      name: "Neon Obby",
      description: "A neon platforming obby with checkpoints.",
      session: "review-1",
    },
    resolveConfig: async () => ({
      configPath: "/tmp/config.toml",
      configFound: false,
      workspace: "/tmp/localgpt/workspace",
      workspaceSource: "default",
      designLog: { workspace: "/tmp/localgpt/workspace" },
    }),
    fs: memfs,
    now: NOW,
  });

  assert.ok(resolved);
  assert.equal(
    resolved.directory,
    path.resolve("/vault/4_Project/Roblox/LevelKit/prompt-packs"),
  );
  assert.match(resolved.filename, /Neon-Obby/);
});

test("prepareVaultPromptPackExport skips config resolution with explicit vault context", async () => {
  const memfs = createMemoryFs();
  const resolved = await prepareVaultPromptPackExport({
    params: {
      vault_root: "/vault",
      vault_project: "Roblox/LevelKit",
      description: "Lobby layout.",
    },
    resolveConfig: async () => {
      throw new Error("resolveConfig should not be called");
    },
    fs: memfs,
    now: NOW,
  });
  assert.ok(resolved);
  assert.equal(
    resolved.directory,
    path.resolve("/vault/4_Project/Roblox/LevelKit/prompt-packs"),
  );
});

test("prepareVaultPromptPackExport returns null when no trigger fields are set", async () => {
  const resolved = await prepareVaultPromptPackExport({
    params: { tags: [], session: false },
    resolveConfig: async () => {
      throw new Error("resolveConfig should not be called");
    },
    fs: createMemoryFs(),
    now: NOW,
  });
  assert.equal(resolved, null);
});

test("prepareVaultPromptPackExport throws when description is missing", async () => {
  await assert.rejects(
    () => prepareVaultPromptPackExport({
      params: { vault_root: "/vault", vault_project: "OSS/pi-localgpt", name: "NoDesc" },
      fs: createMemoryFs(),
      now: NOW,
    }),
    VaultPromptPackPathError,
  );
});

test("prepareVaultPromptPackExport throws when vault project cannot be inferred", async () => {
  await assert.rejects(
    () => prepareVaultPromptPackExport({
      params: { description: "A forest." },
      workspace: "/tmp/localgpt/workspace",
      resolveConfig: async () => ({
        configPath: "/tmp/config.toml",
        configFound: false,
        workspace: "/tmp/localgpt/workspace",
        workspaceSource: "default",
        designLog: { workspace: "/tmp/localgpt/workspace" },
      }),
      fs: createMemoryFs(),
      now: NOW,
    }),
    VaultPromptPackPathError,
  );
});

test("prepareVaultPromptPackExport refuses to overwrite by default", async () => {
  const existingPath = path.resolve(
    "/vault/4_Project/OSS/pi-localgpt/prompt-packs/forest-demo.md",
  );
  const memfs = createMemoryFs({ [existingPath]: "old content" });

  await assert.rejects(
    () => prepareVaultPromptPackExport({
      params: {
        vault_root: "/vault",
        vault_project: "OSS/pi-localgpt",
        name: "Forest Demo",
        description: "A forest.",
        filename: "forest-demo.md",
      },
      fs: memfs,
      now: NOW,
    }),
    (err) => {
      assert.ok(err instanceof VaultPromptPackPathError);
      assert.match(err.message, /already exists/);
      assert.match(err.message, /overwrite=true/);
      return true;
    },
  );

  // Original content untouched.
  assert.equal(memfs.files.get(existingPath), "old content");
});

test("prepareVaultPromptPackExport replaces the file when overwrite is true", async () => {
  const existingPath = path.resolve(
    "/vault/4_Project/OSS/pi-localgpt/prompt-packs/forest-demo.md",
  );
  const memfs = createMemoryFs({ [existingPath]: "old content" });

  const resolved = await prepareVaultPromptPackExport({
    params: {
      vault_root: "/vault",
      vault_project: "OSS/pi-localgpt",
      name: "Forest Demo",
      description: "A brand new forest.",
      filename: "forest-demo.md",
      overwrite: true,
    },
    fs: memfs,
    now: NOW,
  });

  assert.ok(resolved);
  assert.equal(resolved.overwritten, true);
  assert.equal(resolved.wrote, true);
  assert.notEqual(memfs.files.get(existingPath), "old content");
  assert.match(memfs.files.get(existingPath), /A brand new forest\./);
});

test("exportPromptPack returns a vault-path summary", async () => {
  const memfs = createMemoryFs();
  const result = await exportPromptPack(
    {
      vault_root: "/vault",
      vault_project: "OSS/pi-localgpt",
      name: "Forest Demo",
      description: "A misty forest clearing.",
      session: "pi-session-7",
    },
    {
      fs: memfs,
      now: NOW,
    },
  );

  assert.match(result.content[0].text, /Exported prompt-pack to vault path/);
  assert.match(
    result.details.vaultRelativePath,
    /4_Project\/OSS\/pi-localgpt\/prompt-packs\//,
  );
  assert.equal(result.details.overwritten, false);
});

test("exportPromptPack surfaces overwrite when replacing", async () => {
  const existingPath = path.resolve(
    "/vault/4_Project/OSS/pi-localgpt/prompt-packs/forest-demo.md",
  );
  const memfs = createMemoryFs({ [existingPath]: "old content" });

  const result = await exportPromptPack(
    {
      vault_root: "/vault",
      vault_project: "OSS/pi-localgpt",
      name: "Forest Demo",
      description: "Revised forest.",
      filename: "forest-demo.md",
      overwrite: true,
    },
    {
      fs: memfs,
      now: NOW,
    },
  );

  assert.match(result.content[0].text, /Replaced existing prompt-pack/);
  assert.equal(result.details.overwritten, true);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOGFOOD_FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures/prompt-pack-dogfood-forest-demo.md"),
  "utf8",
);

test("dogfood fixture matches shapePromptPackContent for OSS/pi-localgpt forest demo", () => {
  const content = shapePromptPackContent({
    name: "Forest Demo",
    description: "A misty forest clearing with a stone altar and scattered fog particles.",
    style: "nature",
    tags: ["forest", "altar", "hero-props"],
    session: "dogfood-dot398",
    projectSlug: "OSS/pi-localgpt",
    now: new Date("2026-07-02T10:00:00.000Z"),
  });

  assert.equal(content, DOGFOOD_FIXTURE);
});

test("resolveVaultPromptPackPath supports custom filename with spaces", () => {
  const resolved = resolveVaultPromptPackPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    filename: "my pack.md",
    now: NOW,
  });

  assert.equal(resolved.filename, "my-pack.md");
  assert.equal(
    resolved.vaultRelativePath,
    "4_Project/OSS/pi-localgpt/prompt-packs/my-pack.md",
  );
});

test("resolveVaultPromptPackPath assigns default .md extension when filename lacks one", () => {
  const resolved = resolveVaultPromptPackPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    filename: "lobby-layout",
    now: NOW,
  });

  assert.equal(resolved.filename, "lobby-layout.md");
});

test("resolveVaultPromptPackPath preserves non-md extensions in custom filename", () => {
  const resolved = resolveVaultPromptPackPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    filename: "notes.markdown",
    now: NOW,
  });

  assert.equal(resolved.filename, "notes.markdown");
});

test("resolveVaultPromptPackPath overwrites same timestamp+name+session identity", () => {
  const t = new Date("2026-07-02T10:00:00.000Z");
  const a = resolveVaultPromptPackPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    name: "Forest Demo",
    session: "dogfood-dot398",
    now: t,
  });
  const b = resolveVaultPromptPackPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    name: "Forest Demo",
    session: "dogfood-dot398",
    now: t,
  });

  assert.equal(a.filename, b.filename);
  assert.equal(a.absolutePath, b.absolutePath);

  const c = resolveVaultPromptPackPath({
    vaultRoot: "/vault",
    projectSlug: "OSS/pi-localgpt",
    name: "Forest Demo",
    session: "dogfood-dot398-v2",
    now: t,
  });
  assert.notEqual(a.filename, c.filename);
});

test("buildPromptPackFilename handles whitespace-heavy name and session via sanitize", () => {
  const filename = buildPromptPackFilename({
    name: "  Forest  Demo  ",
    session: "  pi-session  ",
    now: NOW,
  });
  assert.equal(filename, "2026-06-28T05-15-30-000Z__Forest-Demo__pi-session.md");
});

test("prepareVaultPromptPackExport returns null when params are non-triggering types", async () => {
  const resolved = await prepareVaultPromptPackExport({
    params: {
      name: 123,
      session: false,
      filename: {},
      prompt_packs_dir: [],
    },
    resolveConfig: async () => {
      throw new Error("resolveConfig should not be called");
    },
    fs: createMemoryFs(),
    now: NOW,
  });

  assert.equal(resolved, null);
});

test("prepareVaultPromptPackExport reports overwritten false for new filename override", async () => {
  const memfs = createMemoryFs();
  const resolved = await prepareVaultPromptPackExport({
    params: {
      vault_root: "/vault",
      vault_project: "OSS/pi-localgpt",
      name: "Forest Demo",
      description: "First write via filename override.",
      filename: "forest-demo.md",
      overwrite: true,
    },
    fs: memfs,
    now: NOW,
  });

  assert.ok(resolved);
  assert.equal(resolved.overwritten, false);
  assert.equal(resolved.wrote, true);
});
