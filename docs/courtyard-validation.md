# Courtyard reconstruction validation

## Actual visual review

The supplied six-obstacle reference was compared against the running courtyard in four passes. Captures use the same top-down camera, the complete 960x540 arena and a 1680x945 canvas (reference approximately 1678x941). The comparison capture hides only the HTML ability cards and control guide; the game renderer, actor state, flags, lighting and geometry are unchanged. A separate normal-size capture retains the HUD.

Corrections driven by those captures: broad vertical wall caps; contiguous two-row horizontal caps; shallow front faces; cool masonry shading; irregular border foliage with visible stone gaps; naturally proportioned wall-foot plants; small plants in clearings; perimeter crates, barrels, banners and boulders; concentrated warm torch illumination. The six obstacle footprints, perimeter collision, spawns and objective homes remain shared authoritative data. No shared simulation or network code changed.

Final local artifacts (ignored by Git):

- `artifacts/reconstruction-courtyard/torch-a.png` and `torch-b.png`: full composition and changing flames.
- `artifacts/reconstruction-courtyard/mage-charge.png` and `mage-projectile.png`: live combat captures.
- `artifacts/reconstruction-courtyard/wind-a.png` and `wind-b.png`: courtyard vegetation animation.
- `artifacts/reconstruction-courtyard/iteration-2.png` and `iteration-3.png`: intermediate proportions and light distribution.
- `artifacts/reconstruction-courtyard-standard/torch-a.png`: normal layout with the HUD.
- Both directories contain `validation.json` with source diagnostics, object/texture counts, measured frame times and browser errors.

Remaining differences: the reusable original stone and foliage assets have their own cracks and leaf shapes; the reference's paving and ground coverage are more irregular. Boundary masonry follows the original 20-unit collision border. Existing readable character art, base labels and gameplay indicators are retained. This is a substantial reconstruction, not a pixel-exact reproduction. Dynamic shadows are bounded architectural projections, not full per-pixel light occlusion; selective glow uses local additive sprites. Only vegetation crowns and tips move, with static authored foliage underneath.

## Performance

Measured in local headless Chromium, one browser, three-second samples per quality, on the actual courtyard. Each sample registers 16 additional lights alongside ten torch sources and team/ability lighting; quality budgets determine how many are rendered. These short measurements are not a guarantee for every GPU or device.

| Canvas | Quality | Median frame ms | 95th percentile ms |
| --- | --- | ---: | ---: |
| 1110x624, viewport 1366x900 | Low | 16.5 | 18.3 |
| 1110x624, viewport 1366x900 | Medium | 16.5 | 18.7 |
| 1110x624, viewport 1366x900 | High | 16.5 | 18.4 |
| 1680x945, viewport 1920x1200 | Low | 21.9 | 24.5 |
| 1680x945, viewport 1920x1200 | Medium | 21.5 | 25.5 |
| 1680x945, viewport 1920x1200 | High | 21.5 | 24.6 |

The normal canvas ran approximately 60 frames/second; the reference-size canvas approximately 46. The reference capture sampled 265 scene objects and 179 textures before attacking, 267 objects during a projectile. Neither visual run reported browser or shader errors. Terrain and architecture remain seven baked receiving surfaces. The lightmap stays 320x192 and requires two fragment texture reads, independent of light count. No new full-screen postprocessing pass is introduced.

Reproduce using Node 24 with the development client on port 5175:

```sh
node scripts/dynamic-visual-check.mjs courtyard artifacts/reconstruction-courtyard --reference
node scripts/dynamic-visual-check.mjs courtyard artifacts/reconstruction-courtyard-standard
```

## Automated checks

Production build passed with Node 24. The existing Vite warning for chunks above 500 kB remains.

All 28 browser tests passed in 4.1 minutes. The focused courtyard suite checks seven loaded and lit receivers, equality with all six shared wall footprints, front/behind actor depth and fade, anchored wind roots, and stable resources after courtyard/forest/world transitions. It verifies geometry equality rather than directly testing collision resolution. The integration batch additionally covers rendered torch illumination, magical projectile movement/expiry locally and remotely, reduced motion, shadow direction, Canvas fallback, forest collision navigation, map selection, practice, two-browser capture/rematch/reconnection, four-player layouts and world entry. A separate read-only integration review found no material lifecycle or lightmap encoding defects.
