import assert from "node:assert/strict";
import test from "node:test";

const {
  resolveTemplate,
  listTemplates,
  formatTemplateShort,
  BUILTIN_TEMPLATES,
  defaultRegistry,
  genLoadTemplate,
  genListTemplates,
} = await import("../lib/world-templates.ts");

// ── Metadata parsing ────────────────────────────────────────────────

test("BUILTIN_TEMPLATES has expected starter set", () => {
  const ids = BUILTIN_TEMPLATES.map((t) => t.id);
  assert.ok(ids.includes("fantasy-village"), "missing fantasy-village");
  assert.ok(ids.includes("horror-house"), "missing horror-house");
  assert.ok(ids.includes("sci-fi-station"), "missing sci-fi-station");
  assert.ok(ids.includes("nature-campsite"), "missing nature-campsite");
  assert.ok(ids.includes("dungeon-crawler"), "missing dungeon-crawler");
});

test("each template has required metadata fields", () => {
  for (const t of BUILTIN_TEMPLATES) {
    assert.ok(typeof t.id === "string" && t.id.length > 0, `${t.id}: missing id`);
    assert.ok(typeof t.name === "string" && t.name.length > 0, `${t.id}: missing name`);
    assert.ok(typeof t.description === "string" && t.description.length > 0, `${t.id}: missing description`);
    assert.ok(Array.isArray(t.tags) && t.tags.length > 0, `${t.id}: missing tags`);
  }
});

test("resolveTemplate finds built-in template by id", () => {
  const t = resolveTemplate("fantasy-village");
  assert.ok(t, "template should be found");
  assert.equal(t.id, "fantasy-village");
  assert.equal(t.name, "Fantasy Village");
  assert.ok(t.tags.includes("medieval"));
  assert.equal(t.style, "medieval");
  assert.equal(t.worldName, "fantasy-village");
});

test("resolveTemplate matches template ids case-insensitively", () => {
  const fantasy = resolveTemplate("Fantasy-Village");
  assert.ok(fantasy, "template should be found");
  assert.equal(fantasy.id, "fantasy-village");

  const station = resolveTemplate("SCI-FI-STATION");
  assert.ok(station, "template should be found");
  assert.equal(station.id, "sci-fi-station");
});

test("resolveTemplate returns undefined for unknown id", () => {
  const t = resolveTemplate("does-not-exist");
  assert.equal(t, undefined);
});

test("resolveTemplate uses custom registry", () => {
  const customRegistry = {
    templates: [{
      id: "custom",
      name: "Custom",
      description: "A custom template",
      tags: ["test"],
    }],
  };
  const t = resolveTemplate("custom", customRegistry);
  assert.ok(t);
  assert.equal(t.name, "Custom");

  // built-in should not be found in custom registry
  const builtin = resolveTemplate("fantasy-village", customRegistry);
  assert.equal(builtin, undefined);
});

test("resolveTemplate returns worldName when specified", () => {
  const customRegistry = {
    templates: [{
      id: "my-id",
      name: "My Name",
      description: "test",
      tags: ["test"],
      worldName: "actual-world-name",
    }],
  };
  const t = resolveTemplate("my-id", customRegistry);
  assert.ok(t);
  assert.equal(t.worldName, "actual-world-name");
});

test("resolveTemplate preserves omitted worldName", () => {
  const customRegistry = {
    templates: [{
      id: "no-world-name",
      name: "No World Name",
      description: "test",
      tags: ["test"],
      // worldName intentionally omitted
    }],
  };
  const t = resolveTemplate("no-world-name", customRegistry);
  assert.ok(t);
  assert.equal(t.worldName, undefined);
});

test("listTemplates returns all when no tag filter", () => {
  const all = listTemplates({});
  assert.equal(all.length, BUILTIN_TEMPLATES.length);
});

test("listTemplates filters by tag", () => {
  const medieval = listTemplates({ tag: "medieval" });
  assert.ok(medieval.length >= 2, "at least fantasy-village and dungeon-crawler");
  for (const t of medieval) {
    assert.ok(t.tags.some((tg) => tg.toLowerCase() === "medieval"), `${t.id} should have medieval tag`);
  }
});

test("listTemplates returns empty for non-existent tag", () => {
  const result = listTemplates({ tag: "nonexistent" });
  assert.equal(result.length, 0);
});

test("listTemplates is case-insensitive on tag", () => {
  const upper = listTemplates({ tag: "MEDIEVAL" });
  const lower = listTemplates({ tag: "medieval" });
  assert.equal(upper.length, lower.length);
});

test("formatTemplateShort includes id, name, and description", () => {
  const t = BUILTIN_TEMPLATES[0];
  const line = formatTemplateShort(t);
  assert.ok(line.includes(t.id));
  assert.ok(line.includes(t.name));
  assert.ok(line.includes(t.description));
});

// ── Missing-template handling ────────────────────────────────────────

test("genLoadTemplate returns error for unknown template id", async () => {
  const result = await genLoadTemplate({ id: "nonexistent-template" });
  assert.equal(result.isError, true);
  const text = result.content[0].text;
  assert.ok(text.includes("nonexistent-template"), "should mention requested id");
  assert.ok(text.includes("fantasy-village"), "should list available templates");
  assert.ok(text.includes("horror-house"), "should list available templates");
});

test("genLoadTemplate error details include requestedId and availableIds", async () => {
  const result = await genLoadTemplate({ id: "nope" });
  assert.equal(result.details.requestedId, "nope");
  assert.ok(Array.isArray(result.details.availableIds));
  assert.ok(result.details.availableIds.length > 0);
});

// ── genListTemplates ─────────────────────────────────────────────────

test("genListTemplates returns all templates", async () => {
  const result = await genListTemplates({});
  assert.equal(result.isError, undefined);
  const text = result.content[0].text;
  assert.ok(text.includes("fantasy-village"));
  assert.ok(text.includes("horror-house"));
  assert.ok(text.includes("sci-fi-station"));
});

test("genListTemplates includes count in output", async () => {
  const result = await genListTemplates({});
  const text = result.content[0].text;
  assert.ok(text.includes(`${BUILTIN_TEMPLATES.length}`));
});

test("genListTemplates filters by tag", async () => {
  const result = await genListTemplates({ tag: "sci-fi" });
  const text = result.content[0].text;
  assert.ok(text.includes("sci-fi-station"));
  assert.ok(!text.includes("fantasy-village"));
});

test("genListTemplates shows available tags when no matches", async () => {
  const result = await genListTemplates({ tag: "nonexistent" });
  const text = result.content[0].text;
  assert.ok(text.includes("No templates found"));
  assert.ok(text.includes("medieval"), "should suggest available tags");
});

test("genListTemplates details include count and ids", async () => {
  const result = await genListTemplates({});
  assert.equal(result.details.count, BUILTIN_TEMPLATES.length);
  assert.ok(Array.isArray(result.details.ids));
  assert.equal(result.details.ids.length, BUILTIN_TEMPLATES.length);
});
