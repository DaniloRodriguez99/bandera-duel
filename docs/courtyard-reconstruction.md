# Courtyard reconstruction specification

This task targets **courtyard**, not the previous forest redesign. The primary reference has six masonry obstacles matching `MAPS.courtyard`: four vertical blocks and two horizontal blocks. The target is a reconstruction of that composition, with existing collision, routes, homes, spawns and multiplayer behavior preserved.

Reference observations below come from the lead's inspection of the supplied target: approximately 1680 × 940; top-down gameplay with three-quarter architectural faces; broad cool-blue/slate caps and thick dark front faces; deep teal organic grass; bright low ferns around masonry feet; dense dark border growth; a clear central stone lane; golden braziers and boundary lamps; perimeter crates/barrels; blue/red banners near the left/right sides around y=190 in map coordinates. This specification is not evidence of exact visual matching. Acceptance requires comparison with the actual running game.

## Baseline and largest differences to fix

The existing courtyard still uses `scene.ts`'s procedural ground: 20-unit tonal blocks, a small rectangular paving repeat, brick-pattern obstacle tops, thin front bands, simple wooden torch supports and geometric team-floor markers. `environment.ts` adds surface wear, and current lighting/fire/wind already provide functioning dynamic behavior. Their presence does not reproduce the reference's authored architecture or composition.

The first visual priority is the **mass and shape of the six obstacles**: broad irregular slab caps, discernible thickness, dark front faces and low growth around the feet. Do not reuse forest's narrow repeated masonry treatment as the completed courtyard architecture. The second priority is material distribution: organic grass/earth islands and low fern clusters, with dense border foliage and a quiet route through the middle. Fire and lighting tuning follows these changes.

## Immutable geometry and composition anchors

Map space remains 960 × 540, with the existing 20-unit perimeter. These are implementation coordinates taken from shared geometry, not measurements claimed from the screenshot.

| Feature | Coordinates / footprint | Reconstruction instruction |
| --- | --- | --- |
| Upper-left vertical block | x245, y116, w52, h96 | Large slab top, dark lower face, fern cluster at feet. |
| Lower-left vertical block | x245, y328, w52, h96 | Same architectural family; vary chips and moss without changing silhouette scale. |
| Upper-right vertical block | x663, y116, w52, h96 | Mirror competitive placement; retain a consistent light direction rather than flipping painted highlights. |
| Lower-right vertical block | x663, y328, w52, h96 | Matching material and visual mass. |
| Upper-center horizontal block | x423, y164, w114, h42 | Broad connected slate cap; front face reads as one short raised obstacle. |
| Lower-center horizontal block | x423, y334, w114, h42 | Same scale and top/front proportions as its upper counterpart. |
| Main stone route | x20..940, y234..306 | Retain width and clear horizontal traversal; add authored stones, cracks, moss and irregular surface wear. |
| Side paving strips | x130 and x800, y50..490, width28 | Retain existing route positions; blend borders into grass instead of adding hard decorative barriers. |
| Two-team homes | (145,270), (815,270) | Detailed base floors and team accents around the existing markers. |
| Four-team homes | (145,120), (815,120), (145,420), (815,420) | Keep objective drawing snapshot-driven; fixed two-team decorations must not imply active bases in other modes. |
| Six established flames | (225,96), (735,96), (225,440), (735,440), (400,150), (560,390) | Replace supports with stone/golden braziers; keep flames separately animated and light positions anchored to them. |
| Boundary vegetation | Around the existing perimeter | Dense, dark, locally layered silhouettes; avoid covering player feet in reachable space. |
| Team banners | Left/right side around y190 | Final x/pivot from reference comparison. Place as decorative wall/border accents, separate from capture flags and their state. |

Courtyard has **no gameplay bush regions**. Decorative low ferns and ground growth must not acquire bush IDs, concealment, new collision or the visual vocabulary of forest's four large concealment beds.

## Asset inventory and export contract

Generate original reusable art, not a single screenshot painted underneath the game. The lead is preparing new architecture and vegetation atlases. Frame names and measured crop rectangles must be explicit; generated sheet cells must be inspected for spillover rather than assumed to be equally sized. Preserve transparency and reject baked checkerboards, labels, crop guides and neighboring-frame fragments.

| Asset family | Minimum reusable inventory | Working native output / placement requirements |
| --- | --- | --- |
| Teal grass | 6–8 variants, dark border variant | 32 × 32 or 64 × 64 tiles with consistent density and seamless edges; irregular clustered application. |
| Earth and transitions | 4 earth variants, grass/earth edges, inner/outer corners | Match ground module; no independent scatter that overrides the hand-placed clearings. |
| Central paving | 6 stone variants plus chipped edges and moss seams | Broad slate pieces sized coherently relative to character feet; preserve y234..306 route. |
| Vertical architectural block | 2 cap variants, front face, sides, end/chip overlays | Compose to 52 × 96 collision footprint; any elevation extends visually upward, never changes collision. |
| Horizontal architectural block | 2 cap variants, front strip, ends | Compose to 114 × 42 footprint; match the vertical family's slab thickness and perspective. |
| Boundary masonry | Straight cap/front, corners and damaged segments | Fit existing 20-unit perimeter; texture detail must not suggest traversable gaps. |
| Low ferns | 4–6 variants in small/medium sizes | 16 × 16 to 32 × 32 final clusters, grounded pivot; authored fixed anchor arrays around obstacle feet. |
| Border foliage | 4 dark clumps, 3 hanging/creeping variants | 32 × 32 or 32 × 48 final art; richer silhouettes than interior groundcover, limited overlap into playable space. |
| Flowers/leaves/stones | 3–4 flat accents per family | 8 × 8 or 16 × 16 pieces; occasional intentional accents, not uniform high-frequency noise. |
| Brazier | Stone pedestal and warm metal bowl, 2 variants | Approximately 16 × 32 or 24 × 40 after density review; explicit flame pivot and shadow foot. No flame baked into support. |
| Boundary torch | 1–2 supports | Approximately 12 × 24; final flame anchors recorded in the composition data. |
| Crate and barrel | 2 variants each | 16 × 20 to 24 × 28; share density and perspective with walls. Non-collidable visual placement along existing blocked/peripheral surfaces. |
| Team banner | Blue and red; compatible accent treatment for other modes | Approximately 16 × 32 or 24 × 40, pole/wall anchor distinct from flag pickup position. |

