import Phaser from 'phaser';
import type { MapDefinition, Rect } from '@bandera/shared';

const TERRAIN = 'forest-terrain-atlas';
const PROPS = 'forest-props-atlas';
const WIDTH = 960;
const HEIGHT = 540;
let serial = 0;
const hash = (x: number, y: number, salt = 0) =>
  (Math.imul(x + 11, 73856093) ^ Math.imul(y + 23, 19349663) ^ Math.imul(salt + 7, 83492791)) >>> 0;

/** Props have intentionally taller ivy/pedestal silhouettes than a rigid 4×4 crop allows. */
function frameBounds(width: number, height: number, frame: number, props = false) {
  const col = frame % 4, row = Math.floor(frame / 4);
  const x = Math.round(col * width / 4), right = Math.round((col + 1) * width / 4);
  let top = row / 4, bottom = (row + 1) / 4;
  if (props) {
    const ranges = frame === 3 ? [0, 370] : frame === 7 ? [370, 610]
      : row === 0 ? [0, 314] : row === 1 ? [314, 610]
        : frame === 11 ? [610, 900] : row === 2 ? [615, 894] : [894, 1254];
    top = ranges[0] / 1254; bottom = ranges[1] / 1254;
  }
  const y = Math.round(top * height);
  return { x, y, w: right - x, h: Math.round(bottom * height) - y };
}

/** The loader owns URLs; crops derive from source dimensions (currently 1254×1254). */
export function ensureForestFrames(scene: Phaser.Scene): boolean {
  for (const key of [TERRAIN, PROPS]) {
    if (!scene.textures.exists(key)) return false;
    const texture = scene.textures.get(key);
    if (texture.source[0].width < 1024 || texture.source[0].height < 1024) return false;
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (let i = 0; i < 16; i++) if (!texture.has(String(i))) {
      const r = frameBounds(texture.source[0].width, texture.source[0].height, i, key === PROPS);
      texture.add(String(i), 0, r.x, r.y, r.w, r.h);
    }
  }
  return true;
}

/** Flame coordinates, not the brazier feet. The existing TorchEffects owns flame animation. */
export const FOREST_BRAZIERS = [
  { x: 225, y: 96, scale: 1.3 }, { x: 735, y: 96, scale: 1.3 }, { x: 225, y: 440, scale: 1.3 }, { x: 735, y: 440, scale: 1.3 },
  { x: 400, y: 150, scale: 1 }, { x: 560, y: 390, scale: 1 },
  { x: 215, y: 18, scale: .9 }, { x: 745, y: 18, scale: .9 },
  { x: 28, y: 180, scale: .9 }, { x: 932, y: 180, scale: .9 },
  { x: 28, y: 280, scale: .9 }, { x: 932, y: 280, scale: .9 },
  { x: 200, y: 508, scale: .9 }, { x: 770, y: 508, scale: .9 },
] as const;

/** Original atlas art composed once; only four wall objects need runtime occlusion updates. */
export class ForestEnvironment {
  readonly surfaces: Phaser.GameObjects.RenderTexture[] = [];
  private architecture: { surface: Phaser.GameObjects.RenderTexture; wall: Rect }[] = [];
  private destroyed = false;
  private terrain: CanvasImageSource;
  private props: CanvasImageSource;
  private patterns: HTMLCanvasElement[] = [];
  private propCache = new Map<string, HTMLCanvasElement>();

