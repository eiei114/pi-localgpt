#!/usr/bin/env node
/**
 * Count top-level node:test cases under tests/*.test.mjs.
 *
 * Matches how `node --test tests/*.test.mjs` reports pass counts: only
 * top-level `test(` declarations are counted, not nested subtests.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function countNodeTestCases(root = process.cwd()) {
  const testDir = join(root, "tests");
  const files = readdirSync(testDir).filter((file) => file.endsWith(".test.mjs"));

  return files.reduce((total, file) => {
    const lines = readFileSync(join(testDir, file), "utf8").split("\n");
    const cases = lines.filter((line) => /^\s*test\s*\(/.test(line)).length;
    return total + cases;
  }, 0);
}

function main() {
  const count = countNodeTestCases();
  console.log(`node-test-cases: ${count}`);
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main();
}
