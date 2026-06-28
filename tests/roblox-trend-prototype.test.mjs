import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

const {
  ROBLOX_TREND_PROTOTYPE_DEFAULT_MAX_CHARS,
  ROBLOX_TREND_GUARDRAILS,
  RobloxTrendPrototypeError,
  normalizeRobloxTrendSummary,
  buildRobloxTrendPrototypePrompt,
  buildLayoutBrief,
  prepareRobloxTrendPrototypeRequest,
  truncatePrototypeDescription,
} = await import("../lib/roblox-trend-prototype.ts");
const { genPlanFromRobloxTrend } = await import("../lib/gen-tools.ts");

const sampleSummary = {
  title: "Neon Tower Obby Rush",
  genre: "obby / parkour",
  theme: "neon cyberpunk towers at night",
  mechanics: ["timed jumps", "checkpoint pads", "speed boosts"],
  audience: "young teens, short mobile-friendly sessions",
  market_signals: [
    "Top charts favor vertical tower obbies with bright accent colors",
    "Session length under 8 minutes in featured examples",
  ],
  speculative_ideas: ["optional lava reset zones on failed jumps"],
};

test("normalizeRobloxTrendSummary accepts compact structured summaries", () => {
  const normalized = normalizeRobloxTrendSummary(sampleSummary);
  assert.equal(normalized.title, "Neon Tower Obby Rush");
  assert.equal(normalized.genre, "obby / parkour");
  assert.equal(normalized.mechanics.length, 3);
  assert.equal(normalized.marketSignals.length, 2);
  assert.equal(normalized.speculativeIdeas.length, 1);
});

test("normalizeRobloxTrendSummary rejects missing genre", () => {
  assert.throws(
    () => normalizeRobloxTrendSummary({ theme: "coastal", mechanics: ["swim"] }),
    (error) => error instanceof RobloxTrendPrototypeError && error.message.includes("genre"),
  );
});

test("normalizeRobloxTrendSummary rejects genre-only summaries", () => {
  assert.throws(
    () => normalizeRobloxTrendSummary({ genre: "simulator" }),
    (error) => error instanceof RobloxTrendPrototypeError && error.message.includes("factual trend signal"),
  );
});

test("buildRobloxTrendPrototypePrompt separates facts from speculative ideas", () => {
  const prepared = buildRobloxTrendPrototypePrompt(normalizeRobloxTrendSummary(sampleSummary));

  assert.match(prepared.planningDescription, /\[Roblox trend → LocalGPT prototype \| Neon Tower Obby Rush\]/);
  assert.match(prepared.planningDescription, /## Trend facts/);
  assert.match(prepared.planningDescription, /Genre: obby \/ parkour/);
  assert.match(prepared.planningDescription, /Top charts favor vertical tower obbies/);
  assert.match(prepared.planningDescription, /## Speculative additions/);
  assert.match(prepared.planningDescription, /optional lava reset zones/);
  assert.match(prepared.planningDescription, /## Guardrails/);
  assert.ok(prepared.layoutBrief.includes("Roblox-inspired obby / parkour concept scene"));
  assert.ok(prepared.speculative.includes("optional lava reset zones on failed jumps"));
  assert.equal(prepared.guardrails.length, ROBLOX_TREND_GUARDRAILS.length);
});

test("buildLayoutBrief keeps speculative additions labeled in the layout brief", () => {
  const brief = buildLayoutBrief(normalizeRobloxTrendSummary(sampleSummary));
  assert.match(brief, /Optional prototype additions \(speculative\): optional lava reset zones/);
});

test("truncatePrototypeDescription marks oversized prompts", () => {
  const longText = "x".repeat(200);
  const { text, truncated } = truncatePrototypeDescription(longText, 80);
  assert.equal(truncated, true);
  assert.ok(text.endsWith("[truncated for gen_plan_layout]"));
  assert.ok(text.length <= 80);
});

test("prepareRobloxTrendPrototypeRequest reads summary_path via injected fs", async () => {
  const prepared = await prepareRobloxTrendPrototypeRequest(
    { summary_path: "trends/neon-obby.json" },
    {
      readFileFs: {
        async readFile() {
          return JSON.stringify(sampleSummary);
        },
      },
    },
  );

  assert.equal(prepared.source, "trends/neon-obby.json");
  assert.equal(prepared.title, "Neon Tower Obby Rush");
  assert.ok(prepared.planningDescription.includes("Neon Tower Obby Rush"));
});

test("prepareRobloxTrendPrototypeRequest rejects missing summary and summary_path", async () => {
  await assert.rejects(
    () => prepareRobloxTrendPrototypeRequest({}),
    (error) => error instanceof RobloxTrendPrototypeError,
  );
});

test("prepareRobloxTrendPrototypeRequest rejects both summary and summary_path", async () => {
  await assert.rejects(
    () => prepareRobloxTrendPrototypeRequest({ summary: sampleSummary, summary_path: "trends/neon-obby.json" }),
    (error) => error instanceof RobloxTrendPrototypeError,
  );
});

test("prepareRobloxTrendPrototypeRequest rejects summary_path outside working directory", async () => {
  await assert.rejects(
    () => prepareRobloxTrendPrototypeRequest(
      { summary_path: "../../secrets.json" },
      { cwd: "/vault/root" },
    ),
    (error) => error instanceof RobloxTrendPrototypeError && error.message.includes("working directory"),
  );
});

test("prepareRobloxTrendPrototypeRequest rejects non-json summary_path", async () => {
  await assert.rejects(
    () => prepareRobloxTrendPrototypeRequest(
      { summary_path: "trends/neon-obby.md" },
      { cwd: "/vault/root" },
    ),
    (error) => error instanceof RobloxTrendPrototypeError && error.message.includes("JSON"),
  );
});

test("prepareRobloxTrendPrototypeRequest honors max_chars", async () => {
  const prepared = await prepareRobloxTrendPrototypeRequest(
    {
      summary: {
        genre: "obby",
        theme: "neon",
        market_signals: ["signal ".repeat(500)],
      },
    },
    {},
  );

  assert.equal(prepared.maxChars, ROBLOX_TREND_PROTOTYPE_DEFAULT_MAX_CHARS);
  assert.equal(prepared.truncated, true);
  assert.ok(prepared.planningDescription.length <= ROBLOX_TREND_PROTOTYPE_DEFAULT_MAX_CHARS);
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

test("genPlanFromRobloxTrend shapes prompt and calls gen_plan_layout", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_plan_layout", { regions: ["tower_core", "checkpoint_ring"], paths: [] }],
  ]);
  const mock = createMockSpawn(responses);

  const result = await genPlanFromRobloxTrend(
    {
      summary: sampleSummary,
      style: "neon",
    },
    { spawnFn: mock.spawnFn, timeoutMs: 5000 },
  );

  assert.ok(result.content[0].text.includes("tower_core"));
  assert.equal(result.details?.title, "Neon Tower Obby Rush");
  assert.ok(String(result.details?.planningDescription).includes("Trend facts"));
  assert.equal(mock.callCount, 1);
});
