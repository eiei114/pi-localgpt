import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const releaseWorkflow = await readFile(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publishWorkflow = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");

function getVersionCheckScript() {
  const checkStep = releaseWorkflow.slice(releaseWorkflow.indexOf("      - name: Check for version bump"));
  const script = checkStep.match(/        run: \|\r?\n([\s\S]*?)\r?\n      - name: Create tag and release/)?.[1];
  assert.ok(script, "manual release workflow must include a version check step");
  return script.split(/\r?\n/).map((line) => line.startsWith("          ") ? line.slice(10) : line).join("\n");
}

function assertNoMergeTriggeredRelease(release, publish) {
  const releaseTriggers = release.split("permissions:")[0];
  const publishTriggers = publish.split("permissions:")[0];
  assert.match(releaseTriggers, /on:\r?\n\s+workflow_dispatch:/, "release must be manually triggered only");
  assert.doesNotMatch(releaseTriggers, /^\s+push:/m, "a merge must not start release");
  assert.match(releaseTriggers, /base_ref:[\s\S]*?required: true/, "manual release must require a comparison base");
  assert.match(release, /^\s+if: github\.ref == 'refs\/heads\/main'$/m, "release must be restricted to main");
  assert.match(release, /BASE_REF: \$\{\{ inputs\.base_ref \}\}/, "manual release must use the selected comparison base");
  assert.match(release, /git show "\$\{BASE_COMMIT\}:package\.json"/, "version comparison must read the base package manifest");
  assert.doesNotMatch(release, /github\.event\.before/, "workflow_dispatch has no push-event before SHA");
  assert.match(publishTriggers, /push:\r?\n\s+tags:/, "publishing must remain version-tag gated");
  assert.doesNotMatch(publishTriggers, /branches:|paths:/, "main branch/package edits must not publish");
  assert.match(publishTriggers, /workflow_dispatch:/, "explicit manual publishing remains available");
  assert.match(publish, /npm publish/);
}

test("merging code cannot directly or indirectly trigger npm publish or release", () => {
  assert.doesNotThrow(() => assertNoMergeTriggeredRelease(releaseWorkflow, publishWorkflow));
  assert.throws(() => assertNoMergeTriggeredRelease(
    releaseWorkflow.replace("  workflow_dispatch:", "  push:\n    branches: [main]\n  workflow_dispatch:"), publishWorkflow));
  assert.throws(() => assertNoMergeTriggeredRelease(
    releaseWorkflow, publishWorkflow.replace("    tags:", "    branches: [main]\n    tags:")));
});

test("manual release validates SemVer and compares against the supplied base ref", async () => {
  const pattern = releaseWorkflow.match(/grep -Eq '([^']+)'/)?.[1];
  assert.ok(pattern, "manual release must validate stable SemVer");
  const stableSemver = new RegExp(pattern);
  for (const version of ["0.0.0", "1.4.2", "10.20.300"]) assert.match(version, stableSemver);
  for (const version of ["01.4.2", "1.04.2", "1.4.02", "1.4", "1.4.2-beta"]) assert.doesNotMatch(version, stableSemver);

  const directory = await mkdtemp(join(tmpdir(), "pi-localgpt-release-check-"));
  const outputFile = join(directory, "github-output.txt");
  const script = getVersionCheckScript();

  try {
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    execFileSync("git", ["config", "user.name", "Release check test"], { cwd: directory });
    execFileSync("git", ["config", "user.email", "release-check-test@example.invalid"], { cwd: directory });
    await writeFile(join(directory, "package.json"), JSON.stringify({ version: "0.10.12" }));
    execFileSync("git", ["add", "package.json"], { cwd: directory });
    execFileSync("git", ["commit", "--quiet", "-m", "base version"], { cwd: directory });
    const baseRef = execFileSync("git", ["rev-parse", "HEAD"], { cwd: directory, encoding: "utf8" }).trim();

    await writeFile(join(directory, "package.json"), JSON.stringify({ version: "0.10.13" }));
    execFileSync("git", ["commit", "--quiet", "-am", "bump version"], { cwd: directory });

    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, BASE_REF: baseRef, GITHUB_OUTPUT: outputFile },
    });
    assert.equal(result.status, 0, result.stderr);
    const output = await readFile(outputFile, "utf8");
    assert.match(output, /^released=true$/m);
    assert.match(output, /^tag=v0\.10\.13$/m);

    const invalidBase = spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, BASE_REF: "missing-base-ref", GITHUB_OUTPUT: outputFile },
    });
    assert.notEqual(invalidBase.status, 0);
    assert.match(invalidBase.stderr, /Base ref does not resolve to a commit/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