Final density is assessed at gameplay scale next to current character sprites. Scale asset families consistently; do not stretch a large isolated generated prop differently in each location. Retain editable sources and atlas metadata, nearest sampling for artwork, safe transparent padding and no rotated/trimmed animation pivots. Low-frequency illumination may remain linearly filtered; the artwork must retain sharp pixel edges.

## Manual placement rules

Maintain a small explicit placement table per family, mirrored where competitive readability requires it. Use the six shared wall footprints as architectural anchors, then authored offsets from their top/front/feet for cap decorations and ferns. Reserve the central lane and base rings before placing any growth. Any decorative bounding box intersecting a reserved lane should be shortened, moved or made a flat decal.

Use the reference to place identifiable groups of crates, barrels, flowers and banner supports along the perimeter; their final coordinates are to be transcribed during image comparison, not invented as exact matches here. Additional boundary flames follow the same rule. Keep a map of authored anchors in code or data so later screenshot corrections do not depend on random seeds. Deterministic variation is appropriate only within a specified material patch or cluster.

Paint broad grass/earth patches first, paving second, contact shadows and low plants third, then architecture and attached accents. Wall top surfaces should have fewer, larger slate shapes than the old brick grid. Put dark front faces inside the lower portion of the footprint and allow a small upward visual extension for height. Keep cast/contact shadows independent from the dynamic torch shadow layer to avoid double-dark edges.

## Reuse and integration audit

| Existing system | Reuse | Avoid duplicating |
| --- | --- | --- |
| `ForestEnvironment` composition approach | Temporary canvas/atlas composition into a small set of receiving RenderTextures; explicit ownership and idempotent destroy | Do not import its four-bush layout, tall repeated foliage treatment or forest frame names as the courtyard specification. |
| `scene.ts` environment lifecycle | Destroy prior environment on map/world changes; attach every new ground/architecture surface after resetting lighting | A second persistent map display list or unowned baked textures. |
| `LightingManager` / `TerrainLightingPipeline` | Existing bounded source registry and low-resolution world-space lightmap; warm torches over cool terrain; Canvas fallback | New shader stack, global blur, second source registry or duplicate floor glow. |
| `TorchEffects` | Shape-changing flames, independently phased flicker, light radius/position modulation and bounded sparks | Fire painted into supports or a separate emitter per pedestal. |
| `WindManager` | Shared spatial wind, anchored roots, visible-actor reaction and reduced-motion behavior | Independent per-plant tweens or hidden-opponent foliage cues. |
| Existing actor/foreground depth | Feet-based actor ordering; existing wall fade policy for occluded visible actors | New isometric camera or foreground sprites that permanently hide combatants. |
| `drawBases`, flag and actor feedback | Snapshot-owned home/spawn positions and objective/team state | Baking a capture flag or active team indicator into terrain, or tinting readable team labels with the environment shader. |
| `ParticlePool` | Existing bounded environmental/combat particle allocation | Extra unbounded atmosphere or excessive particles used to compensate for incomplete art. |

A dedicated courtyard renderer should consume `MAPS.courtyard`, expose its receiving surfaces and own its destroy/update operations. Keep the existing forest implementation intact. No collision definitions, protocol fields, authoritative simulation or shared map dimensions should change. A 7-surface model—one ground plus six raised obstacles—is a useful target, but object count alone is not the fidelity criterion.

Technology evaluation: retain current atlas and RenderTexture composition rather than migrating geometry to Tiled for this task. Tiled-compatible decorative placement data can be added later without becoming a second collision authority. Existing custom WebGL lighting and native Phaser particles cover the required runtime effects; introducing Rex or a second rendering engine is unnecessary. Selective luminous halos may use existing local light/glow support, with no full-scene bloom pass that softens the artwork.

## Validation and completion evidence

Capture the actual courtyard canvas at the reference's approximately 1680 × 940 viewing proportions and equivalent arena framing. Do not compare a tiny gameplay crop to a scaled concept image. Record visible differences in this order: six-obstacle mass/cap/front-face proportions; lane and ground patch layout; vegetation grouping/density; boundary/decor composition; team bases; torch placement/illumination; shadows and depth.

After each major pass, correct the largest difference rather than spending time on minor sparks while architecture is still wrong. Inspect pixel density and crops at 1×. Verify central traversal, collision edges, four-team/deathmatch rendering, foreground transparency, perspective-hidden actors, reduced motion, intensity zero and Canvas fallback. Exercise courtyard↔forest↔world transitions and scene shutdown for stable textures, receiving surfaces, listeners, light sources and emitters. Confirm two-client gameplay continues to work with remote effects.

Record measured frame times and object/texture counts with test conditions after the final artwork is integrated; earlier forest performance does not prove courtyard performance. Keep before/after and reference-comparison screenshots. Compilation and successful automated tests alone do not establish reconstruction fidelity. Any remaining meaningful visual differences must be reported; do not describe the output as exact merely because the six shared footprints match.
