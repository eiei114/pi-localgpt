import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

const {
  VAULT_PROJECTS_SEGMENT,
  parseVaultContextFromWorkspace,
  resolveProjectVaultDirectory,
  resolveVaultFilePath,
  sanitizeVaultPathSegment,
} = await import("../lib/vault-path-utils.ts");

class VaultPathTestError extends Error {}

const createError = (message) => new VaultPathTestError(message);

const vaultRoot = path.resolve("/vault");

test("sanitizeVaultPathSegment trims and replaces reserved characters", () => {
  assert.equal(sanitizeVaultPathSegment("  Demo:World  ", createError), "Demo-World");
  assert.equal(sanitizeVaultPathSegment('<a>b:c"d|e?f*g', createError), "a-b-c-d-e-f-g");
});

test("sanitizeVaultPathSegment collapses separators, whitespace and hyphens", () => {
  assert.equal(sanitizeVaultPathSegment("a / b\\c", createError), "a-b-c");
  assert.equal(sanitizeVaultPathSegment("a    b", createError), "a-b");
  assert.equal(sanitizeVaultPathSegment("--a---b--", createError), "a-b");
});

test("sanitizeVaultPathSegment strips control characters", () => {
  assert.equal(sanitizeVaultPathSegment("bad\u0000name\u001f", createError), "bad-name");
});

test("sanitizeVaultPathSegment rejects empty, dot and all-reserved input", () => {
  assert.throws(() => sanitizeVaultPathSegment("", createError), VaultPathTestError);
  assert.throws(() => sanitizeVaultPathSegment("   ", createError), VaultPathTestError);
  assert.throws(() => sanitizeVaultPathSegment(".", createError), VaultPathTestError);
  assert.throws(() => sanitizeVaultPathSegment("..", createError), VaultPathTestError);
  assert.throws(() => sanitizeVaultPathSegment("<<>>", createError), VaultPathTestError);

  assert.throws(
    () => sanitizeVaultPathSegment("   ", createError),
    /Path segment cannot be empty/,
  );
  assert.throws(
    () => sanitizeVaultPathSegment("..", createError),
    /Invalid path segment after sanitization/,
  );
});

test("resolveProjectVaultDirectory normalizes mixed separators under 4_Project", () => {
  const resolved = resolveProjectVaultDirectory(
    vaultRoot,
    " OSS / Demo:World ",
    "renders\\drafts",
    createError,
  );

  assert.equal(
    resolved,
    path.resolve(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "Demo-World", "renders", "drafts"),
  );
  assert.ok(resolved.startsWith(path.join(vaultRoot, VAULT_PROJECTS_SEGMENT) + path.sep));
});

test("resolveProjectVaultDirectory accepts an empty subdirectory", () => {
  const resolved = resolveProjectVaultDirectory(vaultRoot, "OSS/Demo", "", createError);

  assert.equal(
    path.resolve(resolved),
    path.resolve(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "Demo"),
  );
});

test("resolveProjectVaultDirectory rejects traversal in project or subdir segments", () => {
  assert.throws(
    () => resolveProjectVaultDirectory(vaultRoot, "..", "", createError),
    VaultPathTestError,
  );
  assert.throws(
    () => resolveProjectVaultDirectory(vaultRoot, "OSS/../../escape", "", createError),
    VaultPathTestError,
  );
  assert.throws(
    () => resolveProjectVaultDirectory(vaultRoot, "OSS/Demo", "../escape", createError),
    VaultPathTestError,
  );
  assert.throws(
    () => resolveProjectVaultDirectory(vaultRoot, "OSS", "renders/../../../escape", createError),
    VaultPathTestError,
  );
});

test("resolveVaultFilePath returns the absolute and vault-relative paths", () => {
  const directory = path.resolve(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "demo");
  const { absolutePath, vaultRelativePath } = resolveVaultFilePath(
    vaultRoot,
    directory,
    "shot.png",
    createError,
  );

  assert.equal(absolutePath, path.join(directory, "shot.png"));
  assert.equal(vaultRelativePath, `${VAULT_PROJECTS_SEGMENT}/OSS/demo/shot.png`);
  assert.doesNotMatch(vaultRelativePath, /\\/);
});

test("resolveVaultFilePath rejects filenames that escape the vault root", () => {
  const directory = path.resolve(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS");
  const escapingFilename = path.join("..", "..", "..", "outside.png");
  let captured;

  assert.throws(
    () => {
      try {
        resolveVaultFilePath(vaultRoot, directory, escapingFilename, createError);
      } catch (error) {
        captured = error;
        throw error;
      }
    },
    VaultPathTestError,
  );
  assert.match(captured.message, /Path escapes vault root/);
});

test("parseVaultContextFromWorkspace splits on the 4_Project segment", () => {
  assert.deepEqual(
    parseVaultContextFromWorkspace(path.join(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "demo")),
    { vaultRoot, projectSlug: "OSS/demo" },
  );
});

test("parseVaultContextFromWorkspace rejects workspaces outside the project segment", () => {
  assert.equal(
    parseVaultContextFromWorkspace(path.join(vaultRoot, "3_Notes", "demo")),
    null,
  );
  assert.equal(
    parseVaultContextFromWorkspace(path.join(vaultRoot, VAULT_PROJECTS_SEGMENT)),
    null,
  );
});

test("parseVaultContextFromWorkspace uses the last 4_Project occurrence", () => {
  assert.deepEqual(
    parseVaultContextFromWorkspace(
      path.join(vaultRoot, VAULT_PROJECTS_SEGMENT, "old", VAULT_PROJECTS_SEGMENT, "new"),
    ),
    { vaultRoot: path.resolve(vaultRoot, VAULT_PROJECTS_SEGMENT, "old"), projectSlug: "new" },
  );
});

test(
  "vault containment is case-insensitive on win32",
  { skip: process.platform !== "win32" },
  () => {
    const mixedCaseVault = "C:\\VaultCaseRoot";
    const lowerCaseDirectory = "c:\\vaultcaseroot\\4_Project\\demo";

    const resolved = resolveProjectVaultDirectory(
      mixedCaseVault,
      "OSS",
      "",
      createError,
    );
    assert.equal(resolved, path.resolve(mixedCaseVault, VAULT_PROJECTS_SEGMENT, "OSS"));

    const { absolutePath } = resolveVaultFilePath(
      mixedCaseVault,
      lowerCaseDirectory,
      "shot.png",
      createError,
    );
    assert.equal(absolutePath, path.resolve(lowerCaseDirectory, "shot.png"));
  },
);
