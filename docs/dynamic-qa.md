# Dynamic lighting QA

The browser regression suite is `tests/browser/dynamic-lighting.spec.ts`. It exercises the running scene through the actual entry script URL, retaining Vite's query string to avoid constructing a second scene through a distinct module identity.

Coverage:

- Courtyard torch animation changes its authored flame frame, position and radius. A rendered pixel near the northwestern torch is sampled with lighting disabled and enabled; this checks terrain output rather than accepting a registry entry as proof of illumination.
- Forest wind changes its Graphics drawing commands at two times while retaining identical root anchors. Reduced motion keeps the drawing static.
- An actual local mage primary attack creates a moving projectile light and releases it after expiration.
- A real two-client room repeats the mage attack and verifies movement and cleanup on the other client's authoritative snapshots.
- Repeated map changes return texture, display object, shutdown listener, source and attached-surface counts to baseline, with a previous-map source removed.
- A source placed on opposite sides of an existing wall changes the short shadow geometry.
- Forced Canvas initialization retains fire, vegetation and moving projectile feedback without WebGL or page errors.

Run with the repository Playwright configuration, one worker, and no other suite using its server ports:

```sh
npx playwright test tests/browser/dynamic-lighting.spec.ts --workers=1
```

The initial lighting integration passed 19 tests. After the forest redesign, the
expanded frozen-source run passed 23 of 24 scenarios and exposed an asset-loading
race on reconnect: `reset()` accessed controls before scene creation and aborted
room handler registration. Reset and HUD configuration now tolerate that preload
window. The failed full-match/rematch/reconnect test then passed with image loads
deliberately delayed by 1200ms. All 24 scenarios have therefore been validated,
including the seven lighting tests, four forest tests, world entry, mobile controls,
four-player seating and resource lifecycle checks. The production build passes
with Node 24. FPS measurements are separately recorded in `forest-validation.md`.

## Source review

The separate real-world entry/navigation test also passed. Screenshot inspection
found pre-existing missing guard textures in the valley: settlement sprites still
used the removed `blue-guardian-0` player key. They now reuse the authored guardian
pixel art through a dedicated cached settlement texture.

The terrain vertex shader converts renderer positions into world positions with an affine inverse derived from `Camera.getWorldPoint`. This is independent of render-texture UV orientation and supports camera translation, zoom and rotation. Its fragment shader uses existing terrain color, finite source radius, color and falloff; actor textures keep their separate pipeline. Shadow Graphics render below actors and combat indicators. Source and surface registries clear on environment changes; per-surface destroy listeners remove obsolete attachments, and controller destruction removes its sources.

Resolved review finding: six nearby torches retain slots, followed by impact flashes and ability sources before additional torches. Dense maps therefore no longer consume the entire visible budget with torches. Final renderer uses a bounded camera-local lightmap, two texture reads per receiving pixel, and exterior shadow strips. A second independent source review found no material camera-mapping, cleanup or integration defects.
