/**
 * Curated gen tool wrappers for Pi.
 *
 * Each wrapper provides:
 * - TypeBox parameter schema
 * - Human-readable prompt snippet
 * - Single gen tool dispatch via genCallTool
 *
 * The generic `localgpt_gen_call` tool handles everything not covered here.
 */

import { Type, type TObject, type TSchema } from "typebox";
import { genCallTool, type GenCallOptions } from "./gen-mcp-client.ts";

// ── Helper ──────────────────────────────────────────────────────────

function toolResult(text: string, details?: unknown) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

// ── Screenshot ──────────────────────────────────────────────────────

export const screenshotSchema = Type.Object({
  width: Type.Optional(Type.Number({ description: "Image width in pixels. Default: viewport width." })),
  height: Type.Optional(Type.Number({ description: "Image height in pixels. Default: viewport height." })),
});

export async function genScreenshot(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_screenshot", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Scene info ──────────────────────────────────────────────────────

export const sceneInfoSchema = Type.Object({});

export async function genSceneInfo(
  _params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_scene_info", {}, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Entity info ─────────────────────────────────────────────────────

export const entityInfoSchema = Type.Object({
  name: Type.String({ description: "Entity name to inspect." }),
});

export async function genEntityInfo(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_entity_info", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Spawn primitive ─────────────────────────────────────────────────

export const spawnPrimitiveSchema = Type.Object({
  type: Type.String({ description: "Primitive type: sphere, cube, cylinder, torus, pyramid, cone, plane, capsule." }),
  name: Type.Optional(Type.String({ description: "Entity name. Auto-generated if omitted." })),
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] world position." })),
  scale: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] scale." })),
  color: Type.Optional(Type.String({ description: "Hex color, e.g. #ff6600." })),
  material: Type.Optional(Type.String({ description: "Material preset: standard, emissive, metallic, glass, wireframe." })),
});

export async function genSpawnPrimitive(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_spawn_primitive", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Spawn batch ─────────────────────────────────────────────────────

export const spawnBatchSchema = Type.Object({
  entities: Type.Array(Type.Record(Type.String(), Type.Unknown()), {
    description: "Array of entity specs. Each has: type, position, scale?, color?, name?",
  }),
});

export async function genSpawnBatch(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_spawn_batch", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Modify entity ───────────────────────────────────────────────────

export const modifyEntitySchema = Type.Object({
  name: Type.String({ description: "Entity name to modify." }),
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()])),
  rotation: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] euler degrees." })),
  scale: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()])),
  color: Type.Optional(Type.String({ description: "Hex color." })),
  material: Type.Optional(Type.String()),
  visible: Type.Optional(Type.Boolean()),
});

export async function genModifyEntity(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_modify_entity", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Delete entity ───────────────────────────────────────────────────

export const deleteEntitySchema = Type.Object({
  name: Type.String({ description: "Entity name to delete." }),
});

export async function genDeleteEntity(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_delete_entity", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Camera ──────────────────────────────────────────────────────────

export const setCameraSchema = Type.Object({
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()])),
  look_at: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "Point the camera looks at [x, y, z]." })),
  fov: Type.Optional(Type.Number({ description: "Field of view in degrees." })),
});

export async function genSetCamera(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_camera", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Light ───────────────────────────────────────────────────────────

export const setLightSchema = Type.Object({
  type: Type.Optional(Type.String({ description: "Light type: directional, point, spot." })),
  color: Type.Optional(Type.String({ description: "Hex color." })),
  intensity: Type.Optional(Type.Number({ description: "Light intensity." })),
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()])),
  direction: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()])),
});

