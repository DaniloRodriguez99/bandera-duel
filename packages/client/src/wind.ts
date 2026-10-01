import type Phaser from 'phaser';
import { visualSettings } from './visual-effects';

type Rect = { x: number; y: number; w: number; h: number };
export type WindEnvironment = {
  width: number;
  height: number;
  theme: string;
  arena: boolean;
  walls: readonly Rect[];
  bushes?: readonly Rect[];
  grassPatches?: readonly { x: number; y: number }[];
  /** Small moving crowns blend with the authored forest floor and bush beds. */
  richerArt?: boolean;
};
type Sprig = { x: number; y: number; height: number; phase: number; crown: boolean; score: number; bend: number; variant: number };
export type WindActor = { x: number; y: number; visible?: boolean };
const CAPACITY = 100;
const BUDGETS = { high: 100, medium: 60, low: 28 } as const;
const hash = (x: number, y: number) =>
  (Math.imul(Math.round(x) + 13, 73856093) ^ Math.imul(Math.round(y) + 7, 19349663)) >>> 0;

/** Wind is presentation only: anchored roots, integer-moving crowns, no collision/actor changes. */
export class WindManager {
  private readonly graphic: Phaser.GameObjects.Graphics;
  private environment?: WindEnvironment;
  private nodes: Sprig[] = [];
  private actors: readonly WindActor[] = [];
  private elapsed = 0;
  private lastSettings = '';
  private viewCell = '';
  private lastViewX = NaN;
  private lastViewY = NaN;
  private destroyed = false;
  private colors = { root: 0x304b32, leaf: 0x658259, tip: 0x9b9d68 };

  constructor(private readonly scene: Phaser.Scene) {
    this.graphic = scene.add.graphics().setDepth(0.4);
    scene.events.once('shutdown', this.destroy, this);
  }

  setEnvironment(spec: WindEnvironment) {
    if (this.destroyed) return;
    this.environment = spec;
    this.nodes.length = 0;
    this.graphic.clear();
    this.viewCell = '';
    this.lastSettings = '';
    this.elapsed = 0;
    this.actors = [];
    this.colors = spec.theme === 'forest' || spec.theme === 'bosque'
      ? { root: 0x294b32, leaf: 0x568653, tip: 0x91a262 }
      : { root: 0x3b4b34, leaf: 0x78825a, tip: 0xaaa06a };
  }

  /** Supply rendered visible actors only; hidden opponents must never drive foliage. */
  setActors(actors: readonly WindActor[]) {
    this.actors = actors.filter(actor => actor.visible !== false && Number.isFinite(actor.x) && Number.isFinite(actor.y)).slice(0, 64);
  }

