import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { countTopLevelTestCalls } from "../scripts/count-node-test-cases.mjs";

const fixture = (name) =>
  readFileSync(join("tests", "fixtures", "count-node-test-cases", name), "utf8");

test("countTopLevelTestCalls counts only module-level test declarations", () => {
  const source = `
import test from "node:test";

test("top-level", () => {});

if (true) {
  test("inside-if", () => {});
}

test("parent", async (t) => {
  test("nested callback", () => {});
  await t.test("subtest", () => {});
});
`;

  assert.equal(countTopLevelTestCalls(source), 3);
});

test("countTopLevelTestCalls ignores comments and string-like text", () => {
  const source = `
import test from "node:test";

// test("comment", () => {});
/* test("block-comment", () => {}); */
const note = "test('string', () => {});";
const template = \`test('template', () => {});\`;

test("real", () => {});
`;

  assert.equal(countTopLevelTestCalls(source), 1);
});

test("countTopLevelTestCalls ignores describe/suite nested declarations", () => {
  const source = fixture("nested-suite.test.mjs");
  assert.equal(countTopLevelTestCalls(source), 1);
});

test("countTopLevelTestCalls ignores template-literal nested test declarations", () => {
  const source = `
import test from "node:test";

const layout = \`
  describe("suite", () => {
    test("inside-template", () => {});
  });
\`;

test("real", () => {});
`;

  assert.equal(countTopLevelTestCalls(source), 1);
});
