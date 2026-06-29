import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

const {
  MEMORY_WORLDBUILD_DEFAULT_MAX_CHARS,
  MEMORY_WORLDBUILD_DEFAULT_EXCERPT_CHARS,
  MemoryWorldgenSaveError,
  WORLDBUILD_REFERENCE_KINDS,
  summarizeWorldgenArtifact,
  buildWorldgenReferenceSections,
  composeMemoryWorldgenContent,
  prepareMemoryWorldgenSave,
} = await import("../lib/memory-worldgen-save.ts");
const { genMemoryWorldgenSave } = await import("../lib/gen-tools.ts");

// ── summarizeWorldgenArtifact ───────────────────────────────────────

test("summarizeWorldgenArtifact excerpts strings and strips whitespace", () => {
  const excerpt = summarizeWorldgenArtifact("  Dockside plaza with crates  ", 100);
  assert.equal(excerpt, "Dockside plaza with crates");
});

test("summarizeWorldgenArtifact truncates long strings with ellipsis", () => {
  const long = "region ".repeat(200);
  const excerpt = summarizeWorldgenArtifact(long, 40);
  assert.ok(excerpt.length <= 40);
  assert.ok(excerpt.endsWith("…"));
});

test("summarizeWorldgenArtifact pulls description and region count from plan object", () => {
  const excerpt = summarizeWorldgenArtifact({
    description: "Harbor district with warehouses",
    regions: ["dock", "warehouse_row", "lighthouse"],
    paths: [],
    hugeIgnoredBlob: { deep: Array.from({ length: 500 }, (_, i) => i) },
  });

  assert.match(excerpt, /Harbor district with warehouses/);
  assert.match(excerpt, /regions: 3/);
  // The huge blob must not leak verbatim.
  assert.ok(!excerpt.includes("deep"));
});

test("summarizeWorldgenArtifact emits only structural metadata for unknown object", () => {
  const excerpt = summarizeWorldgenArtifact({ weird: { nested: true }, other: 7, list: [1, 2, 3] }, 200);
  assert.ok(excerpt.length <= 200);
  // Structural fingerprint only — no raw values leak.
  assert.match(excerpt, /other:number/);
  assert.match(excerpt, /weird:object/);
  assert.match(excerpt, /list\[3\]/);
  assert.ok(!excerpt.includes("nested"));
  assert.ok(!excerpt.includes("{") || !excerpt.startsWith("{"));
});

test("summarizeWorldgenArtifact returns undefined for empty/missing inputs", () => {
  assert.equal(summarizeWorldgenArtifact(undefined), undefined);
  assert.equal(summarizeWorldgenArtifact(null), undefined);
  assert.equal(summarizeWorldgenArtifact(""), undefined);
  assert.equal(summarizeWorldgenArtifact("   "), undefined);
});

// ── buildWorldgenReferenceSections (fallback contract) ─────────────

test("buildWorldgenReferenceSections reports missing kinds as fallbacks", () => {
  const { sections, used, fallbacks } = buildWorldgenReferenceSections(
    { plan: "harbor layout", world: "harbor-v1" },
    MEMORY_WORLDBUILD_DEFAULT_EXCERPT_CHARS,
  );

  const kinds = sections.map((s) => s.kind);
  assert.deepEqual(kinds, ["plan", "world"]);
  assert.deepEqual(used, ["plan", "world"]);
  assert.deepEqual(fallbacks, ["evaluate", "export"]);
});

test("buildWorldgenReferenceSections falls back entirely when references absent", () => {
  const { used, fallbacks } = buildWorldgenReferenceSections(undefined, 100);
  assert.deepEqual(used, []);
  assert.deepEqual(fallbacks, [...WORLDBUILD_REFERENCE_KINDS]);
});

// ── prepareMemoryWorldgenSave ───────────────────────────────────────

test("prepareMemoryWorldgenSave shapes a compact rationale + references payload", () => {
  const prepared = prepareMemoryWorldgenSave({
    rationale: "Harbor needs a defensible chokepoint at the lighthouse approach.",
    summary: "Harbor chokepoint rationale",
    references: {
      plan: { description: "harbor layout", regions: ["dock", "warehouse_row", "lighthouse"] },
      export: { path: "4_Project/MyGame/screenshots/harbor.png" },
    },
    tags: ["World Building", "Harbor"],
  });

  assert.match(prepared.content, /Harbor needs a defensible chokepoint/);
  assert.match(prepared.content, /worldgen:plan/);
  assert.match(prepared.content, /worldgen:export/);
  assert.match(prepared.content, /harbor layout/);
  assert.match(prepared.content, /tags: world-building, harbor/);
  assert.deepEqual(prepared.referencesUsed, ["plan", "export"]);
  assert.deepEqual(prepared.fallbacks, ["evaluate", "world"]);
  assert.equal(prepared.truncated, false);
  assert.equal(prepared.title, "Harbor chokepoint rationale");
});

test("prepareMemoryWorldgenSave records fallback note when no references given", () => {
  const prepared = prepareMemoryWorldgenSave({
    rationale: "Quick note: prefer verticality for the canyon level.",
  });

  assert.match(prepared.content, /prefer verticality for the canyon level/);
  assert.match(prepared.content, /\[no worldgen artifacts referenced for: plan, evaluate, export, world\]/);
  assert.deepEqual(prepared.referencesUsed, []);
  assert.deepEqual(prepared.fallbacks, [...WORLDBUILD_REFERENCE_KINDS]);
  assert.equal(prepared.title, "WorldGen design rationale");
});

