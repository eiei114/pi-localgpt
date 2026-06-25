import assert from "node:assert/strict";
import test from "node:test";

const { promptForCommandInput } = await import("../lib/command-input.ts");

function mockCtx(inputValue) {
  return {
    ui: {
      input: async () => inputValue,
    },
  };
}

test("promptForCommandInput returns trimmed inline args without prompting", async () => {
  const ctx = mockCtx("should not be used");
  const value = await promptForCommandInput(ctx, "Title", "placeholder", "  inline note  ");
  assert.equal(value, "inline note");
});

test("promptForCommandInput prompts when args are empty", async () => {
  const ctx = mockCtx("  prompted text  ");
  const value = await promptForCommandInput(ctx, "Title", "placeholder", "   ");
  assert.equal(value, "prompted text");
});

test("promptForCommandInput returns undefined when prompt is empty", async () => {
  const ctx = mockCtx("   ");
  const value = await promptForCommandInput(ctx, "Title", "placeholder", "");
  assert.equal(value, undefined);
});

test("promptForCommandInput returns undefined when prompt is cancelled", async () => {
  const ctx = mockCtx(undefined);
  const value = await promptForCommandInput(ctx, "Title", "placeholder", "");
  assert.equal(value, undefined);
});
