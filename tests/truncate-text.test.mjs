import assert from "node:assert/strict";
import test from "node:test";

import { truncateText } from "../lib/truncate-text.ts";

const EMOJI = "\u{1F600}";

function hasUnpairedSurrogate(text) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

test("truncateText returns an empty string for a NaN character cap", () => {
  assert.equal(truncateText("long value", Number.NaN), "");
});

test("truncateText returns short input unchanged", () => {
  assert.equal(truncateText("abc", 3), "abc");
  assert.equal(truncateText(EMOJI, 2), EMOJI);
});

test("truncateText returns an empty string for zero or negative caps", () => {
  assert.equal(truncateText("abc", 0), "");
  assert.equal(truncateText("abc", -1), "");
});

test("truncateText keeps ASCII truncation with marker within the cap", () => {
  const out = truncateText("a".repeat(200), 100);
  assert.ok(out.length <= 100);
  const omitted = Number(/truncated (\d+) chars/.exec(out)[1]);
  assert.equal(out.indexOf("\n\n[truncated"), 200 - omitted);
  assert.match(out, /\n\n\[truncated \d+ chars\]$/);
});

test("truncateText never splits an emoji at the content cutoff", () => {
  for (let prefix = 0; prefix < 40; prefix++) {
    const value = "a".repeat(prefix) + EMOJI.repeat(60);
    for (let cap = 1; cap < value.length; cap++) {
      const out = truncateText(value, cap);
      assert.ok(out.length <= cap, `length ${out.length} > cap ${cap}`);
      assert.equal(hasUnpairedSurrogate(out), false, `unpaired surrogate at prefix=${prefix} cap=${cap}`);
    }
  }
});

test("truncateText omitted count matches the kept content", () => {
  const value = "a".repeat(30) + EMOJI.repeat(40);
  const out = truncateText(value, 70);
  const idx = out.indexOf("\n\n[truncated");
  const omitted = Number(/truncated (\d+) chars/.exec(out)[1]);
  assert.equal(idx + omitted, value.length);
  assert.equal(value.startsWith(out.slice(0, idx)), true);
  assert.ok(out.length <= 70);
});

test("truncateText marker-too-large fallback drops a split emoji", () => {
  const three = EMOJI.repeat(3);
  assert.equal(truncateText(three, 1), "");
  assert.equal(truncateText(three, 2), EMOJI);
  assert.equal(truncateText(three, 3), EMOJI);
  assert.equal(truncateText("a" + EMOJI.repeat(2), 2), "a");
});
