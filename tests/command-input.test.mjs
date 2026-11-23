import assert from "node:assert/strict";
import test from "node:test";

const { promptForCommandInput } = await import("../lib/command-input.ts");

function mockCtx(inputValue) {
  return {
    hasUI: true,
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

test("promptForCommandInput skips blank args without a UI", async (t) => {
  const input = t.mock.fn(async () => "unexpected input");
  const ctx = { hasUI: false, ui: { input } };
  for (const args of ["", " \t "]) {
    assert.equal(await promptForCommandInput(ctx, "Title", "placeholder", args), undefined);
  }
  assert.equal(input.mock.callCount(), 0);
});

test("promptForCommandInput returns trimmed inline args without a UI", async (t) => {
  const input = t.mock.fn(async () => "unexpected input");
  const ctx = { hasUI: false, ui: { input } };
  const value = await promptForCommandInput(ctx, "Title", "placeholder", "  inline note  ");
  assert.equal(value, "inline note");
  assert.equal(input.mock.callCount(), 0);
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
