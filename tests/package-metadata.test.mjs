import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadCuratedToolCount } from "../scripts/count-curated-tools.mjs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const readme = readFileSync("README.md", "utf8");
const curatedCount = loadCuratedToolCount();

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
