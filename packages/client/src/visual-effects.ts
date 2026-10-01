import type Phaser from 'phaser';

export type VisualQuality = 'low' | 'medium' | 'high';
function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Keep usable in-memory settings. */ }
}
const storedQuality = read('bandera-quality');
let quality: VisualQuality = storedQuality === 'low' || storedQuality === 'medium' || storedQuality === 'high'
  ? storedQuality : read('bandera-fx') === 'low' ? 'low' : 'high';
if (!storedQuality && read('bandera-fx') !== null) save('bandera-quality', quality);
const storedIntensity = Number(read('bandera-intensity') ?? '1');
let intensity = Number.isFinite(storedIntensity) ? Math.max(0, Math.min(1, storedIntensity)) : 1;
let shake = read('bandera-shake') !== 'off';

export const visualSettings = {
  get quality(): VisualQuality { return quality; },
  set quality(value: VisualQuality) {
    if (value !== 'low' && value !== 'medium' && value !== 'high') return;
    quality = value;
    save('bandera-quality', value);
    save('bandera-fx', value === 'low' ? 'low' : 'normal');
  },
  get intensity() { return intensity; },
  set intensity(value: number) {
    if (!Number.isFinite(value)) return;
    intensity = Math.max(0, Math.min(1, value));
    save('bandera-intensity', String(intensity));
  },
  get low() { return quality === 'low'; },
  set low(value: boolean) { this.quality = value ? 'low' : 'high'; },
  get shake() { return shake; },
  set shake(value: boolean) { shake = value; save('bandera-shake', value ? 'on' : 'off'); },
  get reduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; },
};

const BUDGETS = {
  low: { particles: 64, density: .4, ambient: 0 },
  medium: { particles: 128, density: .7, ambient: 10 },
  high: { particles: 192, density: 1, ambient: 24 },
} as const;
const TEXTURE = 'bandera-vfx-pixel';

/** Two reusable native emitters; all effects are cosmetic and client-local. */
export class ParticlePool {
  private readonly bursts: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ambient: Phaser.GameObjects.Particles.ParticleEmitter;
  private tint = 0xffffff;
  private speed = 40;
  private lifespan = 350;
  private ambientClock = 0;
  private destroyed = false;
  private settingsKey = '';

  constructor(private readonly scene: Phaser.Scene) {
    if (!scene.textures.exists(TEXTURE)) {
      const graphic = scene.add.graphics();
      graphic.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
      graphic.generateTexture(TEXTURE, 2, 2);
      graphic.destroy();
    }
    this.bursts = scene.add.particles(0, 0, TEXTURE, {
      emitting: false,
      // Phaser 3.90 atLimit counts dead + live particles against maxParticles.
      // Reserve the alive budget, with one unused safety slot in the hard cap.
      reserve: 192, maxParticles: 193, maxAliveParticles: 192,
      tint: { onEmit: () => this.tint },
      speed: { onEmit: () => this.speed * (.55 + Math.random() * .45) },
      lifespan: { onEmit: () => this.lifespan },
      angle: { min: 0, max: 360 },
      alpha: { start: .85, end: 0 },
      scale: { start: 1, end: .5 },
    }).setDepth(19);
    this.ambient = scene.add.particles(0, 0, TEXTURE, {
      emitting: false,
      reserve: 24, maxParticles: 25, maxAliveParticles: 24,
      lifespan: { min: 2800, max: 4500 },
      speedX: { min: -3, max: 3 }, speedY: { min: -5, max: -2 },
      tint: [0xe6dcb1, 0xb8d7c5],
      alpha: { start: .2, end: 0 }, scale: .5,
    }).setDepth(3);
    scene.events.once('shutdown', this.destroy, this);
  }

  burst(x: number, y: number, color: number, count: number, speed = 40, duration = 350) {
    if (this.destroyed || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(count)) return;
    const budget = BUDGETS[visualSettings.quality];
    this.bursts.maxAliveParticles = budget.particles;
    const amount = Math.min(
      budget.particles - this.bursts.getAliveParticleCount(),
      Math.ceil(Math.max(0, count) * budget.density * visualSettings.intensity * (visualSettings.reduced ? .4 : 1)),
    );
    if (amount <= 0) return;
    // Tint is sampled only at birth: later bursts cannot recolor living particles.
    this.tint = color;
    this.speed = Number.isFinite(speed) ? Math.max(0, speed) * (visualSettings.reduced ? .4 : 1) : 40;
    this.lifespan = Number.isFinite(duration) ? Math.max(1, Math.min(3000, duration)) : 350;
    this.bursts.emitParticleAt(x, y, amount);
  }

  update(delta: number) {
    if (this.destroyed) return;
    const settingsKey = `${visualSettings.quality}:${visualSettings.intensity}:${visualSettings.reduced}`;
    if (settingsKey !== this.settingsKey) {
      if (this.settingsKey) this.clear();
      this.settingsKey = settingsKey;
    }
    // Phaser advances native particles; never advance them a second time here.
    const budget = BUDGETS[visualSettings.quality];
    this.bursts.maxAliveParticles = budget.particles;
    const ambientLimit = visualSettings.reduced ? 0 : Math.floor(budget.ambient * visualSettings.intensity);
    if (ambientLimit === 0) {
      this.ambient.killAll();
      this.ambientClock = 0;
      return;
    }
    this.ambient.maxAliveParticles = ambientLimit;
    this.ambientClock += Number.isFinite(delta) ? Math.max(0, Math.min(100, delta)) : 0;
    if (this.ambientClock < 240 || this.ambient.getAliveParticleCount() >= ambientLimit) return;
    this.ambientClock = 0;
    const view = this.scene.cameras.main.worldView;
    if (view.width <= 0 || view.height <= 0) return;
    this.ambient.emitParticleAt(view.x + Math.random() * view.width, view.y + Math.random() * view.height, 1);
  }

  clear() {
    if (this.destroyed) return;
    this.bursts.killAll();
    this.ambient.killAll();
    this.ambientClock = 0;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.destroy, this);
    if (this.bursts.scene) this.bursts.destroy();
    if (this.ambient.scene) this.ambient.destroy();
  }
}