  /** Select at most 100 deterministic anchors near the camera, without generating a world grid. */
  private place(left: number, top: number, right: number, bottom: number) {
    const spec = this.environment;
    const priorBends = new Map(this.nodes.map(node => [node.score, node.bend]));
    this.nodes.length = 0;
    if (!spec) return;
    const offer = (x: number, y: number, crown: boolean) => {
      if (x < left || x > right || y < top || y > bottom || x < 8 || x > spec.width - 8 || y < 16 || y > spec.height - 8) return;
      const score = hash(x, y);
      // A bounded deterministic reservoir avoids favoring the first bush/wall in large maps.
      let slot = this.nodes.length;
      if (slot === CAPACITY) {
        slot = 0;
        for (let i = 1; i < CAPACITY; i++) if (this.nodes[i].score > this.nodes[slot].score) slot = i;
        if (score >= this.nodes[slot].score) return;
      }
      this.nodes[slot] = { x, y, crown, score, height: crown ? 5 + score % 5 : 6 + score % 7, phase: (score % 628) / 100, bend: priorBends.get(score) ?? 0, variant: score % 4 };
    };

    if (spec.arena) {
      for (const bush of spec.bushes ?? []) {
        // Six pixels of horizontal inset retain the footprint even at full gust amplitude.
        for (let y = bush.y + 16; y <= bush.y + bush.h - 8; y += 20) {
          for (let x = bush.x + 9; x <= bush.x + bush.w - 9; x += 22) {
            const seed = hash(x, y);
            // Break the regular sprig grid while keeping tips inside the bush footprint.
            offer(x + seed % 5 - 2, y + (seed >>> 5) % 5 - 2, true);
          }
        }
      }
      // Small grass accents frame the arena edges, leaving routes/objectives and walls intact.
      for (let y = 48; y < spec.height - 32; y += 34) {
        for (let x = 44; x < spec.width - 32; x += 37) {
          if (x > 100 && x < spec.width - 100 && y > 95 && y < spec.height - 95) continue;
          if (Math.abs(y - spec.height / 2) < 66 || Math.abs(x - 145) < 35 || Math.abs(x - (spec.width - 145)) < 35) continue;
          if (spec.walls.some(w => x >= w.x - 12 && x <= w.x + w.w + 12 && y >= w.y - 6 && y <= w.y + w.h + 16)) continue;
          if ((spec.bushes ?? []).some(b => x >= b.x - 10 && x <= b.x + b.w + 10 && y >= b.y - 10 && y <= b.y + b.h + 10)) continue;
          if (hash(x, y) % 3 === 0) offer(x + hash(x, y) % 7 - 3, y + hash(y, x) % 7 - 3, false);
        }
      }
    } else {
      for (const point of spec.grassPatches ?? []) offer(point.x, point.y, false);
      if (spec.theme !== 'bosque' && spec.theme !== 'forest') {
        this.nodes.sort((a, b) => a.score - b.score);
        return;
      }
      for (const wall of spec.walls) {
        if (wall.w < 24 || wall.h < 26 || wall.x > right || wall.x + wall.w < left || wall.y > bottom || wall.y + wall.h < top) continue;
        // Only the existing canopy footprint is touched. No random plants on water or roads.
        const firstX = wall.x + 12 + Math.max(0, Math.ceil((left - wall.x - 12) / 34)) * 34;
        for (let x = firstX; x < Math.min(right, wall.x + wall.w - 10); x += 34) {
          offer(x, wall.y + 16, true);
          if (wall.h > 44) offer(x, wall.y + wall.h - 10, true);
        }
        const firstY = wall.y + 42 + Math.max(0, Math.ceil((top - wall.y - 42) / 34)) * 34;
        for (let y = firstY; y < Math.min(bottom, wall.y + wall.h - 24); y += 34) {
          offer(wall.x + 12, y, true);
          if (wall.w > 44) offer(wall.x + wall.w - 12, y, true);
        }
      }
    }
    // Quality changes reveal a stable subset instead of changing all plant positions.
    this.nodes.sort((a, b) => a.score - b.score);
  }

