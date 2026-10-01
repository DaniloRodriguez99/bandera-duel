import Phaser from 'phaser';
import type { MapDefinition, Rect } from '@bandera/shared';

const ART = 'courtyard-art-atlas';
const TERRAIN = 'forest-terrain-atlas';
let serial = 0;
type Actor = { x: number; y: number };
type Placement = readonly [frame: number, x: number, y: number, width: number, height: number, flip?: boolean];
// Inspected original1254px atlas: architecture and props occupy deliberately unequal cells.
const ART_REGIONS = [
  [35, 5, 185, 374], [255, 120, 325, 250], [600, 120, 460, 250], [1080, 0, 160, 379],
  [0, 380, 344, 284], [358, 400, 252, 250], [625, 395, 321, 258], [960, 391, 294, 290],
  [30, 660, 253, 292], [346, 665, 268, 271], [678, 656, 227, 293], [960, 682, 291, 263],
  [40, 977, 267, 260], [350, 976, 268, 260], [636, 935, 278, 319], [955, 939, 275, 315],
] as const;

/** Respect supplied crops; otherwise scale inspected regions and trim transparent margins. */
export function ensureCourtyardFrames(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(ART) || !scene.textures.exists(TERRAIN)) return false;
  const texture = scene.textures.get(ART), source = texture.getSourceImage() as CanvasImageSource;
  const width = texture.source[0].width, height = texture.source[0].height;
  if (width < 512 || height < 512) return false;
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  for (let frame = 0; frame < 16; frame++) {
    if (texture.has(String(frame))) continue;
    const region = ART_REGIONS[frame];
    const x = Math.round(region[0] * width / 1254), y = Math.round(region[1] * height / 1254);
    const w = Math.round((region[0] + region[2]) * width / 1254) - x;
    const h = Math.round((region[1] + region[3]) * height / 1254) - y;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    let left = w, right = -1, top = h, bottom = -1;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      if (pixels[(py * w + px) * 4 + 3] < 12) continue;
      left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
    }
    if (right < left) texture.add(String(frame), 0, x, y, w, h);
    else texture.add(String(frame), 0, x + left, y + top, right - left + 1, bottom - top + 1);
  }
  return true;
}

export const COURTYARD_FIRES = [
  { x: 225, y: 96, scale: 1.2 }, { x: 735, y: 96, scale: 1.2 },
  { x: 225, y: 440, scale: 1.2 }, { x: 735, y: 440, scale: 1.2 },
  { x: 400, y: 150, scale: 1.1 }, { x: 560, y: 390, scale: 1.1 },
  { x: 108, y: 400, scale: 1 }, { x: 55, y: 135, scale: 1 },
  { x: 905, y: 145, scale: 1 }, { x: 925, y: 300, scale: 1 },
] as const;

/** Hand-composed courtyard artwork. Geometry and actor state are read-only inputs. */
export class CourtyardEnvironment {
  readonly surfaces: Phaser.GameObjects.RenderTexture[] = [];
  readonly windPoints: { x: number; y: number }[] = [];
  private architecture: { surface: Phaser.GameObjects.RenderTexture; wall: Rect }[] = [];
  private reduced = new Map<string, HTMLCanvasElement>();
  private materials: HTMLCanvasElement[] = [];
  private source: CanvasImageSource;
  private destroyed = false;

