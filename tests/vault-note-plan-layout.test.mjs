import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

const {
  VAULT_NOTE_PLAN_DEFAULT_MAX_CHARS,
  VaultNotePlanError,
  normalizeVaultNoteMarkdown,
  buildPlanLayoutDescription,
  prepareVaultNotePlanFromRaw,
  prepareVaultNotePlanRequest,
  truncatePlanDescription,
} = await import("../lib/vault-note-plan-layout.ts");
const { genPlanFromVaultNote } = await import("../lib/gen-tools.ts");

test("normalizeVaultNoteMarkdown strips frontmatter, headings, and wiki links", () => {
  const raw = `---
title: Castle Concept
tags: [worldgen]
---

# Castle Layout

See [[Regions/Keep|Keep]] for reference.

> A moat surrounds the inner bailey.

<!-- draft note -->

Main courtyard with training yard.
`;

  const result = normalizeVaultNoteMarkdown(raw);
  assert.equal(result.title, "Castle Concept");
  assert.equal(result.removedFrontmatter, true);
  assert.ok(result.cleaned.includes("Castle Layout"));
  assert.ok(result.cleaned.includes("Keep"));
  assert.ok(!result.cleaned.includes("#"));
  assert.ok(!result.cleaned.includes("[[Regions/Keep|Keep]]"));
  assert.ok(!result.cleaned.includes("tags:"));
});

test("buildPlanLayoutDescription includes source reference", () => {
  const description = buildPlanLayoutDescription("Open plaza with fountain.", {
    reference: "4_Project/MyGame/world-memo.md",
    path: "4_Project/MyGame/world-memo.md",
    title: "World Memo",
  });

  assert.match(description, /^\[Source: 4_Project\/MyGame\/world-memo\.md — World Memo\]/);
  assert.ok(description.includes("Open plaza with fountain."));
});

test("truncatePlanDescription marks oversized notes", () => {
  const longText = "x".repeat(100);
  const { text, truncated } = truncatePlanDescription(longText, 50);
  assert.equal(truncated, true);
  assert.ok(text.endsWith("[truncated for gen_plan_layout]"));
  assert.ok(text.length <= 50);
});

test("prepareVaultNotePlanFromRaw rejects empty notes after cleanup", () => {
  assert.throws(
    () => prepareVaultNotePlanFromRaw("---\ntitle: Empty\n---\n\n<!-- only comments -->\n", { reference: "inline note" }),
    (error) => error instanceof VaultNotePlanError,
  );
});

test("prepareVaultNotePlanRequest reads note_path via injected fs", async () => {
  const prepared = await prepareVaultNotePlanRequest(
    { note_path: "notes/world.md" },
    {
      readFileFs: {
        async readFile() {
          return "# Harbor District\n\nDockside warehouses and a lighthouse.";
        },
      },
    },
  );

  assert.equal(prepared.source.path, "notes/world.md");
  assert.ok(prepared.description.includes("[Source: notes/world.md"));
  assert.ok(prepared.description.includes("Harbor District"));
});

test("prepareVaultNotePlanRequest rejects missing note and note_path", async () => {
  await assert.rejects(
    () => prepareVaultNotePlanRequest({}),
    (error) => error instanceof VaultNotePlanError,
  );
});

test("prepareVaultNotePlanRequest rejects both note and note_path", async () => {
  await assert.rejects(
    () => prepareVaultNotePlanRequest({ note: "inline", note_path: "notes/world.md" }),
    (error) => error instanceof VaultNotePlanError,
  );
});

test("prepareVaultNotePlanRequest honors max_chars", async () => {
  const prepared = await prepareVaultNotePlanRequest(
    { note: `# Big memo\n\n${"region ".repeat(2000)}` },
    {},
  );

  assert.equal(prepared.maxChars, VAULT_NOTE_PLAN_DEFAULT_MAX_CHARS);
  assert.equal(prepared.truncated, true);
  assert.ok(prepared.description.length <= VAULT_NOTE_PLAN_DEFAULT_MAX_CHARS);
});

function createMockSpawn(responses) {
  let callCount = 0;

  return {
    spawnFn: () => {
      callCount++;
      const emitter = new EventEmitter();
      const stdout = Readable({ read() {} });
      const origPush = stdout.push.bind(stdout);
      const pushLine = (line) => {
        origPush(`${line}\n`);
      };

      const stdin = {
        write: (data, cb) => {
          try {
            const msg = JSON.parse(data.trim());
            const key = msg.method === "tools/call" ? msg.params?.name : msg.method;
            const response = responses.get(key) ?? responses.get(msg.method);
            if (response !== undefined) {
              setTimeout(() => {
                pushLine(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: response }));
              }, 10);
            }
          } catch {
            // ignore
          }
          cb?.(null);
        },
        end: () => {},
      };

      emitter.pid = 12345;
      emitter.killed = false;
      emitter.stdout = stdout;
      emitter.stdin = stdin;
      emitter.stderr = new EventEmitter();
      emitter.kill = () => {
        emitter.killed = true;
      };

      return emitter;
    },
    get callCount() {
      return callCount;
    },
  };
}

test("genPlanFromVaultNote shapes prompt and calls gen_plan_layout", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_plan_layout", { regions: ["harbor", "warehouse_row"], paths: [] }],
  ]);
  const mock = createMockSpawn(responses);

  const result = await genPlanFromVaultNote(
    {
      note: "# Harbor\n\nDockside warehouses with a lighthouse overlook.",
      style: "coastal",
    },
    { spawnFn: mock.spawnFn, timeoutMs: 5000 },
  );

  assert.ok(result.content[0].text.includes("harbor"));
  assert.equal(result.details?.source?.reference, "inline note");
  assert.ok(String(result.details?.planningDescription).includes("[Source:"));
  assert.equal(mock.callCount, 1);
});
