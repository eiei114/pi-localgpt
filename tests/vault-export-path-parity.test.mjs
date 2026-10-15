import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

const screenshot = await import("../lib/vault-screenshot-export.ts");
const promptPack = await import("../lib/vault-prompt-pack-export.ts");

test("vault exports normalize nested project and subdirectory paths consistently", () => {
  const expected = path.resolve("/vault/4_Project/OSS/Demo-World/renders/drafts");

  assert.equal(
    screenshot.resolveProjectScreenshotsDirectory(
      "/vault",
      " OSS / Demo:World ",
      "renders\\drafts",
    ),
    expected,
  );
  assert.equal(
    promptPack.resolveProjectPromptPacksDirectory(
      "/vault",
      " OSS / Demo:World ",
      "renders\\drafts",
    ),
    expected,
  );
});

test("vault exports retain their module-specific path errors", () => {
  assert.throws(
    () => screenshot.resolveProjectScreenshotsDirectory("/vault", "../escape"),
    screenshot.VaultScreenshotPathError,
  );
  assert.throws(
    () => promptPack.resolveProjectPromptPacksDirectory("/vault", "../escape"),
    promptPack.VaultPromptPackPathError,
  );
});
