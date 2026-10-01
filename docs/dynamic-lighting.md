# Dynamic lighting and living maps

## Audit and integration plan

Starting point: dev commit 9dbb999, Phaser 3.90.0, AUTO WebGL/Canvas,
nearest filtering, original procedural pixel art. The prior lighting used weak
alpha halos at six arbitrary positions and tiny flashes for generic hits. It
did not illuminate surfaces from actual flames/projectiles. Arena flames were
static rectangles; world campfires/forges used two synchronized circle tweens.
Grass, bushes and forest canopy art were baked and motionless. Environment
details are already flattened into chunked ground textures; retain that benefit.

Baseline: artifacts/visual-overhaul/dynamic-before, all four playable arenas,
1366×900 Chromium headless. The baseline uses SwiftShader software WebGL;
median frame times low/medium/high were 29.3/27.5/26.3ms (three seconds each).

Shared contracts and file ownership:

- Rendering: lighting.ts + lighting-pipeline.ts, actual light registry and
  terrain diffuse shader, Canvas fallback and selected projected shadows.
- Environment: wind.ts, spatially varied wind and anchored vegetation crowns.
- VFX: torch-effects.ts + ability-lighting.ts, pooled pixel fire, sparks,
  confirmed luminous events and snapshot-bound moving ability lights.
- Orchestrator: scene/village integration, source discovery, validation.
- QA: independent review and browser regressions after integration.

Managers consume client presentation only. Sources use stable IDs, explicit
positions/radii/colors and cleanup. Every existing arena torch and world
campfire/forge is registered; ash ruin coals and ember tiles use smaller flames.
World definitions are retained even when sources are outside the visible budget.
Old settlement flame tweens are removed to avoid duplicate competing fire.

Surface lighting attaches after ground decoration has been baked. It lights
the existing floor, walls and buildings without inventing collision geometry or
requiring new normal-map assets. Character colors and gameplay telegraphs remain
on their existing layers. Projected shadows are selective approximations, not
full physical visibility/shadow maps. Native contact shadows remain in place.

No new dependencies, renderer, network messages or authoritative rule changes.

## Rendering decision

Light2D would require new meaningful normal maps for the baked map composites.
The integrated SinglePipeline instead samples the original terrain and a small
camera-local lightmap. Only illumination uses linear filtering; terrain pixels
remain sharp. A first version calculated every light per terrain pixel and cost
roughly 177ms/frame in software WebGL. It was replaced with a 320x192 lightmap
updated at 30Hz (15Hz on Low), reducing the shader to two texture reads.

Six nearest torches retain slots on every quality, followed by impact flashes,
ability sources, then additional torches. Visible budgets are 12/20/32 lights.
Canvas retains animated fire, additive local glows, wind and projected shadows.

## Visual and performance validation

`node scripts/dynamic-visual-check.mjs` drives a real mage in practice, captures
torch flicker, charge and a moving fireball, then forest wind. Outputs are in
`artifacts/dynamic-lighting/`; `validation.json` records source diagnostics,
resource counts, timings and browser errors. The fireball screenshot visibly
shows temporary warm illumination on the stone path beneath the projectile.
Torch highlights are visible on neighboring wall tops and ground; all actor
labels, flags and combat indicators remain readable.

With six torch sources plus 16 simultaneous additional sources, the three-second
stress samples on Chromium software WebGL measured:

| Quality | Median frame | 95th percentile |
| --- | ---: | ---: |
| Low | 16.6ms | 17.6ms |
| Medium | 16.6ms | 17.6ms |
| High | 16.6ms | 18.4ms |

The original `visual-profile.mjs` was also rerun unchanged against all four
arenas (`artifacts/visual-overhaul/dynamic-after`). Its Low/Medium/High medians
were 16.6/16.6/16.6ms, versus 29.3/27.5/26.3ms before; 95th percentiles were
18.2/17.6/17.5ms. Both runs reported SwiftShader. Reviewed courtyard, forest,
ruins and crossroads screenshots retain readable routes and crisp terrain.

These are approximately 60 FPS in this environment, not a guarantee for every
device. Quality budgets cull submitted sources; not every stress source is
rendered on Low or Medium. Browser errors were empty. Static practice has
131 display objects and 175 textures for the mage (174 for the default guardian),
including bounded flame/light pools.

Automated regression results are recorded in `dynamic-qa.md`.
