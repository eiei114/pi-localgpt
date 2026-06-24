import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { genCallTool } from "../lib/gen-mcp-client.ts";
import { formatGenStatus, inspectGenStatus } from "../lib/gen-status.ts";
import { formatLocalGptStatus, inspectLocalGptStatus, statusNotificationLevel } from "../lib/localgpt-status.ts";
import {
  screenshotSchema, genScreenshot,
  sceneInfoSchema, genSceneInfo,
  entityInfoSchema, genEntityInfo,
  spawnPrimitiveSchema, genSpawnPrimitive,
  spawnBatchSchema, genSpawnBatch,
  modifyEntitySchema, genModifyEntity,
  deleteEntitySchema, genDeleteEntity,
  setCameraSchema, genSetCamera,
  setLightSchema, genSetLight,
  setEnvironmentSchema, genSetEnvironment,
  planLayoutSchema, genPlanLayout,
  applyBlockoutSchema, genApplyBlockout,
  modifyBlockoutSchema, genModifyBlockout,
  populateRegionSchema, genPopulateRegion,
  setTierSchema, genSetTier,
  setRoleSchema, genSetRole,
  evaluateSceneSchema, genEvaluateScene,
  autoRefineSchema, genAutoRefine,
  buildNavmeshSchema, genBuildNavmesh,
  regenerateSchema, genRegenerate,
  exportGltfSchema, genExportGltf,
  exportHtmlSchema, genExportHtml,
  saveWorldSchema, genSaveWorld,
  loadWorldSchema, genLoadWorld,
  clearSceneSchema, genClearScene,
  undoSchema, genUndo,
  redoSchema, genRedo,
  designLogSearchSchema, genDesignLogSearch,
  designLogGetSchema, genDesignLogGet,
  designLogSaveSchema, genDesignLogSave,
  designLogLogSchema, genDesignLogLog,
  spawnPlayerSchema, genSpawnPlayer,
  addNpcSchema, genAddNpc,
  setNpcDialogueSchema, genSetNpcDialogue,
  addTriggerSchema, genAddTrigger,
  addTeleporterSchema, genAddTeleporter,
  addCollectibleSchema, genAddCollectible,
  addDoorSchema, genAddDoor,
  setPhysicsSchema, genSetPhysics,
  addColliderSchema, genAddCollider,
  addForceSchema, genAddForce,
  setGravitySchema, genSetGravity,
  addTerrainSchema, genAddTerrain,
  addWaterSchema, genAddWater,
  addFoliageSchema, genAddFoliage,
  setSkySchema, genSetSky,
  setAmbienceSchema, genSetAmbience,
  audioEmitterSchema, genAudioEmitter,
  exportScreenshotSchema, genExportScreenshot,
} from "../lib/gen-tools.ts";

