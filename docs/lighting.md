# Dynamic terrain lighting

`LightingManager` owns a bounded registry of actual map and combat sources. It does not invent light positions, alter actors, or send network data. Callers register torches, the shrine and confirmed existing abilities.

## Integration contract

1. Construct `new LightingManager(scene)`.
2. On map changes call `setEnvironment({width, height, theme, arena, walls})`, where optional walls are readonly `{x,y,w,h}` footprints. This clears all registered sources and releases old receiving surfaces.
3. After baking the environment, call `attachSurface(renderTexture)` for every terrain/object RenderTexture. Surfaces must use normal world scrolling (scroll factor 1). No actor, objective, label or UI surface is attached.
4. Register or update a source with `setLight(id, {x,y,color,radius,intensity,falloff?})`. Coordinates are world pixels, color is packed RGB, radius is clamped 1–600, intensity 0–3, falloff 0.5–4 (default 1.6). Reusing the ID changes the existing record. Use `torch:` IDs for permanent lamps; other IDs are prioritized as dynamic lights. Remove expired sources with `removeLight(id)`.
5. Call `update(time, delta)` each frame after source updates. `flash(x,y,color)` creates a pooled 240ms impact light for confirmed hits. Reduced motion suppresses these brief flashes; callers should suppress their own source flicker.
6. Call `destroy()` on teardown. Shutdown also performs idempotent cleanup, removing the pipeline and its private lightmap texture. The game-wide fallback texture is retained for reuse.

The source registry is capped at 96. New registrations beyond that bound are ignored; existing IDs remain updateable. Removal and environment reset free capacity. The receiving-surface set automatically removes destroyed surfaces.

| Quality | Visible lights including flashes | Flash slots | Projected wall shadows |
| --- | ---: | ---: | ---: |
| Low | 12 | 2 | 6 |
| Medium | 20 | 4 | 10 |
| High | 32 | 6 | 16 |

The six nearest visible map lamps get reserved slots on every quality. Remaining slots prioritize hit flashes and dynamic skills, then additional map lamps. Offscreen sources are culled by radius. These are explicit bounds, not a measured hardware FPS guarantee. Shadow strips are rebuilt at most every 80ms; ordinary source updates reuse registry records. Lightmap gradients and shadow strips are created only on their bounded update cadence.

## Receiving surfaces and crisp art

`TerrainLightingPipeline` extends the installed Phaser 3.90 `SinglePipeline`. It samples the baked texture and a camera-local lightmap, then multiplies source RGB by ambient plus colored point-light attenuation. The 320×192 CanvasTexture lightmap accumulates gradients at up to 30Hz (15Hz on Low), with 64 world pixels of padding around the camera. It encodes illumination at quarter range and the shader decodes it before clamping; moving light positions remain world-anchored between uploads. Light count does not increase fragment shader work. Day ambient is approximately 0.8 and ruins ambient 0.62–0.68. Illumination is capped at 3.5 to preserve warm high-energy lamps instead of clipping their red channel prematurely. Courtyard uses cool ambient (0.76, 0.8, 0.9) and a 2.2 nominal torch gain; other source defaults remain unchanged. Source radius and falloff control the light's reach. Intensity zero returns original texture RGB exactly and hides fallback glows/shadows.

Vertex positions arrive in camera screen coordinates. The pipeline derives the inverse affine camera transform from `Camera.getWorldPoint` and interpolates world position to the fragment shader. Light coordinates therefore never depend on DynamicTexture/RenderTexture UV Y orientation. Texture UVs pass through unchanged. This also follows camera scroll, zoom, rotation and shake. The shader uses no scene blur, full-screen pass, bloom framebuffer, chromatic aberration or actor tint. Only the low-frequency lightmap uses linear filtering; the source pixel art retains nearest filtering. Native SinglePipeline.bindTexture binds the lightmap to sampler unit 1. A previous per-fragment loop was rejected after the orchestrator measured roughly 177ms/frame under SwiftShader against a roughly 27ms baseline; the replacement measured 16.6ms median across all quality levels with 22 submitted sources (see dynamic-lighting.md for limits and 95th percentiles).

Nearby wall footprints cast bounded projected strips from their far-facing edges away from their dominant local source. Shadows draw at depth 1.3, beneath bodies, objectives and gameplay indicators; they do not change collision. These are artistic projected shadows, not full per-pixel occlusion: a large obstacle does not completely block a point light. Wall colors baked into an attached receiving surface are illuminated by the same shader as the floor.

## Compatibility and fallback

The renderer must support two fragment texture units. Canvas rendering, insufficient sampler capacity, or caught pipeline initialization failures use additive nearest-filtered 64×64 glow sprites at actual source positions instead. The fallback provides localized colored light without a full-scene dark overlay. The sprite arrays remain exposed as private runtime fields `pools` and `flashes` for existing diagnostics; WebGL hides these images because light is applied directly to receiving textures. `sources` is a Map, `visible` is the current selected list, and `surfaces` is a Set. Tests should inspect these instead of assuming old arbitrary pools are visible.

Verified Phaser APIs against installed `phaser/package.json`, `src/renderer/webgl/pipelines/SinglePipeline.js`, `MultiPipeline.js`, `WebGLPipeline.js`, camera `getWorldPoint`, and TypeScript declarations. Native Light2D affects only explicitly assigned compatible objects; it cannot recover meaningful surface normals from existing baked Graphics composites. This shader provides dynamic receiving-surface illumination while preserving the existing terrain cache. Native Images and SinglePipeline cover the requirements without a Rex dependency.

## Optional normal-map art

No new image assets or normal maps are required for this implementation. For future selectively normal-mapped props, export matching PNGs under `environment/`: `stone-wall.png` / `stone-wall-n.png` at 32×48, one frame, existing muted stone palette and transparent surround; `brazier.png` / `brazier-n.png` at 16×32, one frame, warm metal palette; and `brazier-flame.png`, four 16×16 frames in a 64×16 sheet with amber/cream and transparency, no normal map. Use tangent-space RGB, neutral 128/128/255, identical trim/padding/frame layout and matching silhouettes. Verify normal Y direction with lights above and below before integrating. Apply native Light2D only to selected compatible props with diffuse/normal pairs; retain an unlit flame and ordinary actor/UI rendering. New art must not imply new collision height.