  update(time: number, delta: number) {
    if (this.destroyed || !this.environment) return;
    const reduced = visualSettings.reduced;
    const intensity = visualSettings.intensity;
    const quality = visualSettings.quality;
    const settings = `${quality}:${intensity}:${reduced}`;
    const changed = settings !== this.lastSettings;
    this.lastSettings = settings;
    if (intensity <= 0) {
      if (changed) this.graphic.clear();
      return;
    }
    const view = this.scene.cameras.main.worldView;
    if (view.width <= 0 || view.height <= 0) return;
    const cameraMoved = view.x !== this.lastViewX || view.y !== this.lastViewY;
    this.lastViewX = view.x;
    this.lastViewY = view.y;
    // Quantized windows prevent rebuilding the node selection on each camera pixel. Padding
    // covers the whole cell and the maximum crown displacement; render culling remains exact.
    const cellX = Math.floor(view.x / 64) * 64;
    const cellY = Math.floor(view.y / 64) * 64;
    const cell = `${cellX}:${cellY}:${view.width}:${view.height}`;
    const moved = cell !== this.viewCell;
    if (moved) {
      this.viewCell = cell;
      this.place(cellX - 24, cellY - 24, cellX + view.width + 88, cellY + view.height + 88);
    }
    this.elapsed += Number.isFinite(delta) ? Math.max(0, Math.min(100, delta)) : 0;
    if (!changed && !moved && !(reduced && cameraMoved) && (reduced || this.elapsed < (quality === 'low' ? 66 : 33))) return;
    const blend = 1 - Math.exp(-this.elapsed / 140);
    this.elapsed = 0;
    const g = this.graphic;
    g.clear();
    const t = Number.isFinite(time) ? time * 0.001 : 0;
    const gust = 0.62 + Math.sin(t * 0.57) * 0.24 + Math.sin(t * 0.19 + 1.7) * 0.14;
    const count = Math.min(this.nodes.length, Math.ceil(BUDGETS[quality] * intensity));
    for (let i = 0; i < count; i++) {
      const n = this.nodes[i];
      if (n.x < view.x - 10 || n.x > view.right + 10 || n.y < view.y - 4 || n.y > view.bottom + 16) continue;
      let push = 0;
      if (!reduced) for (const actor of this.actors) {
        const dx = n.x - actor.x, dy = n.y - actor.y;
        if (Math.abs(dx) > 28 || Math.abs(dy) > 28) continue;
        const distance = Math.hypot(dx, dy);
        if (distance >= 28) continue;
        const influence = (dx === 0 ? (n.variant % 2 ? 1 : -1) : Math.sign(dx)) * (1 - distance / 28) * 3;
        if (Math.abs(influence) > Math.abs(push)) push = influence;
      }
      n.bend = reduced ? 0 : n.bend + (push - n.bend) * blend;
      const motion = Math.round((Math.sin(t * 1.65 - n.x * 0.008 + n.y * 0.003) * 1.9 * gust + Math.sin(t * 2.1 + n.phase) * 0.55 + n.bend) * intensity);
      const sway = reduced ? 0 : Math.max(n.crown ? -3 : -5, Math.min(n.crown ? 3 : 5, motion));
      const lift = reduced ? 0 : Math.round(Math.sin(t * 1.2 + n.phase) * gust * intensity);
      const x = Math.round(n.x);
      const y = Math.round(n.y);
      const tipY = y - n.height + lift + Math.round(Math.abs(n.bend) * .4);
      const rich = this.environment.richerArt;
      const leaf = rich ? [0x477a40, 0x578644, 0x36663e, 0x6b914a][n.variant] : this.colors.leaf;
      const tip = rich ? [0x85a45f, 0xa3b967, 0x779e63, 0xb2bb70][n.variant] : this.colors.tip;
      // The root never translates: the short mid-stem bridges to the moving upper leaves.
      g.fillStyle(this.colors.root, 0.72).fillRect(x - 2, y - 2, 5, 2);
      g.fillStyle(leaf, rich ? .86 : .7).fillRect(x, y - 5, 2, 4);
      g.fillRect(x + Math.round(sway / 2), y - 7, 2, 4);
      if (n.crown) {
        const spread = 3 + n.variant % 2;
        g.fillRect(x - spread + sway, tipY, spread * 2 + 1, 3);
        g.fillRect(x - 1 + sway, tipY - 2 - n.variant % 2, 3 + n.variant % 3, 2);
        if (n.variant > 1) g.fillRect(x - spread - 1 + Math.round(sway * .6), tipY + 3, 3, 2);
        g.fillStyle(tip, rich ? .75 : .58).fillRect(x - spread + 1 + sway, tipY, 2 + n.variant % 2, 1);
      } else {
        g.fillRect(x + sway, tipY, 2, 5);
        g.fillRect(x - 3 + Math.round(sway * .6), tipY + 3 + n.variant % 2, 2, 3);
        if (n.variant % 2) g.fillRect(x + 3 + Math.round(sway * .4), tipY + 4, 2, 3);
        g.fillStyle(tip, .66).fillRect(x + sway, tipY, 1 + n.variant % 2, 2);
      }
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.destroy, this);
    if (this.graphic.scene) this.graphic.destroy();
    this.nodes.length = 0;
    this.actors = [];
    this.environment = undefined;
  }
}
