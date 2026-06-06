import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

const { checkGenBinary, genCallTool, genListTools } = await import("../lib/gen-mcp-client.ts");
const { formatGenStatus, inspectGenStatus } = await import("../lib/gen-status.ts");
const {
  genScreenshot, genSceneInfo, genSpawnPrimitive, genModifyEntity,
  genDeleteEntity, genSetCamera, genPlanLayout, genApplyBlockout,
  genModifyBlockout, genPopulateRegion, genEvaluateScene, genAutoRefine,
  genUndo,
  genMemorySearch, genMemoryGet, genMemorySave, genMemoryLog,
  genSpawnPlayer, genAddNpc, genSetNpcDialogue,
  genAddTrigger, genAddTeleporter, genAddCollectible, genAddDoor,
  genSetPhysics, genAddCollider, genAddForce, genSetGravity,
  genAddTerrain, genAddWater, genAddFoliage, genSetSky,
  genSetAmbience, genAudioEmitter, genExportScreenshot,
} = await import("../lib/gen-tools.ts");

// ── Mock child process ──────────────────────────────────────────────

import { Readable } from "node:stream";

function createMockSpawn(responses) {
  let callCount = 0;

  return {
    spawnFn: (_command, _args, _opts) => {
      callCount++;
      const emitter = new EventEmitter();

      let queuedLines = [];
      let pushFn = null;

      // Use a real Readable so readline works
      const stdout = Readable({
        read() {
          // Lines will be pushed when responses arrive
        },
      });
      // Patch: capture the push method for external use
      const origPush = stdout.push.bind(stdout);
      const pushLine = (line) => {
        origPush(line + "\n");
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
          } catch { /* ignore */ }
          cb?.(null);
        },
        end: () => {},
      };

      emitter.pid = 12345;
      emitter.killed = false;
      emitter.stdout = stdout;
      emitter.stdin = stdin;
      emitter.stderr = new EventEmitter();
      emitter.kill = () => { emitter.killed = true; };

      return emitter;
    },
    get callCount() { return callCount; },
  };
}

// ── Tests ───────────────────────────────────────────────────────────

test("gen-mcp-client exports are functions", async () => {
  assert.equal(typeof genCallTool, "function");
  assert.equal(typeof genListTools, "function");
  assert.equal(typeof checkGenBinary, "function");
});

test("checkGenBinary returns found=false when binary missing", async () => {
  const status = await checkGenBinary("nonexistent-binary-xyz", async () => {
    throw new Error("not found");
  });

  assert.equal(status.found, false);
  assert.ok(status.error?.includes("not found"));
});

test("checkGenBinary returns found=true with version", async () => {
  const status = await checkGenBinary("localgpt-gen", async () => "localgpt-gen 0.5.0");

  assert.equal(status.found, true);
  assert.equal(status.version, "0.5.0");
});

test("genCallTool spawns 1-shot process and returns result", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_screenshot", { content: [{ type: "image", data: "base64..." }] }],
  ]);

  const mock = createMockSpawn(responses);

  const result = await genCallTool("gen_screenshot", {}, {
    spawnFn: mock.spawnFn,
    timeoutMs: 5000,
  });

  assert.deepEqual(result, { content: [{ type: "image", data: "base64..." }] });
  assert.equal(mock.callCount, 1);
});

test("genListTools spawns 1-shot process and returns tools", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["tools/list", { tools: [
      { name: "gen_screenshot", description: "Take a screenshot" },
      { name: "gen_spawn_primitive", description: "Spawn a primitive" },
    ]}],
  ]);

  const mock = createMockSpawn(responses);

  const tools = await genListTools({
    spawnFn: mock.spawnFn,
    timeoutMs: 5000,
  });

  assert.equal(tools.length, 2);
  assert.equal(tools[0]?.name, "gen_screenshot");
  assert.equal(mock.callCount, 1);
});

test("formatGenStatus formats binary-not-found status", () => {
  const text = formatGenStatus({
    ok: false,
    binary: { found: false, command: "localgpt-gen", error: "not found" },
    relayReachable: false,
    toolCount: 0,
    tools: [],
    hints: ["localgpt-gen not found. Install: cargo install localgpt-gen"],
  });

  assert.ok(text.includes("not available"));
  assert.ok(text.includes("missing"));
  assert.ok(text.includes("not reachable"));
});