test("prepareMemoryWorldgenSave rejects empty rationale", () => {
  assert.throws(
    () => prepareMemoryWorldgenSave({ rationale: "   " }),
    (error) => error instanceof MemoryWorldgenSaveError && /rationale is required/.test(error.message),
  );
});

test("prepareMemoryWorldgenSave rejects missing rationale", () => {
  assert.throws(
    () => prepareMemoryWorldgenSave({}),
    (error) => error instanceof MemoryWorldgenSaveError,
  );
});

test("prepareMemoryWorldgenSave keeps payload within max_chars", () => {
  const hugeRationale = "design intent ".repeat(2000);
  const prepared = prepareMemoryWorldgenSave({
    rationale: hugeRationale,
    references: { plan: "harbor layout", world: "harbor-v1" },
    max_chars: 1000,
  });

  assert.ok(prepared.content.length <= 1000, `content length ${prepared.content.length} > 1000`);
  assert.equal(prepared.truncated, true);
  // References are preserved preferentially even after truncation.
  assert.match(prepared.content, /worldgen:plan/);
  assert.match(prepared.content, /worldgen:world/);
});

test("prepareMemoryWorldgenSave clamps sub-256 caps up to the minimum instead of widening", () => {
  const prepared = prepareMemoryWorldgenSave({
    rationale: "tight cap rationale",
    max_chars: 100,
  });

  // A caller asking for 100 chars should NOT be silently expanded to 4000.
  assert.equal(prepared.maxChars, 256);
  assert.ok(prepared.content.length <= 256);
});

test("prepareMemoryWorldgenSave never embeds raw large scene JSON", () => {
  const hugeScene = {
    description: "harbor",
    regions: Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, entities: Array.from({ length: 50 }, (_, j) => `e${i}-${j}`) })),
  };
  const prepared = prepareMemoryWorldgenSave({
    rationale: "harbor intent",
    references: { plan: hugeScene },
  });

  assert.match(prepared.content, /regions: 200/);
  // No individual entity id should leak into the saved memory.
  assert.ok(!/e\d+-\d+/.test(prepared.content));
  assert.ok(prepared.content.length <= MEMORY_WORLDBUILD_DEFAULT_MAX_CHARS);
});

// ── composeMemoryWorldgenContent edge cases ─────────────────────────

test("composeMemoryWorldgenContent prefers preserving references over rationale when truncating", () => {
  const rationale = "x".repeat(5000);
  const sections = [{ kind: "export", excerpt: "harbor.png" }];
  const { content, truncated } = composeMemoryWorldgenContent(
    rationale,
    sections,
    ["harbor"],
    [],
    800,
  );

  assert.equal(truncated, true);
  assert.ok(content.includes("worldgen:export"));
  assert.ok(content.includes("tags: harbor"));
  assert.ok(content.length <= 800);
});

// ── genMemoryWorldgenSave wrapper (1-shot bridge) ───────────────────

function createMockSpawn(responses) {
  let callCount = 0;
  const calls = [];

  return {
    spawnFn: () => {
      callCount++;
      const emitter = new EventEmitter();
      const stdout = new Readable({ read() {} });
      const origPush = stdout.push.bind(stdout);
      const pushLine = (line) => origPush(`${line}\n`);

      const stdin = {
        write: (data, cb) => {
          try {
            const msg = JSON.parse(data.trim());
            calls.push(msg);
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
    get calls() {
      return calls;
    },
  };
}

test("genMemoryWorldgenSave shapes payload and dispatches memory_save once", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["memory_save", { ok: true, id: "mem-123" }],
  ]);
  const mock = createMockSpawn(responses);

  const result = await genMemoryWorldgenSave(
    {
      rationale: "Harbor chokepoint for defense.",
      references: { plan: "harbor layout", export: { path: "screenshots/harbor.png" } },
    },
    { spawnFn: mock.spawnFn, timeoutMs: 5000 },
  );

  assert.equal(mock.callCount, 1);
  assert.ok(result.content[0].text.includes("Saved WorldGen design rationale"));

  const saveCall = mock.calls.find((c) => c.params?.name === "memory_save");
  assert.ok(saveCall, "memory_save was dispatched");
  const saveArgs = saveCall.params.arguments;
  assert.match(saveArgs.content, /Harbor chokepoint for defense/);
  assert.match(saveArgs.content, /worldgen:plan/);
  assert.match(saveArgs.content, /worldgen:export/);
  assert.match(saveArgs.content, /worldgen:export/);
  assert.ok(!/e\d+-\d+/.test(saveArgs.content), "no raw entity ids leaked");
  assert.deepEqual(result.details.referencesUsed, ["plan", "export"]);
  assert.deepEqual(result.details.fallbacks, ["evaluate", "world"]);
});

test("genMemoryWorldgenSave surfaces fallbacks when no references provided", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["memory_save", { ok: true }],
  ]);
  const mock = createMockSpawn(responses);

  const result = await genMemoryWorldgenSave(
    { rationale: "quick verticality note" },
    { spawnFn: mock.spawnFn, timeoutMs: 5000 },
  );

  assert.deepEqual(result.details.referencesUsed, []);
  assert.deepEqual(result.details.fallbacks, [...WORLDBUILD_REFERENCE_KINDS]);
  assert.equal(mock.callCount, 1);
});
