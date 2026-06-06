import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { LOCALGPT_DEFAULT_MAX_CHARS } from "../lib/formatters.ts";
import {
  promptForInput,
  runMemoryGet,
  runMemoryLog,
  runMemorySave,
  runMemorySearch,
} from "../lib/localgpt-memory.ts";
import { formatLocalgptStatus, inspectLocalgptStatus } from "../lib/status.ts";

const statusParameters = Type.Object({});

const searchParameters = Type.Object({
  query: Type.String({ description: "Search query for LocalGPT workspace memory (keyword match)." }),
  limit: Type.Optional(Type.Number({ description: "Maximum number of hits. Default: 10." })),
  maxChars: Type.Optional(Type.Number({ description: `Maximum output characters. Default: ${LOCALGPT_DEFAULT_MAX_CHARS}.` })),
});

const getParameters = Type.Object({
  path: Type.String({ description: "Workspace-relative path from search results, e.g. MEMORY.md or memory/2026-06-06.md." }),
  startLine: Type.Optional(Type.Number({ description: "1-based start line. Default: 1." })),
  endLine: Type.Optional(Type.Number({ description: "1-based end line inclusive. Default: end of file." })),
  maxChars: Type.Optional(Type.Number({ description: `Maximum output characters. Default: ${LOCALGPT_DEFAULT_MAX_CHARS}.` })),
});

const writeParameters = Type.Object({
  content: Type.String({ description: "Markdown text to append." }),
});

export default function (pi: ExtensionAPI) {
  pi.registerCommand("localgpt:status", {
    description: "Show LocalGPT workspace memory status for pi-localgpt",
    handler: async (_args, ctx) => {
      const summary = await inspectLocalgptStatus();
      ctx.ui.notify(formatLocalgptStatus(summary), summary.ok ? "info" : "warning");
    },
  });

  pi.registerCommand("localgpt:search", {
    description: "Search LocalGPT workspace memory (keyword)",
    handler: async (args, ctx) => {
      const query = await promptForInput(ctx, "Search LocalGPT memory:", "e.g. rust async, project preferences", args);
      if (!query) {
        ctx.ui.notify("Search cancelled. Enter a memory query.", "warning");
        return;
      }

      try {
        const result = await runMemorySearch(query, 10, { signal: ctx.signal });
        ctx.ui.notify(result.text, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("localgpt:remember", {
    description: "Append a note to LocalGPT MEMORY.md",
    handler: async (args, ctx) => {
      const content = await promptForInput(ctx, "Remember in LocalGPT:", "Long-term memory to append to MEMORY.md", args);
      if (!content) {
        ctx.ui.notify("Remember cancelled. Enter memory text.", "warning");
        return;
      }

      try {
        const result = await runMemorySave(content);
        ctx.ui.notify(`Appended to ${result.path}`, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerTool({
    name: "localgpt_status",
    label: "LocalGPT Status",
    description: "Report LocalGPT config/workspace readiness. No localgpt binary spawn; keyword search only.",
    promptSnippet: "localgpt_status: check LocalGPT workspace memory paths before search or write tools",
    promptGuidelines: [
      "Use this tool before localgpt_memory_search when workspace setup is uncertain.",
      "This package reads markdown directly; it does not spawn the localgpt Rust binary.",
    ],
    parameters: statusParameters,
    async execute(_toolCallId, _params, _signal) {
      const summary = await inspectLocalgptStatus();
      return {
        content: [{ type: "text", text: formatLocalgptStatus(summary) }],
        details: summary,
      };
    },
  });

  pi.registerTool({
    name: "localgpt_memory_search",
    label: "LocalGPT Memory Search",
    description: `Keyword search over LocalGPT workspace markdown (MEMORY.md, daily logs). Output truncated to maxChars (default ${LOCALGPT_DEFAULT_MAX_CHARS}).`,
    promptSnippet: "localgpt_memory_search: recall cross-session notes from LocalGPT workspace memory",
    promptGuidelines: [
      "Use for cross-session preferences, assistant context, and long-running project notes stored in LocalGPT.",
      "Follow with localgpt_memory_get when you need more lines from a hit.",
      "Not semantic search — keyword match only.",
    ],
    parameters: searchParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runMemorySearch(params.query, params.limit, {
        maxChars: params.maxChars,
        signal,
      });

      return {
        content: [{ type: "text", text: result.text }],
        details: { results: result.results, workspacePath: result.workspacePath },
      };
    },
  });

  pi.registerTool({
    name: "localgpt_memory_get",
    label: "LocalGPT Memory Get",
    description: `Read a line range from a LocalGPT workspace memory file. Use after localgpt_memory_search.`,
    promptSnippet: "localgpt_memory_get: read full lines from a LocalGPT memory file path returned by search",
    promptGuidelines: [
      "Call after localgpt_memory_search when snippet context is insufficient.",
      "Path must stay inside the LocalGPT workspace.",
    ],
    parameters: getParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runMemoryGet(params.path, params.startLine, params.endLine, {
        maxChars: params.maxChars,
        signal,
      });

      return {
        content: [{ type: "text", text: result.text }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "localgpt_memory_save",
    label: "LocalGPT Memory Save",
    description: "Append curated long-term knowledge to LocalGPT MEMORY.md.",
    promptSnippet: "localgpt_memory_save: append durable cross-session knowledge to LocalGPT MEMORY.md",
    promptGuidelines: [
      "Use for stable preferences and facts that should persist across Pi sessions.",
      "Prefer localgpt_memory_log for ephemeral daily notes.",
    ],
    parameters: writeParameters,
    async execute(_toolCallId, params) {
      const result = await runMemorySave(params.content);
      return {
        content: [{ type: "text", text: `Appended to ${result.path}` }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "localgpt_memory_log",
    label: "LocalGPT Memory Log",
    description: "Append to today's LocalGPT daily log (memory/YYYY-MM-DD.md).",
    promptSnippet: "localgpt_memory_log: append a timestamped note to today's LocalGPT daily log",
    promptGuidelines: [
      "Use for session notes and work-in-progress context.",
      "Use localgpt_memory_save for durable long-term facts.",
    ],
    parameters: writeParameters,
    async execute(_toolCallId, params) {
      const result = await runMemoryLog(params.content);
      return {
        content: [{ type: "text", text: `Appended to ${result.path}` }],
        details: result,
      };
    },
  });
}