export async function genSetLight(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_light", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Environment ─────────────────────────────────────────────────────

export const setEnvironmentSchema = Type.Object({
  background_color: Type.Optional(Type.String({ description: "Background hex color." })),
  ambient_color: Type.Optional(Type.String({ description: "Ambient light hex color." })),
  ambient_intensity: Type.Optional(Type.Number()),
});

export async function genSetEnvironment(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_environment", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Plan layout (WorldGen) ──────────────────────────────────────────

export const planLayoutSchema = Type.Object({
  description: Type.String({ description: "Text description of the world layout to generate." }),
  style: Type.Optional(Type.String({ description: "Style hint: medieval, sci-fi, nature, urban, etc." })),
});

export async function genPlanLayout(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_plan_layout", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Apply blockout ──────────────────────────────────────────────────

export const applyBlockoutSchema = Type.Object({
  layout: Type.Record(Type.String(), Type.Unknown(), { description: "Layout spec from gen_plan_layout result." }),
});

export async function genApplyBlockout(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_apply_blockout", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Export glTF ─────────────────────────────────────────────────────

export const exportGltfSchema = Type.Object({
  path: Type.String({ description: "Output file path for the glTF/GLB file." }),
});

export async function genExportGltf(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_export_gltf", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Export HTML ─────────────────────────────────────────────────────

export const exportHtmlSchema = Type.Object({
  path: Type.String({ description: "Output file path for the self-contained HTML file." }),
});

export async function genExportHtml(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_export_html", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Save world ──────────────────────────────────────────────────────

export const saveWorldSchema = Type.Object({
  name: Type.String({ description: "Skill name to save the world as." }),
});

export async function genSaveWorld(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_save_world", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Load world ──────────────────────────────────────────────────────

export const loadWorldSchema = Type.Object({
  name: Type.String({ description: "Skill name to load." }),
});

export async function genLoadWorld(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_load_world", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Clear scene ─────────────────────────────────────────────────────

export const clearSceneSchema = Type.Object({});

export async function genClearScene(
  _params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_clear_scene", {}, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Modify blockout (WorldGen) ────────────────────────────────────

export const modifyBlockoutSchema = Type.Object({
  action: Type.String({ description: "Action: add, remove, resize, move." }),
  region_id: Type.Optional(Type.String({ description: "Target region id." })),
  spec: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Region spec for add/resize/move." })),
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()])),
  size: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()])),
});

export async function genModifyBlockout(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_modify_blockout", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Populate region (WorldGen) ────────────────────────────────────

export const populateRegionSchema = Type.Object({
  region_id: Type.String({ description: "Region id from blockout to populate." }),
  style: Type.Optional(Type.String({ description: "Style hint for placement." })),
  hero_density: Type.Optional(Type.Number()),
  medium_density: Type.Optional(Type.Number()),
  decorative_density: Type.Optional(Type.Number()),
});

export async function genPopulateRegion(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_populate_region", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Set tier / role (WorldGen) ────────────────────────────────────

export const setTierSchema = Type.Object({
  name: Type.String({ description: "Entity name." }),
  tier: Type.String({ description: "Placement tier: hero, medium, decorative." }),
});

export async function genSetTier(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_tier", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const setRoleSchema = Type.Object({
  name: Type.String({ description: "Entity name." }),
  role: Type.String({ description: "Semantic role: ground, structure, prop, vegetation, water, sky, light, effect." }),
});

export async function genSetRole(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_role", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Evaluate & refine (WorldGen) ──────────────────────────────────

export const evaluateSceneSchema = Type.Object({
  highlight_entities: Type.Optional(Type.Array(Type.String(), { description: "Entity names to highlight with red overlay." })),
  camera: Type.Optional(Type.String({ description: "Camera preset: current, top_down, isometric, front, entity_focus." })),
  focus_entity: Type.Optional(Type.String({ description: "Entity name for entity_focus camera." })),
  annotate: Type.Optional(Type.Boolean({ description: "Annotate screenshot with entity names and bounding boxes." })),
});

export async function genEvaluateScene(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_evaluate_scene", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const autoRefineSchema = Type.Object({
  max_iterations: Type.Optional(Type.Number({ description: "Maximum refine loop iterations. Default: 3." })),
  goal: Type.Optional(Type.String({ description: "Quality goal or criteria for refinement." })),
});

export async function genAutoRefine(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_auto_refine", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Navmesh & regenerate (WorldGen) ───────────────────────────────

export const buildNavmeshSchema = Type.Object({
  cell_size: Type.Optional(Type.Number({ description: "Navmesh grid cell size in meters." })),
});

export async function genBuildNavmesh(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_build_navmesh", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const regenerateSchema = Type.Object({
  region_ids: Type.Optional(Type.Array(Type.String(), { description: "Regions to regenerate. Default: all changed." })),
  preserve_manual: Type.Optional(Type.Boolean({ description: "Preserve manually placed entities. Default: true." })),
});

export async function genRegenerate(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_regenerate", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Undo / Redo ─────────────────────────────────────────────────────

export const undoSchema = Type.Object({});
export const redoSchema = Type.Object({});

export async function genUndo(
  _params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_undo", {}, options);
  return toolResult(typeof result === "string" ? result : JSON.stringify(result, null, 2), result);
}

export async function genRedo(
  _params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_redo", {}, options);
  return toolResult(typeof result === "string" ? result : JSON.stringify(result, null, 2), result);
}

// ── Memory tools ────────────────────────────────────────────────────

export const memorySearchSchema = Type.Object({
  query: Type.String({ description: "Search query for LocalGPT workspace memory." }),
  limit: Type.Optional(Type.Number({ description: "Maximum number of hits. Default: 10." })),
});

export async function genMemorySearch(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("memory_search", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const memoryGetSchema = Type.Object({
  id: Type.String({ description: "Memory entry ID from search results." }),
});

export async function genMemoryGet(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("memory_get", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const memorySaveSchema = Type.Object({
  content: Type.String({ description: "Markdown text to save as durable cross-session memory." }),
  title: Type.Optional(Type.String({ description: "Optional title for the memory entry." })),
});

export async function genMemorySave(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("memory_save", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const memoryLogSchema = Type.Object({
  content: Type.String({ description: "Markdown text to append as a daily log entry." }),
  date: Type.Optional(Type.String({ description: "Date in YYYY-MM-DD format. Default: today." })),
});

export async function genMemoryLog(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("memory_log", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Player & NPC ────────────────────────────────────────────────────

export const spawnPlayerSchema = Type.Object({
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] spawn position for the player." })),
  camera_mode: Type.Optional(Type.String({ description: "Camera mode: first_person, third_person, top_down, fixed." })),
});

export async function genSpawnPlayer(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_spawn_player", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const addNpcSchema = Type.Object({
  name: Type.Optional(Type.String({ description: "NPC display name." })),
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] spawn position." })),
  behavior: Type.Optional(Type.String({ description: "AI behavior: idle, patrol, wander." })),
  model: Type.Optional(Type.String({ description: "Model or appearance preset for the NPC." })),
});

export async function genAddNpc(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_npc", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const setNpcDialogueSchema = Type.Object({
  npc_name: Type.String({ description: "Name of the target NPC." }),
  dialogue: Type.Array(Type.Object({
    speaker: Type.String({ description: "Speaker label, e.g. 'npc' or 'player'." }),
    text: Type.String({ description: "Dialogue line text." }),
    choices: Type.Optional(Type.Array(Type.Object({
      text: Type.String({ description: "Choice text shown to player." }),
      next: Type.Number({ description: "Index of next dialogue node." }),
    }))),
  }), { description: "Conversation tree as array of dialogue nodes." }),
});

export async function genSetNpcDialogue(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_npc_dialogue", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Interactions ────────────────────────────────────────────────────

export const addTriggerSchema = Type.Object({
  type: Type.String({ description: "Trigger type: proximity, click, area, collision, timer." }),
  target: Type.Optional(Type.String({ description: "Target entity name or region." })),
  action: Type.Optional(Type.String({ description: "Action to perform when triggered." })),
  radius: Type.Optional(Type.Number({ description: "Trigger radius for proximity/area triggers." })),
});

export async function genAddTrigger(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_trigger", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const addTeleporterSchema = Type.Object({
  source_position: Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] teleporter entrance." }),
  destination_position: Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] teleporter exit." }),
  label: Type.Optional(Type.String({ description: "Optional label shown near the teleporter." })),
});

export async function genAddTeleporter(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_teleporter", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const addCollectibleSchema = Type.Object({
  entity_name: Type.String({ description: "Name of entity to make collectible." }),
  score: Type.Optional(Type.Number({ description: "Score value when collected." })),
  effect: Type.Optional(Type.String({ description: "Pickup effect: sparkle, glow, particles, none." })),
  respawn_seconds: Type.Optional(Type.Number({ description: "Respawn time in seconds. Omit for one-time pickup." })),
});

export async function genAddCollectible(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_collectible", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const addDoorSchema = Type.Object({
  entity_name: Type.String({ description: "Name of entity to make a door." }),
  open_direction: Type.Optional(Type.String({ description: "Direction door opens: forward, left, right, up, down." })),
  key_required: Type.Optional(Type.String({ description: "Key item ID required to open." })),
  auto_close_seconds: Type.Optional(Type.Number({ description: "Auto-close after N seconds. Omit to stay open." })),
});

export async function genAddDoor(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_door", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Physics ─────────────────────────────────────────────────────────

export const setPhysicsSchema = Type.Object({
  entity_name: Type.String({ description: "Target entity name." }),
  body_type: Type.String({ description: "Physics body type: dynamic, static, kinematic." }),
  mass: Type.Optional(Type.Number({ description: "Mass in kg. Default based on body type." })),
});

export async function genSetPhysics(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_physics", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const addColliderSchema = Type.Object({
  entity_name: Type.String({ description: "Target entity name." }),
  shape: Type.String({ description: "Collider shape: box, sphere, capsule, cylinder, mesh." }),
  size: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] half-extents for box/capsule/cylinder, or [radius] for sphere." })),
});

export async function genAddCollider(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_collider", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const addForceSchema = Type.Object({
  entity_name: Type.Optional(Type.String({ description: "Target entity. Omit for global force field." })),
  force: Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] force vector or impulse." }),
  type: Type.Optional(Type.String({ description: "Force type: impulse, constant, field." })),
});

export async function genAddForce(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_force", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const setGravitySchema = Type.Object({
  preset: Type.Optional(Type.String({ description: "Gravity preset: earth, moon, mars, zero." })),
  vector: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "Custom [x, y, z] gravity vector." })),
  region: Type.Optional(Type.String({ description: "Limit gravity to a named region." })),
});

