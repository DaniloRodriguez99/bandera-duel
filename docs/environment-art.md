# Environment art conventions

## Implementation and integration

`packages/client/src/environment.ts` adds original procedural surface art. Arena wear uses fixed coordinate hashes, clustered moss/leaf stains, paving cracks, chipped seams and a shaded masonry front face. These are completed procedural decorations; no image assets are implied. There are no new colliders or apparent solid props in walkable space. The central combat lane and home columns receive no scattered detail.

World terrain already includes biome tiles, roads, water, vegetation and settlements. The controller preserves those surfaces and adds contact shadows around existing wall footprints. It does not scatter plants over world zones because its input cannot identify rivers or roads. Village drawings remain in `village.ts`.

Create `decorateEnvironment(scene, { width, height, theme, walls, arena })` after painting the map or zone. Call its `destroy()` before replacing either. It also cleans up on scene shutdown. `update(time, delta)` intentionally does nothing: all details are static. Pass existing terrain rectangles and optionally boundary walls. It never reads or changes authoritative gameplay state.

Each nonempty 512 × 512 chunk is baked into a nearest-filtered texture and a temporary Image at depth 0.2. Arena calls `bakeInto(mapRenderTextures)` to flatten these into the ground once, immediately releasing the intermediate images and textures. Temporary Graphics are also destroyed. Canvas and WebGL share Phaser 3.90's `Graphics.generateTexture`, verified against installed source and declarations. Rectangles are clipped at integer world coordinates to avoid chunk seams. Teardown is idempotent and unregisters the shutdown listener. Intermediate RGBA storage is at most four bytes per map pixel before driver overhead; empty chunks allocate nothing. No extra map-sized transparent layers survive into regular rendering.

Layer intent: existing baked ground/props at 0, new surface details/contact shadows at 0.2, existing objective and ground effects, actors at their established depth (10+), then ability effects and atmosphere. Raised faces stay inside arena collision footprints. Shadows extend at most eight pixels beyond walls. Do not add a foreground layer that hides players without an occlusion policy.

## Palette and pixel language

Use one logical pixel per world unit, integer placement and nearest sampling. Cluster colors instead of independent noise. Light comes from upper left: narrow light edges on tops, dark front/right faces and short stepped translucent shadows. Reserve saturated colors for team and ability cues.

| Family | Stone | Highlight | Contact shadow | Moss | Leaf/dust |
| --- | --- | --- | --- | --- | --- |
| Stone | `#81897A` | `#C0BC99` | `#17272B` | `#63805A` | `#989269` |
| Forest | `#758270` | `#B8BC8A` | `#10251E` | `#568257` | `#B49958` |
| Ruins | `#7E7B78` | `#BCB1A1` | `#22232A` | `#6C775B` | `#9F8561` |
| Crossroads | `#828876` | `#C6BD93` | `#1B292B` | `#69805C` | `#AF945F` |

## Aseprite delivery contract

Aseprite is an authoring tool, not a runtime dependency. Keep layered sources in `assets-src/environment/<biome>/` and approved exports in `packages/client/public/assets/environment/<biome>/`. These are future export conventions; the procedural controller does not import an atlas.

- Terrain: 32 × 32 frames, four to eight variations per material, explicit edge/corner transitions.
- Flat details: 16 × 16 or 32 × 32, centered origin and transparent background without matte borders.
- Props: multiples of 32, usually 32 × 64 or 64 × 96. Deliver explicit feet/pivot and collision footprint metadata separately; visual bounds never imply collision.
- Animation tags: `<biome>/<asset>/<action>/<direction>`. Use `idle`, `sway`, `ignite` and `extinguish` where needed. Sway: four to six frames at 120–180 ms with instance phase offsets.
- Export RGBA PNG plus JSON hash metadata preserving tags/durations. No rotation or trimming; two transparent pixels between frames. Maximum atlas 1024 × 1024; group by biome and use stable frame names. A future loader can use Phaser's Aseprite metadata support.
- Optional normal atlases must use identical packing and neutral flat normals `(128,128,255)`. No normal-map assets ship in this layer.

Inspect at 1× and gameplay zoom: no blur/alpha fringe, stable animation pivot, readable feet and no decorative silhouette resembling an objective or projectile. Test over light and dark grounds.

## Specific asset backlog

1. Courtyard: eight 32 × 32 worn-stone variations with edge/corner transitions using the stone palette.
2. Forest: six 16 × 16 leaf-litter clusters and four 32 × 32 moss patches; flat silhouettes and muted flowers.
3. Ruins: four 32 × 32 masonry caps and four 32 × 16 front faces, matching footprints and seams.
4. Settlement: two 64 × 96 timber/plaster houses per faction, one 32 × 64 lamp and one 32 × 64 banner with four sway frames. Match existing prop dimensions and pivots before replacing village drawings.
5. Water: four 32 × 32 ripple variants with four frames each, plus shore transitions. Place using shared tile-kind data.

These specifications support hand pixel art or image-generation references followed by artist cleanup and exact atlas packing. Listing them does not mean assets have been created, imported, licensed or visually approved.

## Tiled evaluation and authoring

Retain shared TypeScript maps and zone definitions for this rendering update. They already express authoritative wall rectangles, tile kinds, roads, props, portals and bounds. Converting to Tiled now would duplicate authority without improving the current renderer. No Tiled dependency, importer or JSON support is added.

For a future content pipeline, use visual layers `ground`, `ground_variations`, `details`, `contact_shadows`, `lower_props`, `upper_props` and `foreground`. Use separate explicit object layers for `collision`, `portals` and `spawns`, with `solid`, `footprint`, `pivot` and `occlusion` properties. Validate the importer against shared gameplay definitions; never infer collision from visual opacity. Require geometry round-trip tests before converting an existing map.

For today's maps: author geometry in shared definitions, paint it in the map/zone renderer, then add flat deterministic accents here. Preserve objective lanes. Run existing map/world/collision/browser checks; inspect all biomes at multiple zoom levels. Exercise repeated arena/world transitions and ensure `environment-*` textures return to baseline after teardown. Measure actual target devices before claiming frame-rate or memory improvements.