  constructor(private scene: Phaser.Scene, map: MapDefinition) {
    if (!ensureCourtyardFrames(scene)) throw new Error('Courtyard art and terrain atlas must be preloaded');
    this.source = scene.textures.get(ART).getSourceImage() as CanvasImageSource;
    const terrain = scene.textures.get(TERRAIN), terrainSource = terrain.getSourceImage() as CanvasImageSource;
    const tw = terrain.source[0].width, th = terrain.source[0].height;
    for (let frame = 0; frame < 16; frame++) {
      const tile = document.createElement('canvas'); tile.width = tile.height = 80;
      const ctx = tile.getContext('2d')!; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const col = frame % 4, row = Math.floor(frame / 4), x = Math.round(col * tw / 4), y = Math.round(row * th / 4);
      ctx.drawImage(terrainSource, x, y, Math.round((col + 1) * tw / 4) - x,
        Math.round((row + 1) * th / 4) - y, 0, 0, 80, 80);
      this.materials.push(tile);
    }
    this.bake(0, 0, 960, 540, 0, ctx => this.paintGround(ctx, map));
    for (const wall of map.walls) {
      const surface = this.bake(wall.x, wall.y - 18, wall.w, wall.h + 18,
        10 + Math.floor((wall.y + wall.h) / 2) / 100000, ctx => {
          // A complete authored perspective object, not a flat material-filled rectangle.
          this.wallSprite(ctx, wall.w > wall.h ? 1 : 0, 0, 0, wall.w, wall.h + 18, 14, wall.x > 480);
          if (wall.w > wall.h) {
            this.stamp(ctx, 7, 5, wall.h - 8, 40, 27);
          } else {
            this.stamp(ctx, 7, wall.w - 21, wall.h - 20, 23, 34, wall.x > 480);
            this.stamp(ctx, 5, 3, wall.h - 1, 29, 18);
          }
        });
      this.architecture.push({ surface, wall });
    }
    this.materials.length = 0; this.reduced.clear();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private bake(x: number, y: number, w: number, h: number, depth: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    const key = `courtyard-composite-${++serial}`;
    const texture = this.scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
    if (!texture) throw new Error('Unable to create courtyard receiving texture');
    const ctx = texture.context; ctx.imageSmoothingEnabled = false; paint(ctx); texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const image = this.scene.make.image({ key }, false).setOrigin(0);
    const surface = this.scene.add.renderTexture(x, y, w, h).setOrigin(0).setDepth(depth);
    surface.draw(image, 0, 0); image.destroy(); this.scene.textures.remove(key);
    this.surfaces.push(surface); return surface;
  }

  private stamp(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, w: number, h: number, flip = false, alpha = 1) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const key = `${frame}:${w}:${h}`;
    let canvas = this.reduced.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const target = canvas.getContext('2d')!; target.imageSmoothingEnabled = true; target.imageSmoothingQuality = 'high';
      const crop = this.scene.textures.get(ART).get(String(frame));
      target.drawImage(this.source, crop.cutX, crop.cutY, crop.cutWidth, crop.cutHeight, 0, 0, w, h);
      this.reduced.set(key, canvas);
    }
    ctx.save(); ctx.globalAlpha = alpha;
    if (flip) { ctx.translate(Math.round(x + w), Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(canvas, 0, 0); }
    else ctx.drawImage(canvas, Math.round(x), Math.round(y));
    ctx.restore();
  }

