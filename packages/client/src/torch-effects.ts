import type Phaser from 'phaser';
import { visualSettings } from './visual-effects';

export interface EffectLighting {
  setLight(id: string, light: { x: number; y: number; color: number; radius: number; intensity: number; falloff?: number }): void;
  removeLight(id: string): void;
  flash(x: number, y: number, color: number): void;
}
export interface TorchSource { id: string; x: number; y: number; scale?: number }
interface TorchState { id: string; x: number; y: number; frame: number; radius: number; intensity: number }
const PREFIX = 'bandera-flame-v2-';
const SPARK = 'bandera-fire-spark-v2';
const CAP = 64;
const hash = (id: string) => { let n = 0; for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0; return n; };

/** Shape-changing pixel fire and a light driven by the very same source phase. */
export class TorchEffects {
  private definitions: TorchSource[] = [];
  private sprites: Phaser.GameObjects.Image[] = [];
  private active = new Set<string>();
  private states: TorchState[] = [];
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkClock = 0;
  private sparkCursor = 0;
  private destroyed = false;
  get sources(): readonly TorchSource[] { return this.definitions; }
  get diagnostics(): readonly TorchState[] { return this.states; }

  constructor(private scene: Phaser.Scene, private lighting: EffectLighting) {
    for (let frame = 0; frame < 8; frame++) {
      if (scene.textures.exists(PREFIX + frame)) continue;
      const g = scene.add.graphics();
      // Each frame changes tongue width, curvature and height, not merely opacity.
      for (let row = 0; row < 15; row++) {
        const height = 12 + frame % 4;
        if (row >= height) continue;
        const t = row / height;
        const centre = 7 + Math.round(Math.sin(row * .55 + frame * .9) * t * 2);
        const width = Math.max(1, Math.round((1 - t) * 5));
        const y = 17 - row;
        g.fillStyle(0xe85b24).fillRect(centre - width, y, width * 2, 1);
        if (width > 1) g.fillStyle(0xffae36).fillRect(centre - width + 1, y, width * 2 - 2, 1);
        if (row < 7 && width > 2) g.fillStyle(0xffed9a).fillRect(centre - 1, y, 2, 1);
      }
      g.generateTexture(PREFIX + frame, 16, 20);
      g.destroy();
    }
    if (!scene.textures.exists(SPARK)) {
      const g = scene.add.graphics();
      g.fillStyle(0xffffff).fillRect(0, 0, 1, 2);
      g.generateTexture(SPARK, 1, 2); g.destroy();
    }
    for (let i = 0; i < CAP; i++) this.sprites.push(scene.add.image(0, 0, PREFIX + '0').setOrigin(.5, .9).setDepth(8.5).setVisible(false));
    this.sparks = scene.add.particles(0, 0, SPARK, {
      emitting: false, reserve: 64, maxParticles: 65, maxAliveParticles: 64,
      lifespan: { min: 400, max: 1000 }, speedX: { min: -8, max: 8 }, speedY: { min: -28, max: -12 },
      alpha: { start: .85, end: 0 }, tint: [0xffd078, 0xff9c39],
    }).setDepth(18);
    scene.events.once('shutdown', this.destroy, this);
  }
  setSources(sources: readonly TorchSource[]) {
    if (this.destroyed) return;
    for (const id of this.active) this.lighting.removeLight('torch:' + id);
    this.active.clear();
    const unique = new Map<string, TorchSource>();
    for (const source of sources) if (Number.isFinite(source.x) && Number.isFinite(source.y)) unique.set(source.id, { ...source });
    this.definitions = [...unique.values()];
    this.states = [];
    for (const sprite of this.sprites) sprite.setVisible(false);
    this.sparks.killAll();
  }
  update(time: number, delta: number) {
    if (this.destroyed) return;
    const view = this.scene.cameras.main.worldView;
    const cx = view.centerX, cy = view.centerY;
    const visible = this.definitions.filter(s => s.x >= view.left - 150 && s.x <= view.right + 150 && s.y >= view.top - 150 && s.y <= view.bottom + 150)
      .sort((a, b) => ((a.x - cx) ** 2 + (a.y - cy) ** 2) - ((b.x - cx) ** 2 + (b.y - cy) ** 2)).slice(0, CAP);
    const next = new Set<string>();
    this.states = [];
    const reduced = visualSettings.reduced;
    for (let i = 0; i < visible.length; i++) {
      const source = visible[i], phase = hash(source.id) % 10000;
      const scale = Math.max(.2, Math.min(3, source.scale ?? 1));
      const pulse = reduced ? 0 : Math.sin(time * .009 + phase) * .55 + Math.sin(time * .021 + phase * 1.7) * .3;
      const frame = reduced ? phase % 8 : Math.floor(time / (visualSettings.low ? 160 : 95) + phase) % 8;
      const x = source.x + (reduced ? 0 : Math.sin(time * .011 + phase) * .65 * scale);
      const radius = (128 + pulse * 15) * Math.max(.65, Math.min(1.4, scale));
      const strength = 1 + pulse * .12;
      this.sprites[i].setTexture(PREFIX + frame).setPosition(Math.round(x), Math.round(source.y)).setScale(scale).setVisible(true);
      this.lighting.setLight('torch:' + source.id, { x, y: source.y - 5 * scale, color: 0xff9c42, radius, intensity: strength, falloff: 1.6 });
      next.add(source.id);
      this.states.push({ id: source.id, x, y: source.y, frame, radius, intensity: strength });
    }
    for (let i = visible.length; i < CAP; i++) this.sprites[i].setVisible(false);
    for (const id of this.active) if (!next.has(id)) this.lighting.removeLight('torch:' + id);
    this.active = next;
    if (reduced || visualSettings.low || visualSettings.intensity === 0) { this.sparks.killAll(); return; }
    this.sparkClock += Math.max(0, Math.min(100, delta));
    if (this.sparkClock >= 80 / Math.max(.05, visualSettings.intensity) && visible.length) {
      this.sparkClock = 0;
      const source = visible[this.sparkCursor++ % visible.length];
      this.sparks.maxAliveParticles = visualSettings.quality === 'high' ? 64 : 32;
      this.sparks.emitParticleAt(source.x, source.y - 7 * (source.scale ?? 1), 1);
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.destroy, this);
    for (const id of this.active) this.lighting.removeLight('torch:' + id);
    for (const sprite of this.sprites) if (sprite.scene) sprite.destroy();
    if (this.sparks.scene) this.sparks.destroy();
    this.active.clear(); this.definitions = []; this.states = []; this.sprites = [];
  }
}
