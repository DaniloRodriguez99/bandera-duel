# Courtyard reference reconstruction

`courtyard-environment.ts` composes the existing six-wall courtyard from original authored artwork. The composition follows the reference's dark jade clearings, substantial cool stone architecture, restrained warm earth around fires, dense border foliage, scattered wildflowers, squat carved braziers and blue/red cloth posts. It is separate from the forest renderer; forest cover beds are not introduced into the courtyard.

The authoritative 960×540 layout remains unchanged: four 52×96 vertical obstacles, two 114×42 horizontal obstacles, the 20px boundary, the horizontal lane at y=234–306, existing spawns and base positions. Decorative plants and fixtures are not added to collision or concealment logic. The central circle and diamond use faint stone material, with no luminous targeting treatment. Broad ground variation is faint and deliberately placed; props and vegetation use a curated placement list rather than grid scattering.

## Integration contract

Preload `assets/environment/courtyard-art.png` as `courtyard-art-atlas` and `forest-terrain.png` as `forest-terrain-atlas`. Call `ensureCourtyardFrames(scene)` and construct `new CourtyardEnvironment(scene, MAPS.courtyard)`. Missing atlases make the frame helper return false; the constructor requires valid assets.

`surfaces` contains seven RenderTextures: one ground composition at depth 0 and six separately sorted authored wall objects. Attach all seven to the existing lighting manager after its environment reset. Do not paint the old procedural courtyard over these surfaces. Wall depth matches the scene: `10 + floor(wallBottom / 2) / 100000`. Each wall projects 18px north without changing its physical footprint. Call `update(time, delta, visibleActors)` with only locally visible actors; the wall fades to 45% when an actor stands behind its projected silhouette.

`windPoints` exposes roots of the actual low-bush/fern placements and wall-foot plants. Pass these points to the existing wind manager, rather than adding random plants to unrelated open ground. `COURTYARD_FIRES` exposes the six existing flame anchors and four reference-inspired edge lights, with their scales. The composer draws unlit stone pedestals; the existing effects manager owns flames, sparks and light registration. Team cloth posts sit near the side boundaries, centered around x=28/932,y=215; gameplay objective rendering remains the scene's responsibility.

`destroy()` is idempotent and releases every receiving surface and its shutdown subscription. Scene shutdown also calls it. No authoritative state, actor visuals, input, networking or lighting code is modified by the compositor.

## Original artwork and sampling

The supplied transparent original atlas is 1254×1254 and is not a rigid grid. `ART_REGIONS` records sixteen inspected crop regions: two full perspective wall variants, horizontal/vertical boundary modules, four foliage assets, brazier, crate, barrel, boulder, two flower variants and two banners. Regions scale proportionally with source dimensions and are alpha-trimmed before creating numeric frames. Preexisting frames are respected so the loader can provide revised crops.

Wall sprites are fitted to their authoritative footprint plus the visual north projection. Their authored top and front are sampled separately: the cap occupies the height above a 14px front, with a trimmed broad vertical cap and two rows of horizontal cap stones, reproducing the reference perspective without altering collision. Boundary modules similarly prioritize large cap stones above a shallow 3-4px front. Their thick stone fronts, cap surfaces, cracks, moss and contact detail are part of the authored image; they are not assembled from flat colored rectangles. Crates sit near x=88/865,y=110 and barrels near x=75/895,y=340, clear of the side paths and spawn points; they remain non-collidable decorative props. Additional ivy and individually proportioned 18-25px clumps connect architecture to the ground. Quiet olive-jade clearings contain hand-placed small plants and wildflowers; deliberate gaps in border canopies expose the boundary caps.

Terrain materials use one-time high-quality downsampling to 80px repeating tiles, yielding roughly 24px paving blocks. Props likewise receive a single high-quality reduction to their actual display dimensions. The final baked scene uses nearest sampling. This avoids the source-art aliasing found when reducing the earlier high-resolution atlas directly with nearest filtering, while leaving actors and final pixel edges sharp. No full-scene blur is introduced.

## Validation status

The original atlas and integrated game were visually inspected in four passes at 1680x945. Wall cap proportions, front seams, border density, clearing plants and warm-light energy were corrected against the supplied reference. See courtyard-validation.md for capture paths, measured performance, gameplay checks and remaining visual differences. Forest keeps its own compositor; shared torch glow and lightmap encoding improvements apply to all maps.
