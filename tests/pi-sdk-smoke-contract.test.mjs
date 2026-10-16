import assert from "node:assert/strict";
import test from "node:test";
import {
  behaviorAssertions,
  parseJsonLines,
  SDK_NAMES,
  SDK_VERSIONS,
  VERIFICATION_CONTRACT,
} from "../scripts/pi-sdk-smoke-contract.mjs";

const commands = {
  id: "commands",
  type: "response",
  command: "get_commands",
  success: true,
  data: { commands: [{ name: "localgpt:status", source: "extension" }] },
};
const prompt = {
  id: "feature",
  type: "response",
  command: "prompt",
  success: true,
  data: { disposition: "handled" },
};
const ready = {
  type: "extension_ui_request",
  method: "notify",
  notifyType: "info",
  message: "pi-localgpt status: ready\nworkspace: isolated",
};
const error = {
  type: "extension_ui_request",
  method: "notify",
  notifyType: "warning",
  message: "Invalid start line. Use positive integers only.",
};
const observe = (responses, overrides = {}) => ({
  responses,
  first_responses: responses,
  stdout: "",
  stderr: "",
  exit_code: 0,
  timed_out: false,
  closed: true,
  first_exit_code: 0,
  first_timed_out: false,
  first_closed: true,
  first_cleanup_failed: false,
  expectedVersion: "1.2.0",
  ...overrides,
});

test("the report contract and frozen Pi SDK set are exact", () => {
  assert.equal(VERIFICATION_CONTRACT, "pi-sdk-behavior-v2");
  assert.deepEqual(SDK_NAMES, [
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
  ]);
  assert.deepEqual(Object.values(SDK_VERSIONS), ["1.2.0", "1.2.0", "1.2.0", "1.2.0"]);
});

test("JSONL parser accepts LF/CRLF and ignores diagnostics", () => {
  assert.deepEqual(parseJsonLines(`diagnostic\r\n${JSON.stringify(prompt)}\n\n`), [prompt]);
});

test("extension registration and actual feature response are asserted, not inferred from exit zero", () => {
  assert.equal(behaviorAssertions("extension_load", observe([commands]))[0].id, "extension_registered");
  assert.equal(behaviorAssertions("extension_load", observe([commands]))[0].passed, true);
  const good = behaviorAssertions("happy_path", observe([prompt, ready]));
  assert.equal(good[0].id, "feature_response");
  assert.equal(good[0].passed, true);
  for (const bad of [[], [ready], [{ ...prompt, success: false }, ready], [prompt]]) {
    assert.equal(behaviorAssertions("happy_path", observe(bad))[0].passed, false);
  }
  assert.equal(behaviorAssertions("extension_load", observe([]))[0].passed, false);
});

test("error path requires the handled warning for the invalid line number", () => {
  const good = behaviorAssertions("error_path", observe([prompt, error]));
  assert.equal(good[0].id, "handled_error");
  assert.equal(good[0].passed, true);
  for (const bad of [[], [prompt], [prompt, { ...error, notifyType: "info" }],
    [prompt, { ...error, message: "different error" }]]) {
    assert.equal(behaviorAssertions("error_path", observe(bad))[0].passed, false);
  }
});

test("reload requires second-process registration, feature response, and natural clean exit", () => {
  const good = behaviorAssertions("reload_cleanup", observe([commands, prompt, ready]));
  assert.deepEqual(good.map((item) => item.id), [
    "pre_reload_feature_response",
    "reloaded_extension_registered",
    "reloaded_feature_response",
    "clean_shutdown",
  ]);
  assert.ok(good.every((item) => item.passed));
  for (const responses of [[], [commands], [prompt, ready], [commands, prompt]]) {
    assert.ok(behaviorAssertions("reload_cleanup", observe(responses)).some((item) => !item.passed));
  }
  for (const firstResponses of [[], [commands], [prompt, ready], [commands, prompt]]) {
    assert.equal(behaviorAssertions("reload_cleanup", {
      ...observe([commands, prompt, ready]),
      first_responses: firstResponses,
    })[0].passed, false);
  }
  for (const state of [
    { exit_code: 1 },
    { closed: false },
    { timed_out: true },
    { stderr: "shutdown error" },
    { first_exit_code: 1 },
    { first_closed: false },
    { first_timed_out: true },
    { first_cleanup_failed: true },
  ]) {
    assert.equal(behaviorAssertions("reload_cleanup", observe([commands, prompt, ready], state))[3].passed, false);
  }
});

test("native shell case checks exact CLI version and actual child exit", () => {
  assert.equal(behaviorAssertions("host_shell", observe([], { stdout: "1.2.0\r\n" }))[0].passed, true);
  for (const bad of [
    { stdout: "11.2.0" },
    { stdout: "1.2.0", stderr: "diagnostic" },
    { stdout: "1.2.0", exit_code: 1 },
    { stdout: "1.2.0", closed: false },
    { stdout: "1.2.0", timed_out: true },
  ]) {
    assert.equal(behaviorAssertions("host_shell", observe([], bad))[0].passed, false);
  }
});
