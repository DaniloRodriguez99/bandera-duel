# Environment redesign preparation

Implementation is now integrated for `MAPS.forest`. The initial audit and asset
plan below are retained for context; final artwork, visual comparisons and
measurements are documented in `forest-art.md` and `forest-validation.md`.
The two original atlases are saved under `packages/client/src/assets/environment/`.

Status: implementation preparation and asset inventory. The reference image has now arrived. The lead's reference review identifies the **forest** map as the matching target: four bush beds, two vertical flank walls and two horizontal upper/lower walls. Confirmed direction: dense irregular jade grass and shrubs, indigo slate masonry, warm golden braziers, worn organic earth patches, a central stone path, vines and flowers, with crates and barrels at the edges. This document records the lead's reference findings alongside the source audit; it does not claim that asset creation or the redesign is complete.

The implementation target is `MAPS.forest`. Its four collision rectangles are `(270,205,44,130)`, `(646,205,44,130)`, `(410,95,140,38)` and `(410,407,140,38)`. Concealment beds are `(160,80,170,70)`, `(630,80,170,70)`, `(160,390,170,70)` and `(630,390,170,70)`, retaining IDs f1–f4. These match the reference composition without changing shared geometry. The lead is generating an original reusable atlas; the rendering owner will implement `forest-environment.ts`. The courtyard audit below describes the shared painter that forest currently inherits and provides a baseline, not the first redesign target.

## Current courtyard audit

Source of gameplay geometry: `packages/shared/src/maps.ts`. Current renderer: `packages/client/src/scene.ts`, especially `drawMap`, `wall`, `drawBases` and `setEnvironment`. Static surface accents: `environment.ts`; animated foliage: `wind.ts`; fire: `torch-effects.ts`; surface illumination: `lighting.ts` and `lighting-pipeline.ts`.

| Component | Current implementation | Limitation relevant to redesign |
| --- | --- | --- |
| Ground | A 960 × 540 dark ground, with a 20-world-unit grid filled by three palette tones selected from a smooth field; occasional small grass marks | The large-scale surface is still a grid of flat blocks. There is no authored reusable ground-material atlas or deliberate tile transition vocabulary in this rendering path. |
| Roads | A horizontal band starting at y=234, using 26 × 16 paving rectangles on a 28 × 18 spacing; two vertical strips at x=130 and x=800 | All four arena themes share this arrangement. Stone units have limited material variation and do not yet express a reference-specific construction style. |
| Centerpiece | Two circular lines at (480,270), radii 62 and 54, with a central diamond | Its architectural identity is limited to geometric lines. Any replacement must remain a flat surface so the open central route stays readable. |
| Walls | Shared rectangle painter with a 26 × 14 brick rhythm, top highlight, 6-unit lower face and fixed offset shadow | It reuses the same masonry pattern for all arena themes. Height is suggested by bands rather than a complete kit of caps, corners, ends and front faces. |
| Additional weathering | Coordinate-hashed moss, cracks and shaded front edges baked into the terrain | These accents improve local detail but cannot replace the underlying material shapes or a full architectural kit. |
| Bushes | Rounded green rectangles with repeated circular leaf clusters; wind adds moving crowns | Courtyard has **no gameplay bushes**. Forest, ruins and crossroads use the same painter with different rectangular footprints. Adding concealment-like bushes to courtyard would misrepresent gameplay. |
| Bases | Team-colored translucent region, concentric rings and spawn disk, plus team label; positions come from the active snapshot | These are readable functional markers, not authored architectural assets. The rendering must handle two-team and four-team layouts as well as objectives without capture bases. |
| Torch supports and fire | Six simple baked wooden supports; eight procedural 16 × 20 flame frames plus bounded sparks and registered lights | Fire animates and illuminates surfaces, but the supports have little material or structural detail. The redesign should replace art without duplicating emitters or light ownership. |
| Composition across maps | Theme palette changes, shared ground/road/torch composition, per-map walls and bushes | Each map lacks a fully distinct authored material composition. Forest is the first target for a dedicated authored composition. |

The courtyard's six collision rectangles are `(245,116,52,96)`, `(245,328,52,96)`, `(663,116,52,96)`, `(663,328,52,96)`, `(423,164,114,42)` and `(423,334,114,42)`. The renderer adds the 20-unit arena border. Two-team homes are (145,270) and (815,270); four-team homes are (145,120), (815,120), (145,420) and (815,420). These positions constrain the art; a new 32-pixel tile grid must not snap or resize gameplay rectangles to fit its cells.

## Reusable asset delivery contract

These are technical preparation specifications. Keep one source pixel per world unit for environment exports, use integer placement and nearest-neighbor sampling, and inspect the result beside the existing actor atlas before accepting the final density. Avoid arbitrary resizing of individual assets. Use a 32 × 32 ground module, smaller 16 × 16 details and repeatable wall strips; crop the final strips to exact collision footprints rather than stretching them. Generated atlas candidates require cleanup, transparent-background verification and coherent tile scale before integration.