test("formatGenStatus formats available status", () => {
  const text = formatGenStatus({
    ok: true,
    binary: { found: true, command: "localgpt-gen", version: "0.5.0" },
    relayReachable: true,
    toolCount: 57,
    tools: [],
    hints: [],
  });

  assert.ok(text.includes("available"));
  assert.ok(text.includes("v0.5.0"));
  assert.ok(text.includes("reachable"));
  assert.ok(text.includes("57"));
});

test("inspectGenStatus returns not-found when binary missing", async () => {
  const summary = await inspectGenStatus(
    async () => ({ found: false, command: "localgpt-gen", error: "not found" }),
    async () => [],
  );

  assert.equal(summary.ok, false);
  assert.equal(summary.binary.found, false);
  assert.equal(summary.relayReachable, false);
});

// ── Curated gen-tools wrapper tests ─────────────────────────────────

test("genScreenshot calls gen_screenshot via 1-shot", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_screenshot", { content: [{ type: "image", data: "base64abc" }] }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genScreenshot({}, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("base64abc"));
  assert.equal(mock.callCount, 1);
});

test("genSceneInfo calls gen_scene_info via 1-shot", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_scene_info", { entities: ["Floor", "Cube1"] }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genSceneInfo({}, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("Floor"));
  assert.equal(mock.callCount, 1);
});

test("genSpawnPrimitive calls gen_spawn_primitive with type", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_spawn_primitive", { name: "Cube_1", status: "spawned" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genSpawnPrimitive({ type: "cube", position: [0, 1, 0] }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("spawned"));
  assert.equal(mock.callCount, 1);
});

test("genModifyEntity calls gen_modify_entity", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_modify_entity", { name: "Cube_1", status: "modified" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genModifyEntity({ name: "Cube_1", color: "#ff0000" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("modified"));
});

test("genPlanLayout calls gen_plan_layout with description", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_plan_layout", { regions: ["castle", "moat"], paths: [] }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genPlanLayout({ description: "medieval castle with moat" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("castle"));
});

test("genApplyBlockout calls gen_apply_blockout with layout", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_apply_blockout", { status: "applied", regions: 2 }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genApplyBlockout({ layout: { regions: [] } }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("applied"));
});

test("genModifyBlockout calls gen_modify_blockout", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_modify_blockout", { status: "modified" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genModifyBlockout({ action: "add", region_id: "plaza" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("modified"));
});

test("genPopulateRegion calls gen_populate_region", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_populate_region", { status: "populated", count: 12 }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genPopulateRegion({ region_id: "village_center" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("populated"));
});

test("genEvaluateScene calls gen_evaluate_scene", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_evaluate_scene", { screenshot: "base64", annotations: 5 }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genEvaluateScene({ camera: "top_down" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("annotations"));
});

test("genAutoRefine calls gen_auto_refine", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_auto_refine", { iterations: 2, status: "refined" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAutoRefine({ max_iterations: 2 }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("refined"));
});

test("genUndo calls gen_undo", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_undo", { status: "undone" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genUndo({}, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("undone"));
});

// ── Memory tool wrapper tests ──────────────────────────────────────

test("genMemorySearch calls memory_search via 1-shot", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["memory_search", { results: [{ id: "mem_1", snippet: "Project uses Rust + Bevy" }] }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genMemorySearch({ query: "Rust" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("mem_1"));
  assert.equal(mock.callCount, 1);
});

test("genMemoryGet calls memory_get via 1-shot", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["memory_get", { id: "mem_1", content: "Project uses Rust + Bevy for the engine." }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genMemoryGet({ id: "mem_1" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("Rust + Bevy"));
});

test("genMemorySave calls memory_save via 1-shot", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["memory_save", { id: "mem_2", status: "saved" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genMemorySave({ content: "Remember this preference" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("saved"));
});

test("genMemoryLog calls memory_log via 1-shot", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["memory_log", { id: "log_3", date: "2026-06-06", status: "logged" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genMemoryLog({ content: "Today's session notes" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("logged"));
});

// ── Phase 2d: Player & NPC ─────────────────────────────────────────

test("genSpawnPlayer calls gen_spawn_player", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_spawn_player", { status: "spawned", position: [0, 2, 0] }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genSpawnPlayer({ position: [0, 2, 0], camera_mode: "third_person" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("spawned"));
});

test("genAddNpc calls gen_add_npc", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_npc", { name: "Guard", behavior: "patrol", status: "created" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddNpc({ name: "Guard", behavior: "patrol" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("created"));
});

test("genSetNpcDialogue calls gen_set_npc_dialogue", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_set_npc_dialogue", { npc: "Guard", nodes: 3, status: "set" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genSetNpcDialogue({
    npc_name: "Guard",
    dialogue: [{ speaker: "npc", text: "Hello, traveler!" }],
  }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("set"));
});

// ── Phase 2d: Interactions ─────────────────────────────────────────

test("genAddTrigger calls gen_add_trigger", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_trigger", { type: "proximity", status: "added" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddTrigger({ type: "proximity", radius: 5 }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("added"));
});