  constructor(private scene: Phaser.Scene, map: MapDefinition) {
    if (!ensureForestFrames(scene)) throw new Error('Forest atlases must be loaded before composing the map');
    this.terrain = scene.textures.get(TERRAIN).getSourceImage() as CanvasImageSource;
    this.props = scene.textures.get(PROPS).getSourceImage() as CanvasImageSource;
    for (let frame = 0; frame < 16; frame++) {
      const tile = document.createElement('canvas'); tile.width = tile.height = 64;
      // Prefilter high-resolution source art once into the game's native material resolution.
      // Nearest sampling then preserves this final grid instead of aliasing tiny source leaves.
      const ctx = tile.getContext('2d')!; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const crop = scene.textures.get(TERRAIN).get(String(frame));
      ctx.drawImage(this.terrain, crop.cutX, crop.cutY, crop.cutWidth, crop.cutHeight, 0, 0, 64, 64);
      this.patterns.push(tile);
    }
    this.bake(0, 0, WIDTH, HEIGHT, 0, ctx => this.drawGround(ctx, map));
    for (const wall of map.walls) {
      const surface = this.bake(wall.x, wall.y - 18, wall.w, wall.h + 18,
        10 + Math.floor((wall.y + wall.h) / 2) / 100000, ctx => this.drawWall(ctx, wall));
      this.architecture.push({ surface, wall });
    }
    // The atlas and five receiving textures own all persistent art; discard temporary tiles.
    this.patterns.length = 0; this.propCache.clear();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private bake(x: number, y: number, width: number, height: number, depth: number,
    paint: (ctx: CanvasRenderingContext2D) => void) {
    const key = `forest-composite-${++serial}`;
    const texture = this.scene.textures.createCanvas(key, Math.ceil(width), Math.ceil(height));
    if (!texture) throw new Error('Unable to allocate forest composition');
    texture.context.imageSmoothingEnabled = false;
    paint(texture.context); texture.refresh(); texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const image = this.scene.make.image({ key, x: 0, y: 0 }, false).setOrigin(0);
    const surface = this.scene.add.renderTexture(x, y, width, height).setOrigin(0).setDepth(depth);
    surface.draw(image, 0, 0); image.destroy(); this.scene.textures.remove(key);
    this.surfaces.push(surface);
    return surface;
  }

  private tile(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, w: number, h: number, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = ctx.createPattern(this.patterns[frame], 'repeat')!;
    ctx.fillRect(x, y, w, h); ctx.restore();
  }

  private prop(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, w: number, h = w, alpha = 1, flip = false) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const key = `${frame}-${w}-${h}`;
    let reduced = this.propCache.get(key);
    if (!reduced) {
      reduced = document.createElement('canvas'); reduced.width = w; reduced.height = h;
      const target = reduced.getContext('2d')!;
      target.imageSmoothingEnabled = true; target.imageSmoothingQuality = 'high';
      const crop = this.scene.textures.get(PROPS).get(String(frame));
      target.drawImage(this.props, crop.cutX, crop.cutY, crop.cutWidth, crop.cutHeight, 0, 0, w, h);
      this.propCache.set(key, reduced);
    }
    ctx.save(); ctx.globalAlpha = alpha;
    if (flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); x = y = 0; }
    ctx.drawImage(reduced, Math.round(x), Math.round(y)); ctx.restore();
  }

  private island(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, frame: number, alpha: number, seed: number) {
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const angle = i * Math.PI / 9, noise = .8 + (hash(seed, i) % 25) / 100;
      const px = Math.round((x + Math.cos(angle) * rx * noise) / 2) * 2;
      const py = Math.round((y + Math.sin(angle) * ry * noise) / 2) * 2;
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.clip(); this.tile(ctx, frame, x - rx, y - ry, rx * 2, ry * 2, alpha); ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, map: MapDefinition) {
    ctx.fillStyle = '#132c2b'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.tile(ctx, 0, 0, 0, WIDTH, HEIGHT, .24);
    // Broad connected tonal clearings replace a grid of flat ground rectangles.
    for (let y = 60; y < HEIGHT; y += 120) for (let x = 80; x < WIDTH; x += 170) {
      const n = hash(x, y, 7);
      this.island(ctx, x + n % 32, y + (n >>> 5) % 24, 100, 66, n % 3 === 0 ? 15 : 2, .12 + n % 9 / 100, n);
    }
    // Horizontal lane preserves the exact 234..306 footprint. The two side routes also retain their coordinates.
    this.tile(ctx, 12, 20, 230, 920, 80, .75);
    this.tile(ctx, 4, 20, 234, 920, 72);
    for (let x = 20; x < 940; x += 64) this.tile(ctx, (hash(x, 270) % 3) + 5, x, 234, Math.min(64, 940 - x), 72, .45);
    for (const x of [130, 800]) {
      this.tile(ctx, 2, x - 7, 50, 42, 440, .75);
      this.tile(ctx, 5, x, 50, 28, 440, .78);
    }
    // Textured stone medallion: architectural detail, not a gameplay targeting ring.
    ctx.save(); ctx.beginPath(); ctx.arc(480, 270, 62, 0, Math.PI * 2); ctx.arc(480, 270, 54, 0, Math.PI * 2, true);
    ctx.clip('evenodd'); this.tile(ctx, 9, 416, 206, 128, 128, .9); ctx.restore();
    this.island(ctx, 480, 270, 43, 37, 6, .35, 88);
    // Worn aprons use low-contrast terrain; base objective rendering stays with the scene.
    for (const x of [145, 815]) this.island(ctx, x, 270, 45, 40, 5, .52, x);
    for (const fire of FOREST_BRAZIERS.slice(0, 6)) {
      this.island(ctx, fire.x, fire.y + 12, 39, 30, 3, .26, fire.x + fire.y);
      this.island(ctx, fire.x + 5, fire.y + 24, 23, 17, 14, .22, fire.x);
    }
    // Low-contrast worn shortcuts connect the inner lamps to the central clearing.
    // Their irregular silhouettes are ground wear, not a new bounded movement lane.
    for (const lower of [false, true]) {
      ctx.save(); ctx.beginPath();
      const transform = (x: number, y: number) => lower ? { x: 960 - x, y: 540 - y } : { x, y };
      const start = transform(394, 157); ctx.moveTo(start.x, start.y);
      for (const [x, y] of [[409, 153], [424, 174], [436, 180], [450, 194], [482, 204],
        [487, 215], [469, 214], [443, 205], [427, 194], [413, 187], [405, 172]]) {
        const point = transform(x, y); ctx.lineTo(point.x, point.y);
      }
      ctx.closePath(); ctx.clip(); this.tile(ctx, 3, 385, lower ? 320 : 145, 190, 85, .38); ctx.restore();
    }

    // Four cover regions remain exactly where the authoritative bush rectangles are.
    for (const bush of map.bushes) {
      this.island(ctx, bush.x + bush.w / 2, bush.y + bush.h / 2, bush.w / 2, bush.h / 2, 13, .9, bush.x);
      // A slim authored stone planter makes the exact concealment boundary readable.
      ctx.save(); ctx.beginPath(); ctx.roundRect(bush.x, bush.y, bush.w, bush.h, 11); ctx.clip();
      this.tile(ctx, 5, bush.x, bush.y, bush.w, bush.h, .8);
      ctx.fillStyle = '#18362d'; ctx.fillRect(bush.x + 3, bush.y + 3, bush.w - 6, bush.h - 8);
      this.tile(ctx, 11, bush.x, bush.y + bush.h - 6, bush.w, 6, .92);
      ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.roundRect(bush.x, bush.y, bush.w, bush.h, 13); ctx.clip();
      // Foliage starts inside the rim, with varied tops and roots rather than clipped tiles.
      for (let y = bush.y + 4; y < bush.y + bush.h - 31; y += 18) for (let x = bush.x + 3; x < bush.x + bush.w - 24; x += 24) {
        const n = hash(x, y, 32), size = 39 + n % 13;
        const height = Math.min(size + 3, bush.y + bush.h - 7 - y);
        this.prop(ctx, n % 7 === 0 ? 0 : n % 3 === 0 ? 1 : 2, x + n % 5, y + n % 5,
          Math.min(size, bush.x + bush.w - 4 - x), height - n % 5, .96, n % 2 === 0);
      }
      for (let i = 0; i < 6; i++) {
        const x = bush.x + 10 + i * (bush.w - 25) / 6;
        this.prop(ctx, i % 3 + 4, x, bush.y + bush.h - 32 + i % 3, 23, 23, .75);
      }
      ctx.restore();
    }

    // Groundcover near boundaries is rich; lanes, bases, wall footprints and cover edges stay readable.
    for (let y = 26; y < 514; y += 28) for (let x = 26; x < 934; x += 31) {
      const n = hash(x, y, 81), edge = x < 85 || x > 875 || y < 64 || y > 476;
      if (!edge && n % 9 !== 0) continue;
      if (y > 220 && y < 318 || Math.abs(x - 145) < 28 || Math.abs(x - 815) < 28) continue;
      if (map.walls.some(w => x > w.x - 20 && x < w.x + w.w + 15 && y > w.y - 28 && y < w.y + w.h + 12)) continue;
      if (map.bushes.some(b => x > b.x - 10 && x < b.x + b.w + 10 && y > b.y - 10 && y < b.y + b.h + 10)) continue;
      const frame = n % 8 === 0 ? 4 + n % 3 : n % 3 === 0 ? 7 : 1;
      const size = edge ? 24 + n % 16 : 20 + n % 9;
      this.prop(ctx, frame, x - size / 2 + n % 7, y - size / 2, size, size, edge ? .92 : .58, n % 2 === 0);
    }

    // Ground contact is painted separately from elevated architecture, never inside walkable lanes.
    for (const w of map.walls) {
      ctx.save(); ctx.fillStyle = 'rgba(5,16,22,.26)';
      ctx.fillRect(w.x + 3, w.y + w.h - 1, w.w + 4, 9); ctx.restore();
      for (let x = w.x - 8; x < w.x + w.w; x += 25) this.prop(ctx, 7, x, w.y + w.h - 9, 26, 22, .9);
    }

    // The physical boundary is unchanged: 20px masonry, with authored cap and ivy rather than plain bars.
    this.tile(ctx, 8, 0, 0, WIDTH, 20); this.tile(ctx, 10, 0, 520, WIDTH, 20);
    this.tile(ctx, 8, 0, 20, 20, 500); this.tile(ctx, 8, 940, 20, 20, 500);
    this.tile(ctx, 9, 0, 0, WIDTH, 5); this.tile(ctx, 9, 0, 520, WIDTH, 5);
    this.tile(ctx, 9, 0, 0, 5, HEIGHT); this.tile(ctx, 9, 940, 0, 5, HEIGHT);
    for (let x = 12; x < WIDTH; x += 57) {
      this.prop(ctx, 3, x, -5, 42, 40, .94, x % 2 === 0);
      this.prop(ctx, 0, x + 16, 514, 32, 32, .95);
    }
    for (let y = 48; y < 508; y += 67) {
      this.prop(ctx, 3, -10, y, 34, 44); this.prop(ctx, 3, 939, y + 19, 34, 44, 1, true);
    }
    for (let i = 0; i < FOREST_BRAZIERS.length; i++) {
      const fire = FOREST_BRAZIERS[i];
      if (i < 6) this.prop(ctx, 11, fire.x - 18, fire.y - 7, 36, 42);
      else this.prop(ctx, 12, fire.x - 9, fire.y - 4, 18, 30);
    }
  }

  private drawWall(ctx: CanvasRenderingContext2D, wall: Rect) {
    const w = wall.w, h = wall.h + 18;
    this.tile(ctx, 8, 0, 0, w, h);
    this.tile(ctx, 11, 0, 0, w, h - 18, .72);
    this.tile(ctx, 9, 0, 0, w, 8);
    this.tile(ctx, 9, 0, h - 21, w, 5);
    this.tile(ctx, 10, 0, h - 16, w, 16, .92);
    ctx.fillStyle = 'rgba(147,174,186,.13)'; ctx.fillRect(0, 0, w, 8);
    ctx.fillStyle = 'rgba(156,182,194,.19)'; ctx.fillRect(1, h - 21, w - 2, 2);
    ctx.fillStyle = 'rgba(8,20,31,.22)'; ctx.fillRect(0, h - 15, w, 15);
    ctx.fillStyle = 'rgba(5,15,25,.22)'; ctx.fillRect(w - 4, 5, 4, h - 5);
    ctx.fillStyle = 'rgba(158,181,171,.25)'; ctx.fillRect(1, 2, 2, h - 23);
    for (let x = -5; x < w; x += 31) this.prop(ctx, 3, x, h - 33, 37, 36, .94, x % 2 === 0);
    for (let y = 3; y < h - 26; y += 39) this.prop(ctx, 7, w - 24, y, 28, 25, .8);
    if (w > 80) {
      this.prop(ctx, 10, 10, 6, 32, 28, .96);
      this.prop(ctx, 15, w - 42, 0, 33, 38, .97);
      this.prop(ctx, 8, 44, 16, 26, 26);
      this.prop(ctx, 9, 70, 18, 23, 25);
    } else {
      this.prop(ctx, wall.x < 480 ? 13 : 14, 4, 23, w - 8, 52, .86);
      this.prop(ctx, 8, 2, h - 64, 24, 25);
      this.prop(ctx, 9, w - 23, h - 42, 21, 24);
    }
  }

  update(_time: number, delta: number, actors: readonly { x: number; y: number }[] = []) {
    if (this.destroyed) return;
    for (const { surface, wall } of this.architecture) {
      const occluding = actors.some(actor => actor.x > wall.x - 10 && actor.x < wall.x + wall.w + 10 &&
        actor.y > wall.y - 22 && actor.y < wall.y + 7);
      const target = occluding ? .45 : 1;
      surface.setAlpha(Phaser.Math.Linear(surface.alpha, target, Math.min(1, Math.max(0, delta) / 90)));
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const surface of this.surfaces) if (surface.scene) surface.destroy();
    this.surfaces.length = 0; this.architecture.length = 0; this.patterns.length = 0; this.propCache.clear();
  }
}
