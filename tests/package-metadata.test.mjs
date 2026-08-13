import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadCuratedToolCount } from "../scripts/count-curated-tools.mjs";
import { countNodeTestCases } from "../scripts/count-node-test-cases.mjs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const readme = readFileSync("README.md", "utf8");
const roadmap = readFileSync("ROADMAP.md", "utf8");
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const publishWorkflow = readFileSync(".github/workflows/publish.yml", "utf8");
const localgptGenSkill = readFileSync("skills/localgpt-gen/SKILL.md", "utf8");
const curatedCount = loadCuratedToolCount();

const readActionVersion = (workflow, action) => {
  const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = workflow.match(
    new RegExp(
      `^\\s*(?:-\\s*)?uses:\\s*${escapedAction}@v(\\d+)\\b`,
      "m",
    ),
  );
  return match?.[1];
};

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("curated tool count uses the genToolMeta canonical definition", () => {
  assert.ok(curatedCount > 0, "expected at least one curated tool");
});

test("README headline matches curated tool count", () => {
  assert.match(
    readme,
    new RegExp(`> ${curatedCount} curated tools for LocalGPT Gen 3D world building`),
  );
});

test("package.json description matches curated tool count", () => {
  assert.match(
    pkg.description,
    new RegExp(`${curatedCount} curated tools for design-log \\+ Gen 3D world building`),
  );
});

test("README pin example matches package.json version", () => {
  assert.match(
    readme,
    new RegExp(`pi install npm:pi-localgpt@${pkg.version}`),
  );
});

test("localgpt-gen skill curated tool count matches canonical definition", () => {
  assert.match(
    localgptGenSkill,
    new RegExp(`${curatedCount} tool`),
  );
});

test("ROADMAP current state matches package.json version", () => {
  assert.match(
    roadmap,
    new RegExp(
      `^\\| Latest release \\| \\*\\*\\x60v${escapeRegExp(pkg.version)}\\x60\\*\\*`,
      "m",
    ),
  );
});

test("ROADMAP current state matches curated tool count", () => {
  assert.match(
    roadmap,
    new RegExp(
      `^\\| Tool surface \\| \\*\\*${curatedCount} curated gen wrappers\\b`,
      "m",
    ),
  );
});

test("ROADMAP current state matches node:test case count", () => {
  const nodeTestCount = countNodeTestCases();
  assert.ok(nodeTestCount > 0, "expected at least one node:test case");

  const backtick = "`";
  assert.match(
    roadmap,
    new RegExp(
      `^\\| Code health \\| .+\\*\\*${nodeTestCount} ${backtick}node:test${backtick} cases\\*\\*`,
      "m",
    ),
  );
});

test("ROADMAP current state matches CI workflow action versions", () => {
  const checkoutVersion = readActionVersion(ciWorkflow, "actions/checkout");
  const setupNodeVersion = readActionVersion(ciWorkflow, "actions/setup-node");
  const publishCheckoutVersion = readActionVersion(
    publishWorkflow,
    "actions/checkout",
  );
  const publishSetupNodeVersion = readActionVersion(
    publishWorkflow,
    "actions/setup-node",
  );

  assert.ok(checkoutVersion, "ci.yml should pin actions/checkout");
  assert.ok(setupNodeVersion, "ci.yml should pin actions/setup-node");
  assert.ok(
    publishCheckoutVersion,
    "publish.yml should pin actions/checkout",
  );
  assert.equal(
    checkoutVersion,
    publishCheckoutVersion,
    "ci.yml and publish.yml should use the same checkout major",
  );
  assert.equal(
    setupNodeVersion,
    publishSetupNodeVersion,
    "ci.yml and publish.yml should use the same setup-node major",
  );

  assert.match(
    roadmap,
    new RegExp(
      `^\\| CI/Release \\| Node 24 on .+actions/checkout@v${checkoutVersion}.+setup-node@v${setupNodeVersion}`,
      "m",
    ),
  );
});
