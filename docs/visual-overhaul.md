# Bandera Duel visual overhaul

## Audit and architecture

The installed engine is Phaser **3.90.0**. npm workspaces use TypeScript and Vite;
Vitest covers simulation and Playwright covers browser and multiplayer behavior.
AUTO selects WebGL with a Canvas fallback. Pixel art and nearest filtering are
enabled; antialiasing is disabled. The responsive camera already has rounded
pixels and exponential follow smoothing, which this implementation preserves.

One Arena scene serves practice, network matches and RPG zones. Original 16px
matrices produce 2x sprites and directional animation atlases. Settlements and
terrain are procedural Graphics. Zones already bake their terrain into chunked
textures, while arenas previously replayed static Graphics every frame. UI uses
DOM/CSS and is independent of the renderer. Existing shadows, hit flashes, weapon
poses, attack shapes and names provide important gameplay information.

Colyseus sends filtered snapshots and numbered events. Client prediction and
practice share the server rules. All new systems consume presentation data only;
there are no changes to shared rules, movement, collision or network messages.

Three priorities: richer grounded terrain, restrained warm/cool lighting and
bounded native particles. Lighting and VFX have separate managers and map
decoration has an explicit lifecycle. Existing combat layers remain readable.

## Plan and ownership

- Audit complete; Phaser APIs checked against installed source/types.
- Environment agent owns environment.ts and environment-art.md.
- Rendering agent owns lighting.ts and lighting.md.
- VFX agent owns visual-effects.ts and vfx.md.
- Orchestrator completed scene/platform integration and validation.
- Independent QA reviewed cleanup, budgets, depth and gameplay separation; added
  five browser regressions. Its particle downgrade finding was fixed and tested.

The agents use disjoint files in the shared checkout; the requested destination
is dev. No dependencies are added. Environment, lighting and particle modules can
be developed independently after agreeing on quality and cleanup interfaces.

## Integration

Map replacement destroys environment textures and resets lights. Returning from
a world zone to the same arena ID also replaces the old decoration. Scene shutdown
destroys all managers. Arena static art now uses the same baking approach as
world zones. Settings expose low/medium/high and independent cosmetic intensity;
attack geometry, health bars and other critical feedback remain present.

Actors sort by their feet in two-pixel rows. Depth changes are queued only when
the row or weapon ordering changes. Shadows remain on the ground and health bars
stay above bodies. Existing solid tree/roof footprints are retained; this does
not add tall overlapping canopies or dynamic roof occlusion. Existing pixel
silhouettes, team marks and names provide outlines/readability without a new
full-sprite shader. There is no permanent pixelation, blur or fullscreen bloom.

The current map system already separates authoritative collision definitions
from client art. A Tiled migration would duplicate these definitions without an
immediate benefit. See [Tiled JSON](https://docs.mapeditor.org/en/stable/reference/json-map-format/)
for a future visual-only adapter. The [Rex repository](https://github.com/rexrainbow/phaser3-rex-notes)
currently describes Phaser 4; no unverified current plugin package is installed
into this Phaser 3 project. Native effects meet the selected needs.

Art conventions, extension guidance and optional asset specifications are in
environment-art.md, lighting.md and vfx.md. These distinguish shipped procedural
art from optional future artist-authored assets.

## Validation

Production build passed using Node 24.19.0 (the project's required major).
All 648 simulation tests passed. Selected browser regressions cover practice
combat/reset, maps, two-player captures/rematch, four-player rooms, facing,
touch controls/rotation, all appearance atlases, settings persistence, WebGL and
forced Canvas rendering, particle/light bounds and repeated arena/world teardown.
The touch rotation test now exits fullscreen before asking Chromium to resize.
Vite hot reload during an early run invalidated module instances; final runs use
stable source, and new tests resolve the actual entry URL including its query.

scripts/visual-profile.mjs records real frame intervals (not Phaser's smoothed
delta) and screenshots from port 5175. Supply a label and alternate URL to profile
a baseline. Artifacts are in artifacts/visual-overhaul, intentionally gitignored.
These short idle-practice headless samples are not a combat stress test or a
guarantee of 60 FPS on target hardware. Texture/display-object counts and shutdown
listeners return to a stable baseline across repeated map/zone transitions;
this checks resource lifetime, not process/GPU memory via a heap profiler.

### Measured sample

1366×900 Chromium headless, idle courtyard practice, three seconds per preset.
Final renderer: ANGLE Vulkan **SwiftShader (software)**. Baseline is commit
95984b8 in an isolated temporary copy, using the same browser/viewport/script.
The baseline had only low/normal; medium and high both sample its normal setting.

| Preset | Baseline median / p95 ms | Final median / p95 ms |
| --- | --- | --- |
| Low | 28.0 / 30.1 | 26.5 / 28.5 |
| Medium | 28.2 / 32.1 | 26.7 / 28.2 |
| High | 28.4 / 31.2 | 27.4 / 29.8 |

These samples suggest comparable idle cost, not a statistically established
speedup. The 60 FPS target is **not demonstrated** on this software renderer.
An intermediate version retained transparent decoration layers and measured
36.6–41.5 ms median; flattening removed four draw objects and four retained
textures (43→39 objects, 168→164 cached textures in the final courtyard sample).
Final screenshots and raw readings are under `artifacts/visual-overhaul/flattened/`;
the comparison capture is under `before/`. All four arena maps were inspected at
actual gameplay scale. No page errors occurred during either profiling run.

Remaining art limits are explicit: existing procedural roofs/trees remain baked,
normal maps and artist-authored atlases are optional backlog, and there is no
custom GLSL or Rex dependency. Dedicated GPU, long combat and low-end device
performance still require target-hardware profiling before a 60 FPS guarantee.