  /** Reconstruct the reference's broad cap and shallow front from the authored perspective asset. */
  private wallSprite(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number,
    w: number, h: number, face: number, flip = false) {
    const key = `wall:${frame}:${w}:${h}:${face}`;
    let canvas = this.reduced.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const target = canvas.getContext('2d')!; target.imageSmoothingEnabled = true; target.imageSmoothingQuality = 'high';
      const crop = this.scene.textures.get(ART).get(String(frame));
      const cut = Math.round(crop.cutHeight * (frame === 0 || frame === 3 ? .60 : .37));
      if (frame === 0) {
        // Trim the exaggerated perspective side from the cap; retain a narrow authored side plane.
        const source = this.scene.textures.get(ART).source[0], sx = source.width / 1254, sy = source.height / 1254;
        target.drawImage(this.source, 76 * sx, 34 * sy, 96 * sx, 195 * sy, 0, 0, w - 4, h - face);
        target.drawImage(this.source, 172 * sx, 34 * sy, 21 * sx, 195 * sy, w - 4, 0, 4, h - face);
      } else if (frame === 1) {
        const first = Math.floor((h - face) / 2);
        const source = this.scene.textures.get(ART).source[0], sx = source.width / 1254, sy = source.height / 1254;
        // Select only the blue stone cap, excluding the donor's dark vertical front band.
        target.drawImage(this.source, 280 * sx, 154 * sy, 250 * sx, 50 * sy, 0, 0, w, first);
        target.save(); target.translate(w, first); target.scale(-1, 1);
        target.drawImage(this.source, 280 * sx, 154 * sy, 250 * sx, 50 * sy, 0, 0, w, h - face - first);
        target.restore();
      } else target.drawImage(this.source, crop.cutX, crop.cutY, crop.cutWidth, cut, 0, 0, w, h - face);
      target.drawImage(this.source, crop.cutX, crop.cutY + cut, crop.cutWidth, crop.cutHeight - cut, 0, h - face, w, face);
      target.globalCompositeOperation = 'source-atop';
      target.fillStyle = 'rgba(12,23,43,.22)'; target.fillRect(0, 0, w, h);
      target.globalCompositeOperation = 'source-over';
      this.reduced.set(key, canvas);
    }
    ctx.save();
    if (flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(canvas, 0, 0); }
    else ctx.drawImage(canvas, x, y);
    ctx.restore();
  }

  private material(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, w: number, h: number, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = ctx.createPattern(this.materials[frame], 'repeat')!;
    ctx.fillRect(x, y, w, h); ctx.restore();
  }

  private clearing(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, frame: number, alpha: number) {
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const angle = i * Math.PI / 10, wobble = .88 + Math.sin(i * 2.4 + x) * .09;
      const px = Math.round(x + Math.cos(angle) * rx * wobble), py = Math.round(y + Math.sin(angle) * ry * wobble);
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.clip(); this.material(ctx, frame, x - rx, y - ry, rx * 2, ry * 2, alpha); ctx.restore();
  }

  private paintGround(ctx: CanvasRenderingContext2D, map: MapDefinition) {
    ctx.fillStyle = '#24372e'; ctx.fillRect(0, 0, 960, 540);
    this.material(ctx, 0, 0, 0, 960, 540, .08);
    // Explicitly placed low-contrast ground masses, never a scattering grid.
    for (const [x, y, rx, ry, frame, alpha] of [
      [151, 138, 126, 91, 2, .18], [386, 68, 149, 69, 15, .13], [596, 123, 107, 92, 2, .14],
      [814, 179, 110, 100, 15, .16], [143, 424, 133, 85, 2, .17], [422, 440, 134, 78, 15, .13],
      [650, 458, 134, 81, 2, .17], [845, 404, 105, 106, 15, .13],
    ]) this.clearing(ctx, x, y, rx, ry, frame, alpha);

    // Preserve the main route and side approaches; stone scale is authored at about24px per block.
    this.material(ctx, 3, 20, 230, 920, 80, .4);
    this.material(ctx, 4, 20, 234, 920, 72, .92);
    for (const [x, width] of [[86, 94], [353, 79], [558, 84], [808, 97]]) {
      this.material(ctx, 7, x, 234, width, 72, .25);
    }
    ctx.fillStyle = 'rgba(178,158,123,.085)'; ctx.fillRect(20, 234, 920, 72);
    for (const x of [130, 800]) {
      this.material(ctx, 2, x - 6, 52, 40, 438, .22);
      this.material(ctx, 5, x, 52, 28, 438, .45);
    }
    for (const x of [145, 815]) this.clearing(ctx, x, 270, 42, 34, 6, .4);
    this.clearing(ctx, 480, 270, 67, 47, 6, .22);
    // A faint engraved stone crest, not a luminous ability indicator.
    ctx.save(); ctx.beginPath(); ctx.arc(480, 270, 61, 0, Math.PI * 2); ctx.arc(480, 270, 58, 0, Math.PI * 2, true);
    ctx.clip('evenodd'); this.material(ctx, 9, 416, 206, 128, 128, .30); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(480, 247); ctx.lineTo(495, 270); ctx.lineTo(480, 293); ctx.lineTo(465, 270);
    ctx.closePath(); ctx.clip(); this.material(ctx, 9, 464, 246, 32, 48, .19); ctx.restore();
    for (const fire of COURTYARD_FIRES) {
      this.clearing(ctx, fire.x, fire.y + 12, 39, 28, 3, .27);
    }
    this.clearing(ctx, 404, 187, 47, 38, 3, .2);
    this.clearing(ctx, 558, 355, 46, 41, 3, .21);

    // Authored boundary masonry modules stay within the existing20px physical border.
    for (let x = 0; x < 960; x += 96) {
      this.wallSprite(ctx, 2, x, 0, 96, 20, 3); this.wallSprite(ctx, 2, x, 520, 96, 20, 3, true);
    }
    for (let y = 20; y < 520; y += 100) {
      this.wallSprite(ctx, 3, 0, y, 20, 100, 4); this.wallSprite(ctx, 3, 940, y, 20, 100, 4, true);
    }

    // Deliberate asymmetric ecological clusters around a symmetric competitive layout.
    const plants: Placement[] = [
      [4, -24, -15, 94, 68], [4, 31, -13, 94, 66], [4, 91, -20, 83, 61],
      [5, 136, -5, 73, 43], [4, 232, -24, 92, 70], [4, 296, -16, 88, 61],
      [4, 369, -22, 82, 63], [4, 482, -17, 91, 63], [5, 554, -9, 72, 45],
      [4, 654, -17, 97, 66], [4, 720, -20, 90, 64], [4, 816, -18, 99, 68],
      [4, 887, -8, 93, 66], [4, -29, 41, 76, 64], [4, -35, 91, 72, 61],
      [4, -31, 157, 71, 65], [4, -32, 341, 77, 67], [4, -26, 409, 82, 64],
      [4, 919, 53, 74, 65], [4, 928, 105, 72, 64], [4, 924, 183, 76, 65],
      [4, 929, 351, 71, 68], [4, 912, 417, 81, 65],
      [4, -19, 482, 99, 68], [4, 47, 490, 89, 66], [4, 154, 499, 84, 59],
      [4, 237, 488, 92, 69], [4, 312, 498, 90, 59], [5, 397, 499, 81, 45],
      [4, 489, 492, 87, 65], [4, 567, 496, 96, 62], [4, 679, 491, 91, 66],
      [4, 760, 496, 95, 62], [4, 838, 489, 94, 68], [4, 899, 479, 86, 73],
      [4, 14, 13, 69, 42], [6, 65, 17, 48, 35], [5, 101, 10, 53, 29],
      [4, 164, 14, 58, 34], [6, 204, 19, 36, 32], [4, 273, 5, 73, 39],
      [5, 349, 13, 49, 28], [6, 433, 14, 34, 31], [4, 532, 7, 59, 37],
      [5, 607, 13, 61, 27], [4, 701, 7, 78, 35], [6, 776, 18, 39, 30],
      [4, 864, 11, 74, 43], [5, 898, 51, 43, 29],
      [6, 17, 70, 35, 53], [4, 14, 175, 43, 56], [5, 22, 206, 37, 25],
      [4, 894, 187, 48, 39], [6, 914, 226, 28, 33], [5, 919, 343, 26, 36],
      [6, 13, 331, 37, 45], [4, 18, 450, 67, 45], [5, 45, 426, 43, 30],
      [4, 879, 432, 67, 50], [6, 912, 389, 31, 44],
      [4, 58, 499, 73, 34], [6, 145, 484, 42, 44], [5, 208, 504, 59, 27],
      [4, 280, 494, 66, 36], [6, 367, 500, 35, 30], [5, 429, 503, 62, 27],
      [4, 524, 494, 63, 36], [6, 597, 501, 42, 26], [5, 673, 501, 49, 28],
      [4, 774, 494, 74, 36], [6, 855, 496, 32, 35],
      [5, 192, 120, 36, 22], [6, 307, 160, 30, 37], [4, 302, 184, 40, 24],
      [5, 606, 112, 36, 25], [6, 718, 181, 33, 32],
      [4, 302, 406, 45, 26], [6, 194, 374, 31, 37], [5, 609, 414, 38, 23],
      [6, 719, 364, 32, 39], [5, 459, 206, 37, 19], [6, 479, 381, 33, 27],
      [4, 207, 174, 38, 28], [6, 225, 185, 31, 35], [5, 303, 117, 34, 25],
      [6, 298, 138, 32, 35], [4, 319, 188, 39, 27], [5, 204, 336, 37, 27],
      [4, 209, 395, 40, 28], [6, 303, 363, 34, 39], [5, 323, 404, 34, 27],
      [4, 626, 121, 37, 28], [6, 629, 160, 31, 37], [5, 716, 128, 36, 29],
      [4, 710, 195, 41, 29], [5, 629, 349, 34, 29], [6, 630, 389, 31, 36],
      [4, 711, 389, 43, 31], [6, 544, 182, 34, 29], [5, 387, 170, 32, 27],
      [4, 400, 365, 39, 29], [6, 542, 350, 32, 34],
    ];
    for (const [frame, x, y, w, h, flip] of plants) {
      const center = x + w / 2;
      if ((y < 42 || y > 480) && [[150, 220], [400, 450], [570, 650], [800, 850]].some(([a, b]) => center > a && center < b)) continue;
      this.stamp(ctx, frame, x, y, w, h, flip);
      if (frame === 5 || frame === 6) this.windPoints.push({ x: x + w / 2, y: y + h - 3 });
    }
    const accents: Placement[] = [
      [12, 83, 27, 24, 23], [13, 179, 31, 22, 20], [12, 746, 28, 25, 23],
      [13, 882, 83, 24, 24], [12, 30, 189, 24, 23], [13, 900, 218, 22, 23],
      [12, 77, 480, 28, 26], [13, 333, 495, 23, 22], [12, 579, 492, 23, 26],
      [13, 818, 486, 25, 24], [12, 310, 203, 22, 20], [13, 704, 407, 21, 22],
      [12, 230, 121, 23, 22], [13, 270, 213, 20, 19],
      [11, 78, 69, 25, 21], [11, 857, 92, 28, 24], [11, 890, 469, 27, 22],
      [11, 345, 459, 23, 18], [11, 596, 65, 21, 17],
      [11, 609, 184, 34, 27], [11, 310, 407, 34, 27],
      [12, 198, 165, 22, 21], [13, 336, 202, 23, 21], [12, 622, 205, 21, 20],
      [13, 721, 347, 21, 21], [12, 310, 350, 22, 20], [12, 403, 397, 23, 20],
      [5, 343, 96, 17, 12], [12, 424, 99, 15, 14], [5, 517, 95, 17, 12],
      [13, 569, 150, 15, 14], [6, 357, 147, 16, 17], [5, 378, 119, 18, 13],
      [12, 467, 78, 13, 12], [6, 587, 94, 14, 17], [13, 757, 160, 14, 13],
      [5, 837, 195, 19, 12], [12, 190, 190, 13, 13], [5, 357, 212, 18, 12],
      [6, 591, 213, 14, 17], [13, 376, 416, 15, 14], [5, 462, 440, 18, 12],
      [12, 581, 434, 16, 14], [5, 673, 455, 18, 12], [6, 375, 360, 16, 19],
      [5, 436, 392, 17, 11], [13, 514, 416, 14, 12], [6, 591, 388, 14, 17],
      [12, 787, 403, 14, 12], [5, 820, 369, 18, 12], [13, 159, 367, 14, 13],
      [6, 177, 431, 16, 19], [5, 365, 463, 19, 12], [12, 549, 467, 14, 12],
      [5, 721, 475, 18, 11], [13, 325, 313, 13, 12], [5, 607, 313, 16, 11],
    ];
    for (const [frame, x, y, w, h, flip] of accents) {
      this.stamp(ctx, frame, x, y, w, h, flip);
      if (frame === 5 || frame === 6) this.windPoints.push({ x: x + w / 2, y: y + h - 2 });
    }
    // Ground props flank existing routes; they remain cosmetic and non-collidable.
    this.stamp(ctx, 9, 74, 96, 28, 28); this.stamp(ctx, 9, 851, 96, 28, 28, true);
    this.stamp(ctx, 10, 63, 325, 24, 30); this.stamp(ctx, 10, 883, 325, 24, 30);
    for (const wall of map.walls) {
      const count = Math.max(3, Math.ceil(wall.w / 24));
      for (let i = 0; i < count; i++) {
        const size = 18 + (i * 3 + wall.x) % 8;
        const x = wall.x - 7 + i * (wall.w + 2) / count, y = wall.y + wall.h - 7 + i % 3;
        this.stamp(ctx, i % 3 === 1 ? 6 : 5, x, y, size, 14 + i % 4, i % 2 === 0, .9);
        this.windPoints.push({ x: x + size / 2, y: y + 12 });
      }
    }
    this.stamp(ctx, 14, 14, 185, 28, 55);
    this.stamp(ctx, 15, 918, 185, 28, 55);
    for (const fire of COURTYARD_FIRES) this.stamp(ctx, 8, fire.x - 14, fire.y - 4, 28, 35);
  }

  update(_time: number, delta: number, actors: readonly Actor[] = []) {
    if (this.destroyed) return;
    for (const { surface, wall } of this.architecture) {
      const behind = actors.some(a => a.x > wall.x - 10 && a.x < wall.x + wall.w + 10 && a.y > wall.y - 22 && a.y < wall.y + 7);
      surface.setAlpha(Phaser.Math.Linear(surface.alpha, behind ? .45 : 1, Math.min(1, Math.max(0, delta) / 90)));
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const surface of this.surfaces) if (surface.scene) surface.destroy();
    this.surfaces.length = this.architecture.length = this.materials.length = this.windPoints.length = 0; this.reduced.clear();
  }
}
