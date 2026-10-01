import Phaser from 'phaser';

type Rect = { x: number; y: number; w: number; h: number };
export type EnvironmentSpec = {
  width: number;
  height: number;
  theme: string;
  walls: readonly Rect[];
  arena: boolean;
};

/** Original, deterministic surface art. It never owns collision or gameplay objects. */
const PALETTES = {
  stone: { stone: 0x81897a, light: 0xc0bc99, dark: 0x17272b, moss: 0x63805a, leaf: 0x989269 },
  forest: { stone: 0x758270, light: 0xb8bc8a, dark: 0x10251e, moss: 0x568257, leaf: 0xb49958 },
  ruins: { stone: 0x7e7b78, light: 0xbcb1a1, dark: 0x22232a, moss: 0x6c775b, leaf: 0x9f8561 },
  crossroads: { stone: 0x828876, light: 0xc6bd93, dark: 0x1b292b, moss: 0x69805c, leaf: 0xaf945f },
};
const CHUNK = 512;
let generation = 0;
const hash = (x: number, y: number, salt: number) =>
  ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(salt, 83492791)) >>> 0);

/**
 * Bake small clipped chunks once, then flatten them into the map with bakeInto. Drawing with integer
 * rectangles and nearest sampling preserves the same authored pixel size in Canvas and WebGL.
 * The existing ground/props stay authoritative: world decoration is limited to contact shadows.
 */
