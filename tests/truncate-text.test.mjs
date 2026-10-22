import assert from "node:assert/strict";
import test from "node:test";

import { truncateText } from "../lib/truncate-text.ts";

test("truncateText returns an empty string for a NaN character cap", () => {
  assert.equal(truncateText("long value", Number.NaN), "");
});
