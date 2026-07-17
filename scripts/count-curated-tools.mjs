#!/usr/bin/env node
/**
 * Count curated Pi tools registered in extensions/index.ts.
 *
 * Canonical definition (ROADMAP Seed 2):
 * genToolMeta entries minus localgpt_design_log_* tools and legacy
 * localgpt_memory_save / localgpt_memory_log aliases.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const LEGACY_ALIASES = new Set(["localgpt_memory_save", "localgpt_memory_log"]);

export function countCuratedTools(extensionsSource) {
  const start = extensionsSource.indexOf("const genToolMeta = [");
  if (start < 0) {
    throw new Error("genToolMeta array not found in extensions/index.ts");
  }

  const end = extensionsSource.indexOf("];", start);
  if (end < 0) {
    throw new Error("genToolMeta array is not closed in extensions/index.ts");
  }

  const block = extensionsSource.slice(start, end);
  const names = [...block.matchAll(/\{ name: "([^"]+)"/g)].map((match) => match[1]);
  const designLogCount = names.filter((name) => name.startsWith("localgpt_design_log_")).length;
  const legacyCount = names.filter((name) => LEGACY_ALIASES.has(name)).length;

  return names.length - designLogCount - legacyCount;
}

export function loadCuratedToolCount(root = process.cwd()) {
  const source = readFileSync(`${root}/extensions/index.ts`, "utf8");
  return countCuratedTools(source);
}

function main() {
  const count = loadCuratedToolCount();
  console.log(`curated-tools: ${count}`);
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main();
}
