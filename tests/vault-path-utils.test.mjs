import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

const vaultPathUtils = await import("../lib/vault-path-utils.ts");

const { VAULT_PROJECTS_SEGMENT } = vaultPathUtils;

/**
 * Stand-in for the module-specific error classes the real callers pass in
 * (`VaultScreenshotPathError`, `VaultPromptPackPathError`), so the tests can
 * assert that every rejection flows through the supplied factory.
 */
class TestVaultPathError extends Error {
  constructor(message) {
    super(message);
    this.name = "TestVaultPathError";
  }
}

const createError = (message) => new TestVaultPathError(message);

const pathErrorWithMessage = (expectedMessage) => (error) => {
  assert.ok(error instanceof TestVaultPathError, "expected the caller-supplied error type");
  assert.equal(error.message, expectedMessage);
  return true;
};

const pathError = (error) => {
  assert.ok(error instanceof TestVaultPathError, "expected the caller-supplied error type");
  return true;
};

const vaultRoot = path.resolve("/vault");

/** Number of segments between the vault root and `directory`. */
const distanceFromVault = (directory) =>
  path.relative(vaultRoot, directory).split(path.sep).filter(Boolean).length;

const traversal = (depth) => Array.from({ length: depth }, () => "..").join(path.sep);

/** A filename that climbs `depth` levels above the directory it is joined into. */
const escapingFilename = (depth) => `${traversal(depth)}${path.sep}outside.png`;

const projectDirectory = (subdir = "") =>
  path.join(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "demo", subdir);

test("VAULT_PROJECTS_SEGMENT is the documented vault projects folder", () => {
  assert.equal(VAULT_PROJECTS_SEGMENT, "4_Project");
});

test("sanitizeVaultPathSegment trims, replaces reserved characters and separator runs", () => {
  const sanitize = vaultPathUtils.sanitizeVaultPathSegment;

  assert.equal(sanitize(" Demo:World ", createError), "Demo-World");
  assert.equal(
    sanitize(' a < b > c : " d | e ? f * g ', createError),
    "a-b-c-d-e-f-g",
  );
  assert.equal(sanitize("a\\b/c", createError), "a-b-c");
  assert.equal(sanitize("a\u0000b\u001fc", createError), "a-b-c");
  assert.equal(sanitize("world.2026", createError), "world.2026");
});

test("sanitizeVaultPathSegment collapses whitespace, hyphen runs and edge hyphens", () => {
  const sanitize = vaultPathUtils.sanitizeVaultPathSegment;

  assert.equal(sanitize("a \t\n  b", createError), "a-b");
  assert.equal(sanitize("a---b", createError), "a-b");
  assert.equal(sanitize(" - trimmed - ", createError), "trimmed");
  assert.equal(sanitize("2026 world 01", createError), "2026-world-01");
});

test("sanitizeVaultPathSegment rejects empty, dot segments and all-reserved input", () => {
  const sanitize = vaultPathUtils.sanitizeVaultPathSegment;

  assert.throws(
    () => sanitize("   ", createError),
    pathErrorWithMessage("Path segment cannot be empty"),
  );
  for (const raw of [" . ", " .. ", ".", ".."]) {
    assert.throws(
      () => sanitize(raw, createError),
      pathErrorWithMessage(`Invalid path segment after sanitization: ${raw}`),
    );
  }
  // reserved characters only: sanitized down to "-", which is then stripped
  assert.throws(
    () => sanitize("///", createError),
    pathErrorWithMessage("Invalid path segment after sanitization: ///"),
  );
  assert.throws(
    () => sanitize('<>:"|?*', createError),
    pathError,
  );
});

test("resolveProjectVaultDirectory nests mixed-slash project and subdirectory segments", () => {
  assert.equal(
    vaultPathUtils.resolveProjectVaultDirectory(
      vaultRoot,
      " OSS / Demo:World ",
      "renders\\drafts",
      createError,
    ),
    path.join(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "Demo-World", "renders", "drafts"),
  );
});

test("resolveProjectVaultDirectory keeps the project root when the subdirectory is empty", () => {
  const expected = path.join(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "demo");

  assert.equal(
    vaultPathUtils.resolveProjectVaultDirectory(vaultRoot, "OSS/demo", "", createError),
    expected,
  );
  // whitespace-only subdir is not treated as "no subdir": it sanitizes down to nothing
  assert.throws(
    () => vaultPathUtils.resolveProjectVaultDirectory(vaultRoot, "OSS/demo", "   ", createError),
    pathErrorWithMessage("Path segment cannot be empty"),
  );
});

