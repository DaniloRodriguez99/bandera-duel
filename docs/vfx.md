# Native particle effects

`packages/client/src/visual-effects.ts` preserves `ParticlePool(scene)`, `burst(x, y, color, count, speed?, duration?)`, `update(delta)` and `clear()`. `destroy()` is idempotent and also runs on scene shutdown. Existing scene triggers continue to provide dust, dash trails, projectile trails and event sparks without new networking or gameplay calculations.

Two Phaser 3.90 native particle emitters share a generated 2 × 2 white pixel texture. One handles burst effects, the other subtle dust within the camera's world view. Tint, speed and lifespan are sampled on emission; changing burst color leaves earlier living particles untouched. Native emitters advance via Phaser's update list, so the compatibility `update` method only manages ambient emission and live quality changes.

| Preset | Maximum burst particles | Burst density | Ambient limit |
| --- | ---: | ---: | ---: |
| Low | 64 | 40% | 0 |
| Medium | 128 | 70% | 10 |
| High | 192 | 100% | 24 |

These are conservative allocation budgets, not measured FPS guarantees. A total of 216 particle objects is reserved once, then recycled. Phaser 3.90's `atLimit()` compares the total dead + alive allocation against `maxParticles`, so hard caps intentionally include one unused safety slot; `maxAliveParticles` enforces actual emission capacity. Changing quality, intensity or reduced-motion preferences clears existing cosmetic particles on the next frame, enforcing the new budget immediately. No per-burst emitter, texture or configuration allocations are made.

`visualSettings.quality` persists as `bandera-quality`; the old `bandera-fx` setting migrates to low/high. `visualSettings.low` remains a compatible accessor. `visualSettings.intensity` independently persists a clamped 0–1 value as `bandera-intensity`. Storage failures retain usable in-memory settings. `shake` remains compatible, and `reduced` follows the current reduced-motion media preference. Reduced motion suppresses ambient particles and reduces burst travel/count. Scene-owned attack shapes, hit feedback, objectives and other gameplay indicators remain independent of the particle budget and intensity.

Native API behavior was checked against installed `phaser/src/gameobjects/particles/ParticleEmitter.js`, `Particle.js` and `EmitterOp.js`. No Rex or external particle dependency is required for these effects. The shared tiny texture stays cached across scene restarts; both emitters and their particles are destroyed on shutdown.
