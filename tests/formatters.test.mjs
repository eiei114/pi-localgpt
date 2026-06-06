import assert from "node:assert/strict";
import test from "node:test";

const { formatMemorySearchResults } = await import("../lib/formatters.ts");

test("formatMemorySearchResults renders hits", () => {
  const text = formatMemorySearchResults(
    [{ path: "MEMORY.md", lineStart: 1, lineEnd: 2, content: "hello", score: 1 }],
    "hello",
  );

  assert.match(text, /MEMORY\.md/);
  assert.match(text, /hello/);
});
