# WorldGen pipeline: prompt to refined blockout

This is a representative Pi transcript for the LocalGPT Gen WorldGen flow. The
outputs are abbreviated so the layout object is not duplicated here; pass the
actual `layout` returned by the planning call to the next tool.

## Prerequisites

Start `localgpt-gen` interactively with its Bevy window open, then confirm that
the relay is reachable:

```text
> localgpt_gen_status
Binary: available
Relay: reachable (port 9878)
```

Each curated tool call uses the one-shot MCP bridge. No API key, local
credential, or persistent background process is required by this example.

## Transcript

### 1. Turn a description into a layout plan

```text
> localgpt_gen_plan {
    "description": "A compact coastal watchpost: a cliffside entrance leads to a lighthouse, with a small dock below, a sheltered courtyard, and a clear walking path between them.",
    "style": "nature"
  }

< LocalGPT Gen returns a BlockoutSpec with regions such as
  cliff_entrance, lighthouse, dock, courtyard, and connecting paths.
```

Keep the returned object as `layout`; it is the input for the blockout call.

### 2. Apply the blockout

```text
> localgpt_gen_blockout {
    "layout": <layout returned by localgpt_gen_plan>
  }

< Blockout applied: terrain, regions, and paths are now visible in the scene.
```

### 3. Build the optional navigation mesh

If the world will be explored by a player or NPC, build walkability after the
blockout and before population:

```text
> localgpt_gen_navmesh {}

< Walkability grid built for the current terrain.
```

### 4. Populate the regions

Populate each region using its id from the blockout result. The density values
are illustrative tuning knobs, not required secrets or environment settings.

```text
> localgpt_gen_populate {
    "region_id": "lighthouse",
    "style": "coastal watchpost",
    "hero_density": 1,
    "medium_density": 2,
    "decorative_density": 1
  }

< lighthouse populated

> localgpt_gen_populate {
    "region_id": "courtyard",
    "style": "coastal watchpost",
    "hero_density": 0,
    "medium_density": 2,
    "decorative_density": 3
  }

< courtyard populated

> localgpt_gen_populate {
    "region_id": "dock",
    "style": "weathered harbor",
    "hero_density": 1,
    "medium_density": 2,
    "decorative_density": 2
  }

< dock populated
```

### 5. Evaluate the current scene

```text
> localgpt_gen_evaluate {
    "camera": "isometric",
    "annotate": true,
    "highlight_entities": ["lighthouse", "dock"]
  }

< Evaluation screenshot returned. Example findings:
  - lighthouse is readable from the entrance
  - dock-to-cliff path needs stronger visual guidance
  - courtyard has enough cover
```

The evaluation result is a guide for the next iteration; it is not a guarantee
that the scene meets a particular game or performance requirement.

### 6. Refine against an explicit goal

```text
> localgpt_gen_refine {
    "max_iterations": 2,
    "goal": "Improve wayfinding from the cliffside entrance to the lighthouse while keeping the dock visible and the courtyard sheltered."
  }

< Refinement completed. Re-run localgpt_gen_evaluate to inspect the result.
```

After reviewing the refined scene, you can save it with
`localgpt_gen_save` or export it with `localgpt_gen_export_screenshot`,
`localgpt_gen_export_gltf`, or `localgpt_gen_export_html`.

## Notes

- Tool names in this transcript are the curated `pi-localgpt` names; they are
  not direct shell commands.
- The plan, blockout, populate, evaluate, and refine steps are separate calls,
  so a failed or unreachable relay can be diagnosed before continuing.
- For a vault note or Roblox trend summary, use
  `localgpt_gen_plan_from_note` or `localgpt_gen_plan_from_roblox_trend` as the
  first step instead of `localgpt_gen_plan`.
