function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** Largest end index <= `end` that does not split a surrogate pair of `value`. */
function safeEnd(value: string, end: number): number {
  if (end <= 0) return 0;
  if (end >= value.length) return value.length;
  if (isHighSurrogate(value.charCodeAt(end - 1)) && isLowSurrogate(value.charCodeAt(end))) return end - 1;
  return end;
}

function truncationMarker(value: string, contentEnd: number): string {
  return `\n\n[truncated ${value.length - contentEnd} chars]`;
}

/**
 * Truncates to at most `maxChars` UTF-16 code units (marker included) without
 * splitting a surrogate pair. The omitted count is in UTF-16 code units.
 */
export function truncateText(value: string, maxChars: number): string {
  if (Number.isNaN(maxChars) || maxChars <= 0) return "";
  if (value.length <= maxChars) return value;

  const cap = Math.floor(maxChars);
  let end = safeEnd(value, cap);
  while (end > 0 && end + truncationMarker(value, end).length > cap) {
    end = safeEnd(value, end - 1);
  }
  if (end + truncationMarker(value, end).length > cap) return value.slice(0, safeEnd(value, cap));

  return `${value.slice(0, end)}${truncationMarker(value, end)}`;
}