| Reusable family | Initial inventory | Export specification | Placement constraints |
| --- | --- | --- | --- |
| Main ground material | 8 variants | 32 × 32 opaque tiles | Jade grass/low vegetation over walkable surfaces; variants selected deterministically in irregular clusters. |
| Secondary ground material | 6 variants | 32 × 32 opaque tiles | Worn earth and stone on existing road/side-area masks; preserve open objective routes. |
| Material transitions | Center, 4 edges, 4 outer corners, 4 inner corners; optional junctions after reference review | 32 × 32 tiles | Use a coherent adjacency scheme. No hard seams, accidental dark borders or mismatched scale. |
| Flat surface wear | 8 variations | 16 × 16 and 32 × 32 transparent decals | Low contrast, clustered; keep objective rings and projectile lanes clean. No silhouette suggesting solid cover. |
| Masonry kit | Top, front, left/right ends, inner/outer corners, 4 damage variants | 32 × 32 caps; 32 × 16 front strips; 16 × 16 corners/end patches | Indigo slate within exact wall rectangles; light/dark faces use one consistent direction. Handle narrow residual strips explicitly. |
| Boundary kit | Straight runs, inner corners and corner transitions | Same unit and face dimensions as masonry | Preserve the current 20-unit border footprint. Do not introduce apparent exits. |
| Bush cover kit | 4 crown variants, 4 edges and 4 corners | 32 × 32 transparent pieces | Only existing `MAPS[mapId].bushes`; retain readable footprint. No courtyard concealment props. |
| Grass/leaf accents | 6 anchored variants | 16 × 16 transparent sprites; optional 4-frame upper-part sway | Keep roots fixed; tie placement to known grass or bush masks and current wind/reduced-motion behavior. |
| Torch/brazier support | 2 variants | 16 × 32 transparent sprite with explicit flame anchor | Golden/warm supports using existing anchors and `TorchEffects`; no duplicate fire baked into the support. |
| Flame | Existing eight frames may be reused or replaced as one coherent family | 16 × 20 frames or a uniformly revised complete family, with fixed pivot and light anchor | Preserve shared fire/light phase, bounded sparks and reduced-motion behavior. |
| Base surface inlay | One neutral modular floor treatment, 4 team accent variants | Compose from 32 × 32 pieces; retain snapshot-owned marker extent and center | Keep functional color/labels in their existing readable layer; support CTF, deathmatch and four-team layouts. |
| Edge props and growth | 2 crates, 2 barrels, 4 vine overlays and 4 flower clusters | Props 16 × 24 or 32 × 32; growth 16 × 16 transparent pieces, explicit base pivots | Place solid-looking props on existing blocked edges/footprints. Vines stay attached to walls; flowers remain flat and sparse near combat routes. No new collision. |

Source convention: `assets-src/environment/<theme>/`. Export convention: `packages/client/public/assets/environment/<theme>/`. Use RGBA PNG plus JSON hash atlas metadata, no rotation or trimming, two transparent pixels of padding around transparent frames, and atlases no larger than 1024 × 1024. Repeatable opaque tiles need edge-safe packing or extrusion to prevent seams. Include named source layers for ground, edges, material detail, shadows and animation; retain editable masters. These paths describe future deliverables and do not imply that files have been generated.

## Integration sequence

1. Use the supplied reference and the confirmed forest direction above. Record final palette and scale choices against the image; distinguish observed features from adaptations required by collision and readability.
2. Inspect the generated material/architecture sample at native scale beside a live character, a base marker, a bush boundary and a projectile. Review it at 1× and normal gameplay zoom before accepting the complete kit.
3. Implement the client-only `forest-environment.ts` module consuming existing map geometry and the approved atlas. Separate reusable asset selection from map placement. Continue composing static material into the current 1024-unit RenderTexture chunks rather than allocating one runtime display object per tile.
4. Replace the ground, road and wall drawing in `drawMap` with that module. Replace the matching procedural weathering pass rather than layering duplicate damage/shadows over the new assets. Keep map collision, bush IDs, spawn/home coordinates, network messages and simulation code unchanged.
5. Attach the existing lighting pipeline to the baked surfaces. Keep objective markers, actors, labels, combat telegraphs and readable team colors in their established layers. New support art supplies flame anchors to existing `TorchEffects`; it does not create a second lighting manager.
6. Reuse wind placement and animation only for suitable approved foliage art. Preserve static roots, source bounds, reduced motion and the density budget. Background vegetation must not be mistaken for concealment.
7. Integrate forest first. Keep courtyard, ruins and crossroads on their established renderer until matching variants are explicitly in scope. Forest's authored composition must preserve its map-specific collision and concealment geometry.

## Acceptance evidence

- Side-by-side screenshots against the supplied reference at equivalent crop and approximate scale, with the remaining intentional differences stated.
- Forest screenshot showing all four bush footprints and four walls, both two-team bases, center route and braziers; additional four-team and deathmatch screenshots to catch assumptions tied to one layout.
- Native-scale atlas review for consistent pixel density, stable pivots, tile seams, clipped final wall strips and transparency fringes.
- Playable movement/projectile checks along every wall edge and bush boundary, ensuring visible art agrees with existing collision and concealment.
- Day-to-day lighting checks with a moving mage projectile, torch flicker, reduced motion, intensity zero and Canvas fallback.
- Repeated map/arena/world transitions with stable retained texture, display-object, emitter and source counts. Preserve the existing bounded lightmap approach; measure target hardware before making a performance claim.

Preparation completed by this document: current renderer audit, confirmed forest target and lead-reviewed direction, geometry constraints, reusable asset inventory and integration/validation plan. Asset generation and renderer implementation are being handled by their owners. Completion requires usable exported assets, runtime replacement, gameplay/resource checks and comparative visual verification; this plan alone does not satisfy those deliverables.