export async function genSetGravity(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_gravity", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Terrain & Sky ───────────────────────────────────────────────────

export const addTerrainSchema = Type.Object({
  size: Type.Optional(Type.Tuple([Type.Number(), Type.Number()], { description: "[width, depth] terrain size in meters." })),
  resolution: Type.Optional(Type.Number({ description: "Grid resolution. Default: 256." })),
  height_scale: Type.Optional(Type.Number({ description: "Vertical scale multiplier." })),
  seed: Type.Optional(Type.Number({ description: "Noise seed for reproducible terrain." })),
});

export async function genAddTerrain(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_terrain", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const addWaterSchema = Type.Object({
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] water plane center." })),
  size: Type.Optional(Type.Tuple([Type.Number(), Type.Number()], { description: "[width, depth] water plane size." })),
  color: Type.Optional(Type.String({ description: "Hex water color, e.g. #2266cc." })),
  wave_speed: Type.Optional(Type.Number({ description: "Animation wave speed." })),
});

export async function genAddWater(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_water", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const addFoliageSchema = Type.Object({
  type: Type.Optional(Type.String({ description: "Foliage type: trees, bushes, grass, flowers, rocks, or mixed." })),
  density: Type.Optional(Type.Number({ description: "Scatter density 0-1. Default: 0.3." })),
  region: Type.Optional(Type.String({ description: "Target blockout region name." })),
  seed: Type.Optional(Type.Number({ description: "Noise seed for reproducible scatter." })),
});

