# Forest redesign verification

The reference matches Bosque de Emboscadas: four grass beds, two vertical flank
walls, two horizontal walls, and the existing blue/red bases. This is the first
redesigned map. Other maps retain their layouts and receive the shared dynamic
fire, ability illumination and wind improvements.

## Actual rendered result

The lead inspected the supplied reference and screenshots from the running game.
`artifacts/visual-overhaul/dynamic-before/forest.png` records the earlier flat
ground, gridded circular bushes and uniform brick walls. Final captures are in
`artifacts/redesign-forest/`: `torch-a.png`, `torch-b.png`, `mage-charge.png`,
`mage-projectile.png`, `wind-a.png` and `wind-b.png`.

The redesign replaces the inherited arena drawing with original, reusable
materials and individual prop sprites: indigo masonry with worn caps and front
faces, moss, irregular grass clusters in stone beds, flowers, ivy, crates,
barrels, rubble, banners and detailed braziers. Worn ground connects lamps to the
center. The existing team markers and player art remain independent and readable.
Fourteen flames have corresponding warm lights; magical projectiles illuminate
the terrain as they travel. Four elevated walls sort with actor feet and fade
when they would obscure a visible actor. Wind crowns react to nearby visible
actors without moving roots or altering concealment rules.

Two visual iterations corrected excessive source-art aliasing and hard grass
edges. Source artwork is prefiltered once to native material/sprite dimensions;
the final world and actors use nearest sampling, without a blurred scene pass.

The result follows the reference's cool stone/jade growth and warm light
direction. It is not a pixel-identical reproduction: the existing character/UI
art and competitive geometry remain, and shadows approximate selected objects
rather than providing complete light occlusion. No production art is represented
by missing-texture placeholders. The valley guards' obsolete texture key was
also repaired after screenshot inspection.

## Performance

`node scripts/dynamic-visual-check.mjs forest` runs at 1366x900 in headless
Chromium/SwiftShader. With 14 torch sources, team lighting and 16 extra stress
sources submitted, the final three-second samples measured:

| Quality | Frames | Median frame | 95th percentile |
| --- | ---: | ---: | ---: |
| Low | 181 | 16.6ms | 17.7ms |
| Medium | 180 | 16.7ms | 17.6ms |
| High | 180 | 16.7ms | 17.6ms |

The light budget remains 12/20/32, so lower qualities deliberately select fewer
sources. This is approximately 60 FPS in the tested environment, not a hardware
guarantee. The scene has 135 display objects and 177 textures for a mage at rest;
the live shot temporarily adds two display objects. Browser errors were empty.
The forest uses five receiving RenderTextures (about 2.2MB RGBA), two shared
1254x1254 atlases (about 12.6MB decoded RGBA), and the shared small lightmap.
The source PNG download cost is about 5.6MB. There are no added dependencies.

## Checks

The production build passes with Node 24. Final browser regression results are
recorded after the frozen-source integration run in `dynamic-qa.md`.

All authoritative map, movement, combat and networking files remain unchanged.
Asset provenance, exact prompts and saved filenames are in
`forest-asset-prompts.md`; the integration contract is in `forest-art.md`.