export function decorateEnvironment(scene: Phaser.Scene, spec: EnvironmentSpec): {
  destroy(): void;
  update(time: number, delta: number): void;
  bakeInto(targets: readonly Phaser.GameObjects.RenderTexture[]): void;
} {
  const images: Phaser.GameObjects.Image[] = [];
  const keys: string[] = [];
  const prefix = `environment-${++generation}`;
  const family = spec.theme === 'bosque' ? 'forest'
    : ['ceniza', 'ruinas', 'cripta'].includes(spec.theme) ? 'ruins'
      : spec.theme === 'forest' || spec.theme === 'ruins' || spec.theme === 'crossroads' ? spec.theme : 'stone';
  const colors = PALETTES[family];
  let destroyed = false;

  for (let cy = 0; cy < spec.height; cy += CHUNK) {
    for (let cx = 0; cx < spec.width; cx += CHUNK) {
      const width = Math.min(CHUNK, spec.width - cx);
      const height = Math.min(CHUNK, spec.height - cy);
      const g = scene.make.graphics({}, false);
      let painted = false;
      // Clip each primitive explicitly; this prevents dark seams at chunk edges and avoids a
      // giant intermediate canvas for world zones. Coordinates remain in world space until here.
      const rect = (x: number, y: number, w: number, h: number, color: number, alpha: number) => {
        const left = Math.max(cx, Math.round(x));
        const top = Math.max(cy, Math.round(y));
        const right = Math.min(cx + width, Math.round(x + w));
        const bottom = Math.min(cy + height, Math.round(y + h));
        if (right <= left || bottom <= top) return;
        g.fillStyle(color, alpha).fillRect(left - cx, top - cy, right - left, bottom - top);
        painted = true;
      };

      if (spec.arena) {
        // Cluster fine wear into irregular islands; keep the main fight lane, home columns and
        // central objective clean. Scatter is coordinate-hashed and never consumes game RNG.
        for (let y = Math.ceil(Math.max(32, cy - 24) / 24) * 24; y < Math.min(spec.height - 28, cy + height + 4); y += 24) {
          for (let x = Math.ceil(Math.max(32, cx - 24) / 24) * 24; x < Math.min(spec.width - 28, cx + width + 4); x += 24) {
            const n = hash(x, y, 29);
            const px = x + n % 11;
            const py = y + (n >>> 5) % 9;
            if (Math.abs(py - spec.height / 2) < 55 || Math.abs(px - 145) < 30 || Math.abs(px - (spec.width - 145)) < 30) continue;
            if (spec.walls.some(w => px > w.x - 16 && px < w.x + w.w + 16 && py > w.y - 16 && py < w.y + w.h + 16)) continue;
            if (hash(Math.floor(x / 96), Math.floor(y / 96), 7) % 5 === 0 || n % 4 === 0) continue;
            // Soft stepped moss/dust beds read as surface discoloration, never cover.
            rect(px - 2, py, 14, 4, colors.moss, 0.14);
            rect(px + 2, py - 2, 8, 8, colors.moss, 0.1);
            if (family === 'forest') {
              rect(px + 1, py + 1, 4, 2, colors.leaf, 0.38);
              rect(px + 4, py, 2, 2, colors.leaf, 0.26);
              rect(px + 9, py + 6, 3, 1, colors.light, 0.2);
            } else {
              rect(px, py, 7 + n % 6, 1, colors.dark, 0.42);
              rect(px + 5, py + 1, 1, 4, colors.dark, 0.34);
              rect(px, py - 1, 5, 1, colors.light, 0.18);
              rect(px + 10, py + 7, 3, 2, colors.stone, 0.34);
            }
          }
        }
      }

      for (const wall of spec.walls) {
        const { x, y, w, h } = wall;
        if (x > cx + width || x + w + 8 < cx || y > cy + height || y + h + 8 < cy || w < 4 || h < 4) continue;
        // Layered contact falloff stays within eight pixels of the authoritative footprint.
        // Existing trees/roofs are baked into the ground, so never repaint their top surfaces.
        rect(x + 3, y + h, w, 7, colors.dark, 0.08);
        rect(x + 2, y + h, w, 4, colors.dark, 0.15);
        rect(x + 1, y + h, w, 2, colors.dark, 0.26);
        rect(x + w, y + 4, 3, h - 2, colors.dark, 0.15);
        if (!spec.arena) continue;
        // Cap and recessed front face live INSIDE the wall, keeping its collision edge legible.
        const face = Math.min(12, Math.floor(h / 3));
        rect(x + 1, y + h - face, w - 2, face - 1, colors.dark, 0.74);
        rect(x + 2, y + h - face, w - 4, 2, colors.light, 0.65);
        rect(x + 2, y + 2, w - 4, 2, colors.light, 0.53);
        rect(x + 2, y + 4, 2, h - face - 4, colors.light, 0.22);
        rect(x + w - 3, y + 4, 2, h - face - 4, colors.dark, 0.5);
        for (let bx = x + 10; bx < x + w - 4; bx += 22) {
          rect(bx, y + h - face + 3, 1, face - 4, colors.stone, 0.42);
          rect(bx + 1, y + h - face + 3, Math.min(10, x + w - bx - 2), 1, colors.stone, 0.18);
        }
        // Broken moss seams on the cap, intentionally duller than any team or ability color.
        for (let bx = x + 5; bx < x + w - 8; bx += 18) {
          const n = hash(bx, y, 19);
          if (n % 3) continue;
          rect(bx, y + 5, 7, 2, colors.moss, 0.57);
          rect(bx + 3, y + 7, 3, 2, colors.moss, 0.35);
        }
      }
      if (painted) {
        const key = `${prefix}-${cx}-${cy}`;
        g.generateTexture(key, width, height);
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
        keys.push(key);
        images.push(scene.add.image(cx, cy, key).setOrigin(0, 0).setDepth(0.2));
      }
      g.destroy();
    }
  }

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, destroy);
    for (const image of images) image.destroy();
    for (const key of keys) scene.textures.remove(key);
    images.length = 0;
    keys.length = 0;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  return {
    destroy,
    update: (_time: number, _delta: number) => { /* All art is static and baked. */ },
    bakeInto(targets) {
      if (destroyed) return;
      for (const target of targets) {
        for (const image of images) {
          if (image.x >= target.x + target.width || image.x + image.width <= target.x ||
              image.y >= target.y + target.height || image.y + image.height <= target.y) continue;
          target.draw(image, image.x - target.x, image.y - target.y);
        }
      }
      // Flatten once: no extra translucent map-sized layers or retained source textures.
      destroy();
    },
  };
}
