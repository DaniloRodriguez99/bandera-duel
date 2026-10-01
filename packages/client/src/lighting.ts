import Phaser from 'phaser';
import { visualSettings } from './visual-effects';
import { TerrainLightingPipeline, type TerrainLight } from './lighting-pipeline';

type Rect = { x: number; y: number; w: number; h: number };
export interface LightingEnvironment {
  width: number; height: number; theme: string; arena: boolean; walls?: readonly Rect[];
}
export type LightSpec = TerrainLight;
export const LIGHTING_BUDGETS = {
  low: { pools: 12, flashes: 2, shadows: 6 },
  medium: { pools: 20, flashes: 4, shadows: 10 },
  high: { pools: 32, flashes: 6, shadows: 16 },
} as const;
const TEXTURE = 'bandera-light-falloff-v2';
const DURATION = 240;
const MAX_SOURCES = 96;
let serial = 0;
type Flash = TerrainLight & { image: Phaser.GameObjects.Image; life: number };
type Pool = { image: Phaser.GameObjects.Image; life: number; radius: number };

/** Client-only source registry, terrain shader and Canvas fallback. */
export class LightingManager {
  private sources = new Map<string, TerrainLight>();
  private visible: TerrainLight[] = [];
  private mapLights: TerrainLight[] = [];
  private dynamicLights: TerrainLight[] = [];
  private pools: Pool[] = [];
  private flashes: Flash[] = [];
  private surfaces = new Set<Phaser.GameObjects.RenderTexture>();
  private pipeline?: TerrainLightingPipeline;
  private pipelineName = `bandera-terrain-light-${++serial}`;
  private shadows: Phaser.GameObjects.Graphics;
  private environment?: LightingEnvironment;
  private ambient: [number, number, number] = [.8, .82, .86];
  private cursor = 0;
  private shadowElapsed = 100;
  private destroyed = false;

