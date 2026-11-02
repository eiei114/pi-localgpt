import assert from "node:assert/strict";
import test from "node:test";

const { truncatePlanDescription } = await import("../lib/vault-note-plan-layout.ts");
const { truncatePrototypeDescription } = await import("../lib/roblox-trend-prototype.ts");

const suffix = "\n\n[truncated for gen_plan_layout]";
const description = "abc  def and a longer prompt description";

test("vault notes and Roblox prompts retain the same gen_plan_layout truncation contract", () => {
  for (const maxChars of [20, suffix.length, suffix.length + 5, description.length]) {
    const noteResult = truncatePlanDescription(description, maxChars);
    const prototypeResult = truncatePrototypeDescription(description, maxChars);

    assert.deepEqual(prototypeResult, noteResult);
    assert.ok(noteResult.text.length <= maxChars);
  }

  assert.deepEqual(truncatePlanDescription(description, 20), {
    text: description.slice(0, 20),
    truncated: true,
  });
  assert.deepEqual(truncatePlanDescription(description, suffix.length), {
    text: description.slice(0, suffix.length),
    truncated: true,
  });
  assert.deepEqual(truncatePlanDescription(description, suffix.length + 5), {
    text: `abc${suffix}`,
    truncated: true,
  });
  assert.deepEqual(truncatePlanDescription(description, description.length), {
    text: description,
    truncated: false,
  });
});
