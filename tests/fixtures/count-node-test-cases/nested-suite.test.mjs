import test from "node:test";

test("outer", () => {});

function describe(name, fn) {
  fn();
}

describe("suite", () => {
  test("nested-in-suite", () => {});
});
