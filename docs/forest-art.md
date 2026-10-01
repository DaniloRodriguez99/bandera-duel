# Forest arena artwork

`forest-environment.ts` replaces the forest's flat procedural ground with a composition of original terrain and prop atlas artwork. It preserves the 960×540 arena, horizontal stone lane at y=234–306, side paths x=130/800, base centers x=145/815,y=270, all four authoritative wall footprints, and all four cover rectangles. It does not change collision, cover detection, objectives, movement or networking.

## Integration

Preload `assets/environment/forest-terrain.png` as `forest-terrain-atlas` and `forest-props.png` as `forest-props-atlas`. Call `ensureForestFrames(scene)` before constructing `new ForestEnvironment(scene, MAPS.forest)`. The function returns false when either source is missing or too small. The constructor requires valid assets and throws instead of silently substituting placeholder art.

The class exposes `surfaces`, containing one 960×540 ground RenderTexture and four separate architecture RenderTextures. Attach every surface to `LightingManager` after its environment reset so terrain and architecture receive the same dynamic illumination. The ground is depth 0. Walls use `10 + floor(wallBottom / 2) / 100000`, matching the scene's actor foot-depth convention. Skip the old forest ground and wall decorator to avoid repainting the authored surfaces.

Call `update(time, delta, actors)` with visible actor `{x,y}` positions. Wall projections extend 18 pixels north above their exact physical footprint. When an actor stands behind this visual overhang, its architecture surface fades smoothly to 45%; collision remains unchanged. Pass only actors that the local client is allowed to display. This avoids revealing hidden players through the opacity response. `destroy()` releases all five receiving textures and removes the shutdown hook; shutdown also triggers idempotent cleanup.

`FOREST_BRAZIERS` exports 14 flame anchors with scale: the existing six sources plus eight small boundary lanterns. The four cover-bed flames use scale 1.3. The compositor paints only unlit authored fixtures; existing `TorchEffects` supplies flame animation, sparks and point lights. These decorative boundary fixtures do not introduce colliders.

## Atlas crops and composition

Both generated atlases are currently 1254×1254. Terrain cells derive their exact boundaries with `round(column * width / 4)` and the corresponding row formula, so non-divisible dimensions do not bleed adjacent cells. Props use the same column calculation but explicit proportional row bounds based on inspection: the long ivy reaches y=370, groundcover begins there, the crate/rubble row begins about y=615, and pedestal/banner artwork begins y=894. These crops preserve full pedestals and avoid carrying stray ivy into the groundcover frame. If the artwork is regenerated with a different arrangement, update `frameBounds` rather than assuming a rigid grid.

Each opaque terrain cell is prefiltered once with high-quality Canvas downsampling into a 64px repeating tile. Prop crops are similarly reduced once into cached native display dimensions. The final baked map and its display retain nearest sampling: the prefilter removes source-art aliasing without blurring characters or the scene. Most open ground is a quiet dark teal field with a 24% grass texture contribution; sparse broad masks add subdued moss, soil and warm worn aprons near fixtures. The lane uses worn slate and broken paving; side paths and base aprons remain subdued. The central stone medallion is surface decoration, not an ability indicator. Four shrub beds use predominantly taller dense grass and tuft assets, with occasional fern and flower accents inside their original cover bounds. Slim worn-stone planter rims make the exact concealment boundary legible; foliage heights and placements vary inside the rim. Two subdued irregular dirt shortcuts connect the inner lamps to the clearing. Masonry caps carry a narrow cool highlight above darker front faces. Small grass patches and ivy enrich the perimeter while keeping routes clear.

Masonry surfaces use authored dark faces, stone caps, moss and hanging ivy. Wooden crates, barrels, rubble, banner pedestals and broken columns are restricted to existing wall footprints. Ground contact shading is separate from elevated wall artwork. Native wind accents can draw above ground at depth 0.4 without moving entire shrub assets.

All composition happens once per map construction. Temporary canvases/textures are released after baking; only five RenderTextures persist. Their RGBA storage is approximately 2.2MB before driver overhead, in addition to the two shared source atlases. Runtime work is four small occlusion checks and alpha transitions. No FPS claim is made until the integrated scene is measured. Source art is original generated work; no reference-game artwork is bundled.

## Validation

The module passes a targeted TypeScript compile against installed Phaser 3.90. The atlas source images were visually inspected to determine crop boundaries. Integrated screenshots, dynamic-light reception, actor occlusion and performance must be validated in the running scene after integration; source inspection alone does not establish visual correctness.
