export function truncateText(value: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (value.length <= maxChars) return value;

  let contentLength = maxChars;
  let marker = `\n\n[truncated ${value.length - contentLength} chars]`;
  while (true) {
    const nextContentLength = maxChars - marker.length;
    if (nextContentLength < 0) return value.slice(0, maxChars);
    if (nextContentLength === contentLength) break;

    contentLength = nextContentLength;
    marker = `\n\n[truncated ${value.length - contentLength} chars]`;
  }

  return `${value.slice(0, contentLength)}${marker}`;
}