test("genAddTeleporter calls gen_add_teleporter", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_teleporter", { status: "created" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddTeleporter({
    source_position: [0, 0, 0],
    destination_position: [10, 0, 10],
  }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("created"));
});

test("genAddCollectible calls gen_add_collectible", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_collectible", { entity: "Coin", score: 10, status: "collectible" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddCollectible({ entity_name: "Coin", score: 10 }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("collectible"));
});

test("genAddDoor calls gen_add_door", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_door", { entity: "Gate", status: "door_added" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddDoor({ entity_name: "Gate" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("door_added"));
});

// ── Phase 2d: Physics ──────────────────────────────────────────────

test("genSetPhysics calls gen_set_physics", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_set_physics", { entity: "Barrel", body_type: "dynamic", status: "physics_set" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genSetPhysics({ entity_name: "Barrel", body_type: "dynamic", mass: 10 }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("physics_set"));
});

test("genAddCollider calls gen_add_collider", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_collider", { entity: "Wall", shape: "box", status: "added" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddCollider({ entity_name: "Wall", shape: "box" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("added"));
});

test("genAddForce calls gen_add_force", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_force", { type: "impulse", status: "applied" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddForce({ force: [0, 100, 0], type: "impulse" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("applied"));
});

test("genSetGravity calls gen_set_gravity", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_set_gravity", { preset: "moon", status: "set" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genSetGravity({ preset: "moon" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("set"));
});

// ── Phase 2d: Terrain & Sky ────────────────────────────────────────

test("genAddTerrain calls gen_add_terrain", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_terrain", { status: "generated", seed: 42 }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddTerrain({ seed: 42, height_scale: 5 }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("generated"));
});

test("genAddWater calls gen_add_water", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_water", { status: "created", color: "#2266cc" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddWater({ color: "#2266cc" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("created"));
});

test("genAddFoliage calls gen_add_foliage", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_add_foliage", { type: "mixed", density: 0.5, status: "scattered" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAddFoliage({ type: "mixed", density: 0.5 }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("scattered"));
});

test("genSetSky calls gen_set_sky", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_set_sky", { preset: "sunset", status: "set" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genSetSky({ preset: "sunset" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("set"));
});

// ── Phase 2d: Audio ────────────────────────────────────────────────

test("genSetAmbience calls gen_set_ambience", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_set_ambience", { preset: "forest", volume: 0.5, status: "set" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genSetAmbience({ preset: "forest", volume: 0.5 }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("set"));
});

test("genAudioEmitter calls gen_audio_emitter", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_audio_emitter", { sound: "fire_crackle", loop: true, status: "placed" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genAudioEmitter({ sound: "fire_crackle", loop: true }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("placed"));
});

// ── Phase 2e: Export screenshot ────────────────────────────────────

test("genExportScreenshot calls gen_export_screenshot", async () => {
  const responses = new Map([
    ["initialize", { protocolVersion: "2024-11-05" }],
    ["gen_export_screenshot", { path: "screenshots/scene_001.png", status: "exported" }],
  ]);
  const mock = createMockSpawn(responses);
  const result = await genExportScreenshot({ path: "screenshots/scene_001.png" }, { spawnFn: mock.spawnFn, timeoutMs: 5000 });
  assert.ok(result.content[0].text.includes("exported"));
});