test("resolveProjectVaultDirectory rejects traversal in the project slug or subdirectory", () => {
  assert.throws(
    () => vaultPathUtils.resolveProjectVaultDirectory(vaultRoot, "../escape", "screens", createError),
    pathErrorWithMessage("Invalid path segment after sanitization: .."),
  );
  assert.throws(
    () => vaultPathUtils.resolveProjectVaultDirectory(vaultRoot, "OSS/../../escape", "", createError),
    pathErrorWithMessage("Invalid path segment after sanitization: .."),
  );
  assert.throws(
    () => vaultPathUtils.resolveProjectVaultDirectory(vaultRoot, "OSS/demo", "../escape", createError),
    pathErrorWithMessage("Invalid path segment after sanitization: .."),
  );
  assert.throws(
    () => vaultPathUtils.resolveProjectVaultDirectory(vaultRoot, "OSS/demo", "screens\\..\\..\\escape", createError),
    pathErrorWithMessage("Invalid path segment after sanitization: .."),
  );
});

test("resolveVaultFilePath returns the absolute path and a forward-slash vault-relative path", () => {
  const directory = projectDirectory("screenshots");

  const result = vaultPathUtils.resolveVaultFilePath(
    vaultRoot,
    directory,
    "shot.png",
    createError,
  );

  assert.equal(result.absolutePath, path.join(directory, "shot.png"));
  assert.equal(
    result.vaultRelativePath,
    `${VAULT_PROJECTS_SEGMENT}/OSS/demo/screenshots/shot.png`,
  );
  assert.doesNotMatch(result.vaultRelativePath, /\\/, "vault-relative paths use forward slashes");
});

test("resolveVaultFilePath rejects a filename that traverses above the vault root", () => {
  const directory = projectDirectory("screenshots");
  const escaping = escapingFilename(distanceFromVault(directory) + 1);

  assert.throws(
    () => vaultPathUtils.resolveVaultFilePath(vaultRoot, directory, escaping, createError),
    pathErrorWithMessage(`Path escapes vault root: ${path.join(directory, escaping)}`),
  );
});

test("resolveVaultFilePath rejects a sibling directory that only shares the vault prefix", () => {
  const directory = path.join(vaultRoot, "..", `${path.basename(vaultRoot)}-sibling`);
  assert.ok(
    !`${path.resolve(directory)}${path.sep}`.startsWith(`${path.resolve(vaultRoot)}${path.sep}`),
    "fixture must be a sibling of the vault, not inside it",
  );

  assert.throws(
    () => vaultPathUtils.resolveVaultFilePath(vaultRoot, directory, "shot.png", createError),
    pathError,
  );
});

test("resolveVaultFilePath keeps a traversal that stays inside the vault", () => {
  const directory = projectDirectory("screenshots");
  const parent = path.join(directory, "..");

  const result = vaultPathUtils.resolveVaultFilePath(vaultRoot, parent, "still-inside.png", createError);

  assert.equal(result.absolutePath, path.join(projectDirectory(), "still-inside.png"));
  assert.equal(
    result.vaultRelativePath,
    `${VAULT_PROJECTS_SEGMENT}/OSS/demo/still-inside.png`,
  );
});

test("parseVaultContextFromWorkspace splits at the last 4_Project segment", () => {
  const parse = vaultPathUtils.parseVaultContextFromWorkspace;

  assert.deepEqual(parse(path.join(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "demo")), {
    vaultRoot,
    projectSlug: "OSS/demo",
  });
  assert.deepEqual(
    parse(path.join(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", VAULT_PROJECTS_SEGMENT, "demo")),
    {
      vaultRoot: path.join(vaultRoot, VAULT_PROJECTS_SEGMENT, "OSS"),
      projectSlug: "demo",
    },
  );
});

test("parseVaultContextFromWorkspace returns null outside a project workspace", () => {
  const parse = vaultPathUtils.parseVaultContextFromWorkspace;

  assert.equal(parse(path.join(vaultRoot, "OSS", "demo")), null, "no 4_Project segment");
  assert.equal(parse(path.join(vaultRoot, VAULT_PROJECTS_SEGMENT)), null, "4_Project is the last segment");
  assert.equal(parse(vaultRoot), null, "vault root itself");
});

test("containment comparison supports case folding only on win32", (t) => {
  if (process.platform !== "win32") {
    t.skip("case-insensitive containment is a win32-only guarantee");
    return;
  }

  const caseVaultRoot = path.resolve("vault-case-fold-demo");
  const upperVaultRoot = caseVaultRoot.toUpperCase();
  assert.notEqual(upperVaultRoot, caseVaultRoot, "fixture needs a case difference to be meaningful");

  const directory = path.join(upperVaultRoot, VAULT_PROJECTS_SEGMENT, "OSS", "demo", "screenshots");
  const result = vaultPathUtils.resolveVaultFilePath(caseVaultRoot, directory, "shot.png", createError);

  assert.equal(result.absolutePath, path.join(directory, "shot.png"));
  assert.equal(result.vaultRelativePath, "4_Project/OSS/demo/screenshots/shot.png");

  // case folding must not weaken the escape check
  const escaping = escapingFilename(distanceFromVault(directory) + 1);
  assert.throws(
    () => vaultPathUtils.resolveVaultFilePath(caseVaultRoot, directory, escaping, createError),
    pathError,
  );
});
