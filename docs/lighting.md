# Terrain lighting

`LightingManager` adds local warm/cool illumination above baked terrain at depth 1.25, below shadows, traps, flags, actors and combat indicators. A 2.8% maximum ambient tint unifies the floor without darkening actors. Ordinary alpha blending works in Canvas and WebGL. The reusable 64×64 falloff texture uses nearest filtering; no scene texture is blurred or resampled. Local lights are atmospheric pools, not new interactive objects.

Call `setEnvironment({ width, height, theme, arena })` after a map change, `update(time, delta)` once per frame, and `flash(x, y, color)` from confirmed existing combat events. Call `destroy()` during explicit teardown; shutdown also cleans up automatically. Destruction is idempotent. One game-wide texture is intentionally retained for reuse on scene restart. Lights allocate once, and flashes reuse slots without tweens, timers, per-frame allocations or network traffic.

| Quality | Ambient pools | Simultaneous impact lights |
| --- | ---: | ---: |
| Low | 2 | 2 |
| Medium | 4 | 4 |
| High | 6 | 6 |

These are conservative hard budgets, not measured 60 FPS guarantees. Offscreen ambient pools are hidden. Intensity scales every contribution; zero hides everything. Reduced motion disables pulsing and impact lights. Gameplay feedback remains the responsibility of existing combat drawing and is unchanged. Low quality also disables pool animation.

## Phaser 3.90 assessment

Verified against installed `phaser/package.json`, `src/renderer/webgl/pipelines/LightPipeline.js`, `src/gameobjects/lights/LightsManager.js`, and TypeScript declarations. `Light2D` is a WebGL pipeline that affects only objects explicitly using it. It uses normal textures and a configured maximum light count (default ten). It is not a universal scene light: existing Graphics actor composites and baked terrain do not acquire physically meaningful relief merely by enabling scene lights. A flat fallback normal cannot restore relief lost when geometry is baked.

The current implementation therefore uses sprite illumination, keeping terrain baking and actor rendering intact. Fullscreen color grading, bloom and custom postprocessing were evaluated but omitted: a camera pass would also change objective and team colors, and full-frame render targets would add bandwidth without a demonstrated need. Selective glow sprites provide the intended luminous accents without blur. No Rex dependency is required; native Phaser Images, texture reuse and bounded updates cover this use case. Any future Rex pipeline must be verified against 3.90 and approved before adding a dependency.

## Optional future normal-map assets

Normal maps are not required by this implementation. If selected walls or props are converted to sprites, use these specifications:

| Asset | Size | Frames | Color / transparency | Normal map |
| --- | --- | --- | --- | --- |
| `environment/stone-wall.png` | 32×48 px | 1 | Existing muted stone palette, transparent surround | Matching `stone-wall-n.png`, tangent-space RGB, flat areas 128/128/255 |
| `environment/brazier.png` | 16×32 px | 1 | Existing warm metal palette, transparent surround | Matching `brazier-n.png`; flame rendered separately and unlit |
| `environment/brazier-flame.png` | 64×16 px sheet | 4 frames, 16×16 | Amber/cream, transparent surround | None; emissive sprite remains unlit |

Export PNG at native resolution without premultiplying normal RGB. Match atlas frame dimensions, trim, padding and frame names exactly between diffuse and normal sheets. Use transparent normal surrounds matching the diffuse silhouette. Verify the normal Y orientation using a light above and below the prop before integration. Load diffuse and normal textures together and apply `Light2D` only to the selected compatible sprites; retain ordinary rendering for characters, labels, objectives, particles and the Canvas fallback. Never infer elevation or collision from the new artwork. Start with a small bounded light budget and profile actual devices before enabling this optional path.