export async function genAddFoliage(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_add_foliage", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const setSkySchema = Type.Object({
  preset: Type.Optional(Type.String({ description: "Sky preset: day, sunset, night, overcast, custom." })),
  sun_direction: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] sun direction vector." })),
  ambient_color: Type.Optional(Type.String({ description: "Hex ambient light color, e.g. #334455." })),
  fog_density: Type.Optional(Type.Number({ description: "Volumetric fog density 0-1." })),
  fog_color: Type.Optional(Type.String({ description: "Hex fog color." })),
});

export async function genSetSky(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_sky", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Audio ───────────────────────────────────────────────────────────

export const setAmbienceSchema = Type.Object({
  preset: Type.Optional(Type.String({ description: "Ambience preset: forest, cave, ocean, wind, rain, city, quiet." })),
  volume: Type.Optional(Type.Number({ description: "Volume 0-1. Default: 0.5." })),
});

export async function genSetAmbience(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_set_ambience", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

export const audioEmitterSchema = Type.Object({
  name: Type.Optional(Type.String({ description: "Emitter entity name." })),
  position: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number()], { description: "[x, y, z] emitter position." })),
  sound: Type.String({ description: "Sound type: footsteps, water_drip, fire_crackle, wind, birds, door_creak, custom." }),
  loop: Type.Optional(Type.Boolean({ description: "Loop playback. Default: false." })),
  volume: Type.Optional(Type.Number({ description: "Volume 0-1. Default: 0.7." })),
  radius: Type.Optional(Type.Number({ description: "Audible radius in meters." })),
});

export async function genAudioEmitter(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_audio_emitter", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}

// ── Export screenshot ───────────────────────────────────────────────

export const exportScreenshotSchema = Type.Object({
  path: Type.Optional(Type.String({ description: "Output file path. Default: workspace screenshots/ with timestamp." })),
  width: Type.Optional(Type.Number({ description: "Image width in pixels." })),
  height: Type.Optional(Type.Number({ description: "Image height in pixels." })),
});

export async function genExportScreenshot(
  params: Record<string, unknown>,
  options?: GenCallOptions,
) {
  const result = await genCallTool("gen_export_screenshot", params, options);
  return toolResult(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
    result,
  );
}
