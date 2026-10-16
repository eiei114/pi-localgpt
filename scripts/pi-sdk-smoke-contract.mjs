export const VERIFICATION_CONTRACT = "pi-sdk-behavior-v2";
export const SDK_NAMES = [
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
];
export const SDK_VERSIONS = Object.fromEntries(SDK_NAMES.map((name) => [name, "1.2.0"]));
export const UNHANDLED_ERROR_PATTERN = /UnhandledPromiseRejection|uncaught exception|(?:shutdown|dispose|cleanup).{0,40}(?:error|failed)|(?:error|failed).{0,40}(?:shutdown|dispose|cleanup)/i;
export const EXTENSION_LOAD_ERROR_PATTERN = /Failed to load extension|Error loading extension/i;

export function parseJsonLines(output) {
  return output.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function assertion(id, expected, observed, passed) {
  return { id, expected, observed: JSON.stringify(observed), passed: passed === true };
}

function findResponse(responses, id, command) {
  return responses.find((row) => row?.type === "response" && row.id === id && row.command === command);
}

function findCommandList(responses) {
  const response = findResponse(responses, "commands", "get_commands");
  return response?.success === true && Array.isArray(response.data?.commands)
    ? response.data.commands
    : [];
}

function isRegisteredExtensionCommand(responses) {
  return findCommandList(responses).some(
    (command) => command.name === "localgpt:status" && command.source === "extension",
  );
}

function promptResponse(responses) {
  return findResponse(responses, "feature", "prompt");
}

function findNotification(responses) {
  return responses.find((row) => row?.type === "extension_ui_request" && row.method === "notify");
}

function isReadyFeatureResponse(responses) {
  const response = promptResponse(responses);
  const notification = findNotification(responses);
  return response?.success === true
    && response.data?.disposition === "handled"
    && notification?.notifyType === "info"
    && typeof notification.message === "string"
    && notification.message.startsWith("pi-localgpt status: ready");
}

export function behaviorAssertions(name, {
  responses,
  first_responses = [],
  stdout,
  stderr,
  exit_code,
  timed_out,
  closed,
  first_exit_code,
  first_timed_out,
  first_closed,
  first_cleanup_failed,
  expectedVersion,
}) {
  const notification = findNotification(responses);
  if (name === "extension_load") {
    return [assertion(
      "extension_registered",
      "The actual Pi host lists localgpt:status as an extension command",
      findCommandList(responses),
      isRegisteredExtensionCommand(responses),
    )];
  }
  if (name === "happy_path") {
    return [assertion(
      "feature_response",
      "The actual Pi host handles /localgpt:status and reports the isolated ready workspace",
      { response: promptResponse(responses) ?? null, notification: notification ?? null },
      isReadyFeatureResponse(responses),
    )];
  }
  if (name === "error_path") {
    const response = promptResponse(responses);
    const handledError = response?.success === true
      && response.data?.disposition === "handled"
      && notification?.notifyType === "warning"
      && notification.message === "Invalid start line. Use positive integers only.";
    return [assertion(
      "handled_error",
      "An invalid localgpt:get line number is handled with its warning, without invoking a provider",
      { response: response ?? null, notification: notification ?? null },
      handledError,
    )];
  }
  if (name === "reload_cleanup") {
    const cleanOutput = `${stdout}\n${stderr}`;
    return [
      assertion(
        "pre_reload_feature_response",
        "The first isolated Pi host registers and handles /localgpt:status before it is closed",
        { registered: isRegisteredExtensionCommand(first_responses), response: promptResponse(first_responses) ?? null,
          notification: findNotification(first_responses) ?? null },
        isRegisteredExtensionCommand(first_responses) && isReadyFeatureResponse(first_responses),
      ),
      assertion(
        "reloaded_extension_registered",
        "A second isolated Pi process lists localgpt:status as an extension command",
        findCommandList(responses),
        isRegisteredExtensionCommand(responses),
      ),
      assertion(
        "reloaded_feature_response",
        "The second Pi process handles /localgpt:status and reports the isolated ready workspace",
        { response: promptResponse(responses) ?? null, notification: notification ?? null },
        isReadyFeatureResponse(responses),
      ),
      assertion(
        "clean_shutdown",
        "Both Pi host processes close naturally with exit code 0 and no shutdown/unhandled error",
        { first_exit_code, first_closed, first_timed_out, first_cleanup_failed,
          second_exit_code: exit_code, second_closed: closed, second_timed_out: timed_out,
          signal: cleanOutput.match(/(?:SIGTERM|SIGKILL)/)?.[0] ?? null },
        first_exit_code === 0 && first_closed && !first_timed_out && !first_cleanup_failed
          && exit_code === 0 && closed && !timed_out && !UNHANDLED_ERROR_PATTERN.test(cleanOutput),
      ),
    ];
  }
  if (name === "host_shell") {
    return [assertion(
      "native_shell_boundary",
      "The native host shell launches this checkout's pinned Pi CLI and prints exactly its version",
      { stdout: stdout.trim(), stderr: stderr.trim(), exit_code, closed, timed_out, expectedVersion },
      stdout.trim() === expectedVersion && stderr.trim() === ""
        && exit_code === 0 && closed && !timed_out,
    )];
  }
  throw new Error(`Unknown Pi SDK smoke case: ${name}`);
}
