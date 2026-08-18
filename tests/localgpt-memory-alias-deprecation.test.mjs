import assert from "node:assert/strict";
import test from "node:test";

const {
  LOCALGPT_MEMORY_ALIAS_REMOVAL_VERSION,
  LOCALGPT_MEMORY_ALIAS_TOOL_NAMES,
  deprecationSuffixFor,
  replacementForMemoryAlias,
  resetMemoryAliasDeprecationWarningsForTests,
  warnOnceOnMemoryAliasUse,
} = await import("../lib/localgpt-memory-alias-deprecation.ts");

test("replacementForMemoryAlias maps all legacy tools", () => {
  assert.deepEqual(LOCALGPT_MEMORY_ALIAS_TOOL_NAMES.sort(), [
    "localgpt_memory_get",
    "localgpt_memory_log",
    "localgpt_memory_save",
    "localgpt_memory_search",
  ]);

  assert.equal(replacementForMemoryAlias("localgpt_memory_search"), "localgpt_design_log_search");
  assert.equal(replacementForMemoryAlias("localgpt_memory_get"), "localgpt_design_log_get");
  assert.equal(replacementForMemoryAlias("localgpt_memory_save"), "localgpt_design_log_save");
  assert.equal(replacementForMemoryAlias("localgpt_memory_log"), "localgpt_design_log_log");
});

test("deprecationSuffixFor includes removal version and replacement", () => {
  const suffix = deprecationSuffixFor("localgpt_memory_save");
  assert.match(suffix, /localgpt_design_log_save/);
  assert.match(suffix, new RegExp(`v${LOCALGPT_MEMORY_ALIAS_REMOVAL_VERSION}`));
});

test("warnOnceOnMemoryAliasUse emits one stderr warning per process", () => {
  resetMemoryAliasDeprecationWarningsForTests();

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => {
    warnings.push(args.join(" "));
  };

  try {
    warnOnceOnMemoryAliasUse("localgpt_memory_search");
    warnOnceOnMemoryAliasUse("localgpt_memory_log");

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /localgpt_memory_search/);
    assert.match(warnings[0], /localgpt_design_log_search/);
    assert.match(warnings[0], new RegExp(`v${LOCALGPT_MEMORY_ALIAS_REMOVAL_VERSION}`));
  } finally {
    console.warn = originalWarn;
    resetMemoryAliasDeprecationWarningsForTests();
  }
});