export default function (pi: ExtensionAPI) {
  // ── Commands ──────────────────────────────────────────────────────

  pi.registerCommand("localgpt:status", {
    description: "Show LocalGPT design-log workspace readiness (direct filesystem; no binary spawn)",
    handler: async (_args, ctx) => {
      try {
        const summary = await inspectLocalGptStatus();
        ctx.ui.notify(formatLocalGptStatus(summary), statusNotificationLevel(summary));
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("localgpt:gen-status", {
    description: "Check localgpt-gen binary and relay availability",
    handler: async (_args, ctx) => {
      try {
        const summary = await inspectGenStatus();
        ctx.ui.notify(formatGenStatus(summary), summary.ok ? "info" : "warning");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  // ── Generic gen call ─────────────────────────────────────────────

  const genCallParameters = Type.Object({
    tool: Type.String({ description: "Gen or design-log tool name, e.g. gen_screenshot, gen_scene_info, gen_spawn_primitive, memory_search" }),
    args: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Arguments for the tool" })),
  });

  pi.registerTool({
    name: "localgpt_status",
    label: "LocalGPT Status",
    description: "Report LocalGPT config/workspace readiness for the design log. No localgpt binary spawn; keyword search only.",
    promptSnippet: "localgpt_status: check LocalGPT design-log workspace paths before search or write tools",
    promptGuidelines: [
      "Use before localgpt_design_log_search when workspace setup is uncertain.",
      "Reads markdown paths directly from disk; does not spawn the localgpt-gen binary.",
      "Returns structured JSON with config path, workspace path, DESIGN-LOG.md / today log presence, and searchMode keyword.",
    ],
    parameters: Type.Object({}),
    async execute() {
      const summary = await inspectLocalGptStatus();
      return {
        content: [{ type: "text", text: formatLocalGptStatus(summary) }],
        details: summary,
      };
    },
  });

  pi.registerTool({
    name: "localgpt_gen_status",
    label: "LocalGPT Gen Status",
    description: "Check localgpt-gen binary availability and relay reachability. Each check is a 1-shot spawn — no persistent process.",
    promptSnippet: "localgpt_gen_status: check if localgpt-gen is available before calling gen or design-log tools",
    promptGuidelines: [
      "Call before any localgpt_gen_call to verify the binary exists and relay is reachable.",
      "Returns binary version, relay status, and available tool count.",
      "Requires localgpt-gen running interactively for relay to work.",
    ],
    parameters: Type.Object({}),
    async execute() {
      const summary = await inspectGenStatus();
      return {
        content: [{ type: "text", text: formatGenStatus(summary) }],
        details: summary,
      };
    },
  });

  pi.registerTool({
    name: "localgpt_gen_call",
    label: "LocalGPT Gen Call",
    description: "Call a localgpt-gen tool via 1-shot `mcp-server --connect`. Spawns a short-lived process, sends one MCP request, exits. No persistent background process. Requires localgpt-gen running interactively.",
    promptSnippet: "localgpt_gen_call: call a localgpt-gen tool (gen_screenshot, gen_spawn_primitive, memory_search, etc.) via 1-shot CLI",
    promptGuidelines: [
      "Each call spawns `localgpt-gen mcp-server --connect`, sends one MCP request, then exits. No persistent process.",
      "Requires localgpt-gen running interactively (the Bevy window) for --connect relay to work.",
      "Use localgpt_gen_status to check availability first.",
      "All gen + design-log tools available via this generic wrapper.",
    ],
    parameters: genCallParameters,
    async execute(_toolCallId, params, signal) {
      try {
        const result = await genCallTool(params.tool, (params.args as Record<string, unknown>) ?? {}, { signal });

        const text = typeof result === "string"
          ? result
          : JSON.stringify(result, null, 2);

        return {
          content: [{ type: "text", text }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `localgpt_gen_call error: ${message}` }],
          isError: true,
          details: { error: message },
        };
      }
    },
  });

  // ── Curated tools ─────────────────────────────────────────────────

  const genToolMeta = [
    // Design log
    { name: "localgpt_design_log_search", label: "Design Log Search", desc: "Search LocalGPT workspace design log (semantic + keyword) via 1-shot CLI. Requires localgpt-gen running.", schema: designLogSearchSchema, fn: genDesignLogSearch, snippet: "localgpt_design_log_search: recall prior level-design notes from the LocalGPT design log" },
    { name: "localgpt_design_log_get", label: "Design Log Get", desc: "Read a specific LocalGPT design log entry by ID via 1-shot CLI. Requires localgpt-gen running.", schema: designLogGetSchema, fn: genDesignLogGet, snippet: "localgpt_design_log_get: read a full design log entry from a search result ID" },
    { name: "localgpt_design_log_save", label: "Design Log Save", desc: "Save durable cross-session level-design context to the LocalGPT design log via 1-shot CLI. Requires localgpt-gen running.", schema: designLogSaveSchema, fn: genDesignLogSave, snippet: "localgpt_design_log_save: persist stable level-design decisions and preferences across Pi sessions" },
    { name: "localgpt_design_log_log", label: "Design Log Log", desc: "Append a timestamped daily design log entry via 1-shot CLI. Requires localgpt-gen running.", schema: designLogLogSchema, fn: genDesignLogLog, snippet: "localgpt_design_log_log: append a timestamped note to today's LocalGPT design log" },
    { name: "localgpt_memory_search", label: "Memory Search (Legacy)", desc: "Legacy alias for localgpt_design_log_search. Requires localgpt-gen running.", schema: designLogSearchSchema, fn: genDesignLogSearch, snippet: "localgpt_memory_search: legacy alias for localgpt_design_log_search" },
    { name: "localgpt_memory_get", label: "Memory Get (Legacy)", desc: "Legacy alias for localgpt_design_log_get. Requires localgpt-gen running.", schema: designLogGetSchema, fn: genDesignLogGet, snippet: "localgpt_memory_get: legacy alias for localgpt_design_log_get" },
    { name: "localgpt_memory_save", label: "Memory Save (Legacy)", desc: "Legacy alias for localgpt_design_log_save. Requires localgpt-gen running.", schema: designLogSaveSchema, fn: genDesignLogSave, snippet: "localgpt_memory_save: legacy alias for localgpt_design_log_save" },
    { name: "localgpt_memory_log", label: "Memory Log (Legacy)", desc: "Legacy alias for localgpt_design_log_log. Requires localgpt-gen running.", schema: designLogLogSchema, fn: genDesignLogLog, snippet: "localgpt_memory_log: legacy alias for localgpt_design_log_log" },
    // Player & NPC
    { name: "localgpt_gen_spawn_player", label: "Gen Spawn Player", desc: "Spawn controllable player character via 1-shot CLI. Requires localgpt-gen running.", schema: spawnPlayerSchema, fn: genSpawnPlayer, snippet: "localgpt_gen_spawn_player: spawn a player character with movement and camera" },
    { name: "localgpt_gen_add_npc", label: "Gen Add NPC", desc: "Create NPC with behavior via 1-shot CLI. Requires localgpt-gen running.", schema: addNpcSchema, fn: genAddNpc, snippet: "localgpt_gen_add_npc: create an NPC with idle/patrol/wander behavior" },
    { name: "localgpt_gen_npc_dialogue", label: "Gen NPC Dialogue", desc: "Attach conversation tree to NPC via 1-shot CLI. Requires localgpt-gen running.", schema: setNpcDialogueSchema, fn: genSetNpcDialogue, snippet: "localgpt_gen_npc_dialogue: set branching dialogue for an NPC" },
    // Interactions
    { name: "localgpt_gen_add_trigger", label: "Gen Add Trigger", desc: "Add trigger+action pair via 1-shot CLI. Requires localgpt-gen running.", schema: addTriggerSchema, fn: genAddTrigger, snippet: "localgpt_gen_add_trigger: add proximity/click/area trigger with action" },
    { name: "localgpt_gen_add_teleporter", label: "Gen Add Teleporter", desc: "Create teleporter portal via 1-shot CLI. Requires localgpt-gen running.", schema: addTeleporterSchema, fn: genAddTeleporter, snippet: "localgpt_gen_add_teleporter: create a teleporter between two points" },
    { name: "localgpt_gen_add_collectible", label: "Gen Add Collectible", desc: "Make entity collectible via 1-shot CLI. Requires localgpt-gen running.", schema: addCollectibleSchema, fn: genAddCollectible, snippet: "localgpt_gen_add_collectible: make an entity a collectible pickup" },
    { name: "localgpt_gen_add_door", label: "Gen Add Door", desc: "Add interactive door behavior via 1-shot CLI. Requires localgpt-gen running.", schema: addDoorSchema, fn: genAddDoor, snippet: "localgpt_gen_add_door: add interactive door with optional key requirement" },
    // Physics
    { name: "localgpt_gen_set_physics", label: "Gen Set Physics", desc: "Enable physics body on entity via 1-shot CLI. Requires localgpt-gen running.", schema: setPhysicsSchema, fn: genSetPhysics, snippet: "localgpt_gen_set_physics: set dynamic/static/kinematic physics body" },
    { name: "localgpt_gen_add_collider", label: "Gen Add Collider", desc: "Add collision shape via 1-shot CLI. Requires localgpt-gen running.", schema: addColliderSchema, fn: genAddCollider, snippet: "localgpt_gen_add_collider: add box/sphere/capsule/cylinder collider" },
    { name: "localgpt_gen_add_force", label: "Gen Add Force", desc: "Apply force or impulse via 1-shot CLI. Requires localgpt-gen running.", schema: addForceSchema, fn: genAddForce, snippet: "localgpt_gen_add_force: apply impulse/constant force or field" },
    { name: "localgpt_gen_set_gravity", label: "Gen Set Gravity", desc: "Set global or regional gravity via 1-shot CLI. Requires localgpt-gen running.", schema: setGravitySchema, fn: genSetGravity, snippet: "localgpt_gen_set_gravity: set gravity preset or custom vector" },
    // Terrain & Sky
    { name: "localgpt_gen_add_terrain", label: "Gen Add Terrain", desc: "Generate procedural terrain via 1-shot CLI. Requires localgpt-gen running.", schema: addTerrainSchema, fn: genAddTerrain, snippet: "localgpt_gen_add_terrain: generate Perlin/Simplex noise terrain" },
    { name: "localgpt_gen_add_water", label: "Gen Add Water", desc: "Create water plane via 1-shot CLI. Requires localgpt-gen running.", schema: addWaterSchema, fn: genAddWater, snippet: "localgpt_gen_add_water: add animated water plane" },
    { name: "localgpt_gen_add_foliage", label: "Gen Add Foliage", desc: "Scatter vegetation via 1-shot CLI. Requires localgpt-gen running.", schema: addFoliageSchema, fn: genAddFoliage, snippet: "localgpt_gen_add_foliage: scatter trees/bushes/grass/flowers/rocks" },
    { name: "localgpt_gen_set_sky", label: "Gen Set Sky", desc: "Configure sky and atmosphere via 1-shot CLI. Requires localgpt-gen running.", schema: setSkySchema, fn: genSetSky, snippet: "localgpt_gen_set_sky: set sky preset, sun, ambient, fog" },
    // Audio
    { name: "localgpt_gen_set_ambience", label: "Gen Set Ambience", desc: "Set ambient soundscape via 1-shot CLI. Requires localgpt-gen running.", schema: setAmbienceSchema, fn: genSetAmbience, snippet: "localgpt_gen_set_ambience: set ambient sound (forest, cave, ocean, etc.)" },
    { name: "localgpt_gen_audio_emitter", label: "Gen Audio Emitter", desc: "Place a positional audio source via 1-shot CLI. Requires localgpt-gen running.", schema: audioEmitterSchema, fn: genAudioEmitter, snippet: "localgpt_gen_audio_emitter: place a 3D audio source with loop and radius" },
    // Scene query
    { name: "localgpt_gen_screenshot", label: "Gen Screenshot", desc: "Capture viewport screenshot via 1-shot CLI. Requires localgpt-gen running.", schema: screenshotSchema, fn: genScreenshot, snippet: "localgpt_gen_screenshot: take a screenshot of the 3D scene" },
    { name: "localgpt_gen_scene", label: "Gen Scene Info", desc: "Get complete scene hierarchy via 1-shot CLI. Requires localgpt-gen running.", schema: sceneInfoSchema, fn: genSceneInfo, snippet: "localgpt_gen_scene: inspect current 3D scene state" },
    { name: "localgpt_gen_entity", label: "Gen Entity Info", desc: "Get detailed info about a named entity via 1-shot CLI. Requires localgpt-gen running.", schema: entityInfoSchema, fn: genEntityInfo, snippet: "localgpt_gen_entity: inspect a specific entity in the scene" },
    // Spawn / modify / delete
    { name: "localgpt_gen_spawn", label: "Gen Spawn Primitive", desc: "Spawn a geometric primitive (sphere, cube, cylinder, etc.) via 1-shot CLI. Requires localgpt-gen running.", schema: spawnPrimitiveSchema, fn: genSpawnPrimitive, snippet: "localgpt_gen_spawn: spawn a 3D primitive into the scene" },
    { name: "localgpt_gen_spawn_batch", label: "Gen Spawn Batch", desc: "Spawn multiple primitives in one call via 1-shot CLI. Requires localgpt-gen running.", schema: spawnBatchSchema, fn: genSpawnBatch, snippet: "localgpt_gen_spawn_batch: spawn multiple entities at once" },
    { name: "localgpt_gen_modify", label: "Gen Modify Entity", desc: "Modify entity transform, material, or visibility via 1-shot CLI. Requires localgpt-gen running.", schema: modifyEntitySchema, fn: genModifyEntity, snippet: "localgpt_gen_modify: change position, color, scale of an entity" },
    { name: "localgpt_gen_delete", label: "Gen Delete Entity", desc: "Delete an entity via 1-shot CLI. Requires localgpt-gen running.", schema: deleteEntitySchema, fn: genDeleteEntity, snippet: "localgpt_gen_delete: remove an entity from the scene" },
    // Camera / light / environment
    { name: "localgpt_gen_camera", label: "Gen Set Camera", desc: "Position and orient the camera via 1-shot CLI. Requires localgpt-gen running.", schema: setCameraSchema, fn: genSetCamera, snippet: "localgpt_gen_camera: set camera position and look-at target" },
    { name: "localgpt_gen_light", label: "Gen Set Light", desc: "Configure scene lighting via 1-shot CLI. Requires localgpt-gen running.", schema: setLightSchema, fn: genSetLight, snippet: "localgpt_gen_light: set light type, color, intensity" },
    { name: "localgpt_gen_environment", label: "Gen Set Environment", desc: "Set background color and ambient light via 1-shot CLI. Requires localgpt-gen running.", schema: setEnvironmentSchema, fn: genSetEnvironment, snippet: "localgpt_gen_environment: set background and ambient lighting" },
    // WorldGen pipeline
    { name: "localgpt_gen_plan", label: "Gen Plan Layout", desc: "Generate a structured world layout plan from text description via 1-shot CLI. Requires localgpt-gen running.", schema: planLayoutSchema, fn: genPlanLayout, snippet: "localgpt_gen_plan: plan a world layout from a text description" },
    { name: "localgpt_gen_blockout", label: "Gen Apply Blockout", desc: "Apply a blockout spec to create terrain, regions, and paths via 1-shot CLI. Requires localgpt-gen running.", schema: applyBlockoutSchema, fn: genApplyBlockout, snippet: "localgpt_gen_blockout: apply blockout from plan_layout result" },
    { name: "localgpt_gen_modify_blockout", label: "Gen Modify Blockout", desc: "Add, remove, resize, or move blockout regions via 1-shot CLI. Requires localgpt-gen running.", schema: modifyBlockoutSchema, fn: genModifyBlockout, snippet: "localgpt_gen_modify_blockout: edit blockout regions incrementally" },
    { name: "localgpt_gen_populate", label: "Gen Populate Region", desc: "Populate a blockout region with hero/medium/decorative entities via 1-shot CLI. Requires localgpt-gen running.", schema: populateRegionSchema, fn: genPopulateRegion, snippet: "localgpt_gen_populate: fill a region with procedural placement" },
    { name: "localgpt_gen_set_tier", label: "Gen Set Tier", desc: "Set an entity placement tier (hero, medium, decorative) via 1-shot CLI. Requires localgpt-gen running.", schema: setTierSchema, fn: genSetTier, snippet: "localgpt_gen_set_tier: tag entity placement tier" },
    { name: "localgpt_gen_set_role", label: "Gen Set Role", desc: "Set an entity semantic role (ground, structure, prop, vegetation, etc.) via 1-shot CLI. Requires localgpt-gen running.", schema: setRoleSchema, fn: genSetRole, snippet: "localgpt_gen_set_role: tag entity semantic role for bulk ops" },
    { name: "localgpt_gen_evaluate", label: "Gen Evaluate Scene", desc: "Screenshot scene with optional highlighting for LLM self-evaluation via 1-shot CLI. Requires localgpt-gen running.", schema: evaluateSceneSchema, fn: genEvaluateScene, snippet: "localgpt_gen_evaluate: capture annotated screenshot for quality review" },
    { name: "localgpt_gen_refine", label: "Gen Auto Refine", desc: "Automated evaluate-and-adjust loop via 1-shot CLI. Requires localgpt-gen running.", schema: autoRefineSchema, fn: genAutoRefine, snippet: "localgpt_gen_refine: auto-improve scene via screenshot loop" },
    { name: "localgpt_gen_navmesh", label: "Gen Build Navmesh", desc: "Build walkability grid for current terrain via 1-shot CLI. Requires localgpt-gen running.", schema: buildNavmeshSchema, fn: genBuildNavmesh, snippet: "localgpt_gen_navmesh: build navmesh after blockout" },
    { name: "localgpt_gen_regenerate", label: "Gen Regenerate", desc: "Regenerate regions after blockout edits, preserving manual placements via 1-shot CLI. Requires localgpt-gen running.", schema: regenerateSchema, fn: genRegenerate, snippet: "localgpt_gen_regenerate: refresh regions after blockout changes" },
    // Export & world skills
    { name: "localgpt_gen_export_screenshot", label: "Gen Export Screenshot", desc: "Export viewport screenshot to file via 1-shot CLI. Requires localgpt-gen running.", schema: exportScreenshotSchema, fn: genExportScreenshot, snippet: "localgpt_gen_export_screenshot: export screenshot to file" },
    { name: "localgpt_gen_export_gltf", label: "Gen Export glTF", desc: "Export scene as glTF/GLB via 1-shot CLI. Requires localgpt-gen running.", schema: exportGltfSchema, fn: genExportGltf, snippet: "localgpt_gen_export_gltf: export scene to glTF file" },
    { name: "localgpt_gen_export_html", label: "Gen Export HTML", desc: "Export scene as self-contained HTML via 1-shot CLI. Requires localgpt-gen running.", schema: exportHtmlSchema, fn: genExportHtml, snippet: "localgpt_gen_export_html: export scene to HTML file with Three.js" },
    { name: "localgpt_gen_save", label: "Gen Save World", desc: "Save scene to a world skill via 1-shot CLI. Requires localgpt-gen running.", schema: saveWorldSchema, fn: genSaveWorld, snippet: "localgpt_gen_save: save current scene as a reusable world skill" },
    { name: "localgpt_gen_load", label: "Gen Load World", desc: "Load a saved world via 1-shot CLI. Requires localgpt-gen running.", schema: loadWorldSchema, fn: genLoadWorld, snippet: "localgpt_gen_load: load a previously saved world" },
    // Scene management
    { name: "localgpt_gen_clear", label: "Gen Clear Scene", desc: "Clear all entities, behaviors, and audio via 1-shot CLI. Requires localgpt-gen running.", schema: clearSceneSchema, fn: genClearScene, snippet: "localgpt_gen_clear: clear the entire scene" },
    { name: "localgpt_gen_undo", label: "Gen Undo", desc: "Undo last scene edit via 1-shot CLI. Requires localgpt-gen running.", schema: undoSchema, fn: genUndo, snippet: "localgpt_gen_undo: undo last scene edit" },
    { name: "localgpt_gen_redo", label: "Gen Redo", desc: "Redo previously undone edit via 1-shot CLI. Requires localgpt-gen running.", schema: redoSchema, fn: genRedo, snippet: "localgpt_gen_redo: redo last undone edit" },
  ];

  for (const { name, label, desc, schema, fn, snippet } of genToolMeta) {
    pi.registerTool({
      name,
      label,
      description: desc,
      promptSnippet: snippet,
      promptGuidelines: [
        "1-shot CLI via `localgpt-gen mcp-server --connect`. No persistent process.",
        "Requires localgpt-gen running interactively (Bevy window) for relay to work.",
      ],
      parameters: schema,
      async execute(_toolCallId, params, signal) {
        try {
          return await fn(params as Record<string, unknown>, { signal });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `${name} error: ${message}` }],
            isError: true,
            details: { error: message },
          };
        }
      },
    });
  }
}