  constructor(private scene: Phaser.Scene) {
    if (!scene.textures.exists(TEXTURE)) {
      const texture = scene.textures.createCanvas(TEXTURE, 64, 64);
      if (texture) {
        const ctx = texture.context, pixels = ctx.createImageData(64, 64);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
          const alpha = Math.max(0, 1 - Math.hypot(x - 31.5, y - 31.5) / 32), index = (y * 64 + x) * 4;
          pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 255;
          pixels.data[index + 3] = Math.round(alpha ** 1.6 * 255);
        }
        ctx.putImageData(pixels, 0, 0); texture.refresh(); texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    this.shadows = scene.add.graphics().setDepth(1.3);
    if (scene.textures.exists(TEXTURE)) {
      for (let i = 0; i < 32; i++) this.pools.push({ image: this.makeImage(), life: 0, radius: 1 });
      for (let i = 0; i < 6; i++) this.flashes.push({ image: this.makeImage(), life: 0,
        x: 0, y: 0, color: 0xffffff, radius: 100, intensity: 0, falloff: 1.7 });
    }
    if (scene.game.renderer.type === Phaser.WEBGL) {
      const renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      let candidate: TerrainLightingPipeline | undefined;
      try {
        const units = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_IMAGE_UNITS) as number;
        if (units >= 2) {
          candidate = new TerrainLightingPipeline(scene.game);
          renderer.pipelines.add(this.pipelineName, candidate); this.pipeline = candidate;
        }
      } catch {
        renderer.pipelines.remove(this.pipelineName); candidate?.destroy(); this.pipeline = undefined;
      }
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }
  private makeImage() {
    return this.scene.add.image(0, 0, TEXTURE).setDepth(1.25).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }
  setEnvironment(environment: LightingEnvironment) {
    if (this.destroyed) return;
    this.environment = environment; this.sources.clear(); this.visible.length = 0;
    for (const surface of this.surfaces) if (surface.scene) surface.resetPipeline();
    this.surfaces.clear();
    const dark = ['ceniza', 'ruins', 'ruinas', 'cripta'].includes(environment.theme);
    this.ambient = dark ? [.64, .62, .68] : environment.theme === 'cienaga' ? [.72, .8, .77]
      : environment.theme === 'stone' ? [.76, .8, .9] : [.8, .82, .86];
    for (const light of this.flashes) { light.life = 0; light.image.setVisible(false); }
    for (const light of this.pools) light.image.setVisible(false);
    this.shadows.clear(); this.shadowElapsed = 100;
  }
  setLight(id: string, spec: LightSpec) {
    if (this.destroyed || !Number.isFinite(spec.x) || !Number.isFinite(spec.y) ||
      !Number.isFinite(spec.radius) || !Number.isFinite(spec.intensity)) return;
    if (!this.sources.has(id) && this.sources.size >= MAX_SOURCES) return;
    const light = this.sources.get(id) ?? { ...spec };
    light.x = spec.x; light.y = spec.y; light.color = spec.color & 0xffffff;
    light.radius = Phaser.Math.Clamp(spec.radius, 1, 600); light.intensity = Phaser.Math.Clamp(spec.intensity, 0, 3);
    light.falloff = Phaser.Math.Clamp(spec.falloff ?? 1.6, .5, 4); this.sources.set(id, light);
  }
  removeLight(id: string) { this.sources.delete(id); }
  attachSurface(surface: Phaser.GameObjects.RenderTexture) {
    if (this.destroyed || this.surfaces.has(surface)) return;
    this.surfaces.add(surface);
    if (this.pipeline) surface.setPipeline(this.pipeline);
    surface.once(Phaser.GameObjects.Events.DESTROY, () => this.surfaces.delete(surface));
  }
  flash(x: number, y: number, color: number) {
    if (this.destroyed || !this.environment || visualSettings.intensity <= 0 || visualSettings.reduced ||
      !this.flashes.length || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const light = this.flashes[this.cursor++ % LIGHTING_BUDGETS[visualSettings.quality].flashes];
    light.x = x; light.y = y; light.color = color; light.life = DURATION; light.intensity = 1.15;
  }
  update(_time: number, delta: number) {
    if (this.destroyed || !this.environment) return;
    const strength = visualSettings.intensity, budget = LIGHTING_BUDGETS[visualSettings.quality];
    const view = this.scene.cameras.main.worldView;
    this.visible.length = this.mapLights.length = this.dynamicLights.length = 0;
    for (const [id, light] of this.sources) {
      if (light.intensity > 0 && light.x + light.radius >= view.left && light.x - light.radius <= view.right &&
        light.y + light.radius >= view.top && light.y - light.radius <= view.bottom) {
        (id.startsWith('torch:') ? this.mapLights : this.dynamicLights).push(light);
      }
    }
    this.mapLights.sort((a, b) =>
      (a.x - view.centerX) ** 2 + (a.y - view.centerY) ** 2 -
      ((b.x - view.centerX) ** 2 + (b.y - view.centerY) ** 2));
    const limit = Math.min(budget.pools, this.pipeline?.capacity ?? 32);
    // Six permanent lamps remain visible even on Low; reserve the remainder for skills.
    for (let i = 0; i < Math.min(6, this.mapLights.length); i++) this.visible.push(this.mapLights[i]);
    for (let i = 0; i < this.flashes.length; i++) {
      const light = this.flashes[i]; light.life = Math.max(0, light.life - Math.max(0, delta));
      if (!strength || visualSettings.reduced || i >= budget.flashes) light.life = 0;
      light.intensity = 1.15 * light.life / DURATION;
      if (light.life > 0 && this.visible.length < limit) this.visible.push(light);
      light.image.setVisible(false);
    }
    for (const light of this.dynamicLights) { if (this.visible.length >= limit) break; this.visible.push(light); }
    for (let i = 6; i < this.mapLights.length && this.visible.length < limit; i++) this.visible.push(this.mapLights[i]);
    this.pipeline?.configure(this.visible, this.ambient, strength);
    const fallback = !this.pipeline || this.surfaces.size === 0;
    for (let i = 0; i < this.pools.length; i++) {
      const pool = this.pools[i], light = this.visible[i];
      pool.image.setVisible(fallback && strength > 0 && !!light);
      if (fallback && light) {
        pool.radius = light.radius;
        pool.image.setPosition(light.x, light.y).setDisplaySize(light.radius * 2, light.radius * 2)
          .setTint(light.color).setAlpha(Math.min(.65, light.intensity * .3) * strength);
      }
    }
    this.shadowElapsed += Math.max(0, delta);
    if (!strength) this.shadows.clear();
    else if (this.shadowElapsed >= 80) { this.shadowElapsed = 0; this.drawShadows(budget.shadows, strength); }
  }
  private drawShadows(limit: number, strength: number) {
    this.shadows.clear(); const walls = this.environment?.walls;
    if (!walls) return;
    const view = this.scene.cameras.main.worldView; let count = 0;
    for (const wall of walls) {
      if (count >= limit) break;
      if (wall.x + wall.w < view.left - 40 || wall.x > view.right + 40 ||
        wall.y + wall.h < view.top - 40 || wall.y > view.bottom + 40) continue;
      const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
      let dominant: TerrainLight | undefined, best = .08;
      for (const light of this.visible) {
        const influence = light.intensity * Math.max(0, 1 - Math.hypot(cx - light.x, cy - light.y) / light.radius);
        if (influence > best) { dominant = light; best = influence; }
      }
      if (!dominant) continue;
      count++;
      const distance = Math.max(1, Math.hypot(cx - dominant.x, cy - dominant.y));
      const length = Math.min(38, 10 + Math.min(wall.w, wall.h) * .3);
      const dx = (cx - dominant.x) / distance * length, dy = (cy - dominant.y) / distance * length;
      this.shadows.fillStyle(0x101520, Math.min(.26, best * .18) * strength);
      // Extrude only the two far-facing edges; never darken the receiving wall itself.
      if (Math.abs(dy) > .1) {
        const y = dy > 0 ? wall.y + wall.h : wall.y;
        this.shadows.fillPoints([{ x: wall.x, y }, { x: wall.x + wall.w, y },
          { x: wall.x + wall.w + dx, y: y + dy }, { x: wall.x + dx, y: y + dy }], true);
      }
      if (Math.abs(dx) > .1) {
        const x = dx > 0 ? wall.x + wall.w : wall.x;
        this.shadows.fillPoints([{ x, y: wall.y }, { x, y: wall.y + wall.h },
          { x: x + dx, y: wall.y + wall.h + dy }, { x: x + dx, y: wall.y + dy }], true);
      }
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const surface of this.surfaces) if (surface.scene) surface.resetPipeline();
    this.surfaces.clear();
    if (this.pipeline) {
      (this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.remove(this.pipelineName);
      this.pipeline.destroy();
    }
    this.shadows.destroy();
    for (const light of this.pools) light.image.destroy();
    for (const light of this.flashes) light.image.destroy();
    this.pools.length = this.flashes.length = 0; this.sources.clear();
    this.visible.length = this.mapLights.length = this.dynamicLights.length = 0;
  }
}
