import Phaser from 'phaser';
import type { Vec } from '@bandera/shared';
import type { Prop, ZoneDefinition } from '@bandera/shared/rpg/zones';
import { palette } from './art';

/**
 * Settlements, drawn the way a Warcraft III human town reads from above: plastered walls under
 * timber, steep shingled roofs in the kingdom's colours, a palisade of sharpened logs with a
 * watchtower on every corner, farms past the gate — and in the square, the altar every character
 * is born next to. Everything static is painted into the zone's baked ground; only the fire, the
 * altar's glow and the villagers move.
 */

type G = Phaser.GameObjects.Graphics;

const hex = (color: string) => parseInt(color.slice(1), 16);
const shade = (color: number, amount: number) => {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return amount >= 0 ? c.lighten(amount * 100).color : c.darken(-amount * 100).color;
};

/** A timber house seen from above and a little in front: roof on top, the front wall below it. */
function house(g: G, p: Prop, roofColor: number, options: { chimney?: boolean; door?: 'single' | 'double'; plaster?: number } = {}) {
  const { x, y, w, h } = p;
  const wallH = Math.round(h * 0.38);
  const roofH = h - wallH;
  g.fillStyle(0x000000, 0.28);
  g.fillRoundedRect(x + 10, y + 14, w, h, 6);
  // Front wall: plaster between dark beams, a stone footing.
  const plaster = options.plaster ?? 0xe6d6b0;
  g.fillStyle(plaster);
  g.fillRect(x + 4, y + roofH, w - 8, wallH);
  g.fillStyle(0x7a7468);
  g.fillRect(x + 4, y + h - 7, w - 8, 7);
  g.fillStyle(0x5a3a22);
  for (let bx = x + 4; bx <= x + w - 8; bx += Math.max(22, (w - 8) / 4)) g.fillRect(bx, y + roofH, 4, wallH - 7);
  g.fillRect(x + 4, y + roofH, w - 8, 4);
  // Door and windows.
  const doorW = options.door === 'double' ? Math.min(34, w * 0.3) : Math.min(18, w * 0.18);
  g.fillStyle(0x3b2414);
  g.fillRoundedRect(x + w / 2 - doorW / 2, y + h - 7 - wallH * 0.62, doorW, wallH * 0.62, { tl: 6, tr: 6, bl: 0, br: 0 });
  g.fillStyle(0xc9a060, 0.9);
  g.fillCircle(x + w / 2 + doorW / 2 - 4, y + h - 7 - wallH * 0.3, 1.6);
  for (const wx of [x + w * 0.2, x + w * 0.8]) {
    g.fillStyle(0x2c3440);
    g.fillRect(wx - 6, y + roofH + wallH * 0.25, 12, 10);
    g.fillStyle(0xffd27a, 0.55);
    g.fillRect(wx - 5, y + roofH + wallH * 0.25 + 1, 10, 8);
    g.fillStyle(0x5a3a22);
    g.fillRect(wx - 1, y + roofH + wallH * 0.25, 2, 10);
  }
  // Roof: overhanging, shingle rows, a lit ridge and a dark lower edge.
  const over = 6;
  g.fillStyle(shade(roofColor, -0.35));
  g.fillRoundedRect(x - over, y - 2, w + over * 2, roofH + 6, 5);
  g.fillStyle(roofColor);
  g.fillRoundedRect(x - over, y - 2, w + over * 2, roofH, 5);
  for (let row = y + 8; row < y + roofH - 4; row += 9) {
    g.fillStyle(shade(roofColor, -0.18), 0.8);
    g.fillRect(x - over + 3, row, w + over * 2 - 6, 2);
    for (let sx = x - over + ((row - y) % 18 ? 6 : 12); sx < x + w + over - 4; sx += 12) g.fillRect(sx, row - 7, 2, 7);
  }
  g.fillStyle(shade(roofColor, 0.35));
  g.fillRect(x - over + 2, y + roofH * 0.42, w + over * 2 - 4, 4);
  g.fillStyle(shade(roofColor, 0.55), 0.6);
  g.fillRect(x - over + 2, y - 2, w + over * 2 - 4, 3);
  if (options.chimney) {
    g.fillStyle(0x6b6358);
    g.fillRect(x + w * 0.72, y - 10, 14, 22);
    g.fillStyle(0x4a443c);
    g.fillRect(x + w * 0.72, y - 10, 14, 4);
  }
}

function banner(g: G, x: number, y: number, h: number, color: number) {
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(x + 6, y + h + 2, 16, 6);
  g.fillStyle(0x4a3220);
  g.fillRect(x, y, 4, h);
  g.fillStyle(0xd8b050);
  g.fillCircle(x + 2, y - 2, 3);
  g.fillStyle(color);
  g.fillPoints([{ x: x + 4, y: y + 4 }, { x: x + 20, y: y + 4 }, { x: x + 20, y: y + 30 }, { x: x + 12, y: y + 24 }, { x: x + 4, y: y + 30 }], true);
  g.fillStyle(0xf0d070);
  g.fillCircle(x + 12, y + 14, 4);
}

function palisade(g: G, p: Prop) {
  const { x, y, w, h } = p;
  const horizontal = w >= h;
  g.fillStyle(0x000000, 0.3);
  g.fillRect(x + 6, y + 10, w, h);
  const step = 13;
  const length = horizontal ? w : h;
  for (let d = 0; d < length; d += step) {
    const lx = horizontal ? x + d : x;
    const ly = horizontal ? y : y + d;
    const lw = horizontal ? step - 1 : w;
    const lh = horizontal ? h : step - 1;
    g.fillStyle(d % (step * 3) ? 0x8a5f36 : 0x7a5230);
    g.fillRect(lx, ly, lw, lh);
    g.fillStyle(0xb8864e, 0.8);
    if (horizontal) g.fillRect(lx + 2, ly + 2, 3, lh - 6);
    else g.fillRect(lx + 2, ly + 2, lw - 6, 3);
    // Sharpened tips, pale where the axe cut them.
    g.fillStyle(0xd9b98a);
    if (horizontal) g.fillTriangle(lx, ly, lx + lw, ly, lx + lw / 2, ly - 7);
    else g.fillTriangle(lx, ly, lx, ly + lh, lx - 7, ly + lh / 2);
  }
  // Two binding ropes.
  g.fillStyle(0x3b2a18, 0.8);
  if (horizontal) {
    g.fillRect(x, y + h * 0.3, w, 2);
    g.fillRect(x, y + h * 0.7, w, 2);
  } else {
    g.fillRect(x + w * 0.3, y, 2, h);
    g.fillRect(x + w * 0.7, y, 2, h);
  }
}

function gate(g: G, p: Prop) {
  const { x, y, w, h } = p;
  const horizontal = w >= h;
  // Planks on the ground where the carts pass, and the two heavy posts with the doors swung open.
  g.fillStyle(0x6b4a2c, 0.55);
  g.fillRect(x, y, w, h);
  g.fillStyle(0x3b2a18, 0.4);
  for (let d = 6; d < (horizontal ? w : h); d += 14) {
    if (horizontal) g.fillRect(x + d, y + 2, 2, h - 4);
    else g.fillRect(x + 2, y + d, w - 4, 2);
  }
  const posts = horizontal
    ? [{ x: x - 10, y: y - 14 }, { x: x + w - 10, y: y - 14 }]
    : [{ x: x - 4, y: y - 16 }, { x: x - 4, y: y + h - 14 }];
  for (const post of posts) {
    g.fillStyle(0x000000, 0.3);
    g.fillRect(post.x + 6, post.y + 8, 24, 34);
    g.fillStyle(0x5a3a22);
    g.fillRect(post.x, post.y, 22, 32);
    g.fillStyle(0x8a6a44);
    g.fillRect(post.x + 3, post.y + 3, 16, 5);
    g.fillStyle(0xd8b050);
    g.fillCircle(post.x + 11, post.y + 18, 3);
  }
}

function tower(g: G, p: Prop) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const r = p.w / 2;
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(cx + 10, cy + 16, r * 2.3, r * 1.4);
  g.fillStyle(0x6f6a60);
  g.fillCircle(cx, cy, r);
  g.fillStyle(0x8c877b);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) g.fillCircle(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6), 5);
  // Conical roof in the kingdom's blue, and its pennant.
  g.fillStyle(0x2b4f9c);
  g.fillCircle(cx, cy - 6, r * 0.82);
  g.fillStyle(0x3f6fd0);
  g.fillTriangle(cx - r * 0.82, cy - 6, cx, cy - 6 - r * 0.82, cx, cy - 6 + r * 0.82);
  g.fillStyle(0x5a8ae8, 0.6);
  g.fillCircle(cx - r * 0.25, cy - r * 0.35, r * 0.25);
  g.fillStyle(0x4a3220);
  g.fillRect(cx - 1, cy - 6 - r - 16, 3, 18);
  g.fillStyle(0xf0d070);
  g.fillTriangle(cx + 2, cy - 6 - r - 16, cx + 16, cy - 6 - r - 11, cx + 2, cy - 6 - r - 6);
}

function field(g: G, p: Prop) {
  const { x, y, w, h } = p;
  g.fillStyle(0x6b4a2c);
  g.fillRoundedRect(x, y, w, h, 6);
  for (let row = y + 10; row < y + h - 6; row += 16) {
    g.fillStyle(0x503620);
    g.fillRect(x + 6, row + 6, w - 12, 4);
    for (let cx = x + 14; cx < x + w - 10; cx += 18) {
      g.fillStyle(0x6f9a3a);
      g.fillCircle(cx, row + 4, 5);
      g.fillStyle(0xd8c060, 0.9);
      g.fillCircle(cx + 1, row + 2, 2);
    }
  }
  // A low fence of posts and rails around it.
  g.lineStyle(3, 0x8a6a44);
  g.strokeRoundedRect(x - 6, y - 6, w + 12, h + 12, 8);
  g.fillStyle(0x5a3a22);
  for (let px = x - 6; px <= x + w + 6; px += 30) {
    g.fillRect(px - 2, y - 10, 5, 9);
    g.fillRect(px - 2, y + h + 2, 5, 9);
  }
}

function well(g: G, p: Prop) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 6, cy + 8, p.w + 8, p.h * 0.7);
  g.fillStyle(0x8c877b);
  g.fillCircle(cx, cy, p.w / 2);
  g.fillStyle(0x3a6a9a);
  g.fillCircle(cx, cy, p.w / 2 - 7);
  g.fillStyle(0x9fd8ff, 0.5);
  g.fillCircle(cx - 3, cy - 3, 4);
  g.fillStyle(0x5a3a22);
  g.fillRect(cx - p.w / 2 - 2, cy - 4, p.w + 4, 5);
  g.fillStyle(0xb8433a);
  g.fillTriangle(cx - p.w / 2 - 6, cy - 6, cx + p.w / 2 + 6, cy - 6, cx, cy - p.w / 2 - 10);
}

function campfire(g: G, p: Prop) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  g.fillStyle(0x000000, 0.25);
  g.fillCircle(cx + 3, cy + 5, 20);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
    g.fillStyle(0x7a7468);
    g.fillCircle(cx + Math.cos(a) * 16, cy + Math.sin(a) * 12, 5);
  }
  g.fillStyle(0x2a1a10);
  g.fillCircle(cx, cy, 10);
  g.lineStyle(5, 0x5a3a22);
  g.lineBetween(cx - 10, cy - 5, cx + 10, cy + 5);
  g.lineBetween(cx - 10, cy + 5, cx + 10, cy - 5);
  // Benches around it.
  g.fillStyle(0x8a6a44);
  g.fillRect(cx - 34, cy + 22, 24, 7);
  g.fillRect(cx + 12, cy + 22, 24, 7);
}

function cart(g: G, p: Prop) {
  const { x, y, w, h } = p;
  g.fillStyle(0x000000, 0.25);
  g.fillRect(x + 5, y + 8, w, h);
  g.fillStyle(0x8a5f36);
  g.fillRect(x, y, w, h * 0.7);
  g.fillStyle(0xd8c060);
  g.fillRoundedRect(x + 4, y - 6, w - 8, h * 0.55, 8);
  g.fillStyle(0xb8a040, 0.8);
  for (let i = 0; i < 5; i++) g.fillRect(x + 8 + i * (w - 16) / 5, y - 4, 2, h * 0.4);
  g.fillStyle(0x3b2a18);
  g.fillCircle(x + 10, y + h * 0.78, 8);
  g.fillCircle(x + w - 10, y + h * 0.78, 8);
  g.fillStyle(0x8a6a44);
  g.fillCircle(x + 10, y + h * 0.78, 3);
  g.fillCircle(x + w - 10, y + h * 0.78, 3);
  g.lineStyle(3, 0x5a3a22);
  g.lineBetween(x + w, y + h * 0.35, x + w + 20, y + h * 0.35);
}

function logs(g: G, p: Prop) {
  const { x, y, w, h } = p;
  g.fillStyle(0x000000, 0.25);
  g.fillRect(x + 4, y + 6, w, h);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4 - row; i++) {
      const lx = x + i * 13 + row * 6;
      const ly = y + h - 10 - row * 9;
      g.fillStyle(0x6b4a2c);
      g.fillCircle(lx + 6, ly, 6);
      g.fillStyle(0xc9a06a);
      g.fillCircle(lx + 6, ly, 3.5);
    }
  g.fillStyle(0x9aa3ab);
  g.fillRect(x + w - 8, y + 2, 3, 16);
  g.fillStyle(0x5a3a22);
  g.fillRect(x + w - 9, y + 16, 5, 10);
}

/** Draws one prop into the zone's ground graphics. */
export function drawProp(g: G, p: Prop) {
  const tint = p.tint ? hex(p.tint) : 0xb8433a;
  switch (p.kind) {
    case 'casa':
      return house(g, p, tint, { chimney: true });
    case 'cuartel': {
      house(g, p, tint, { door: 'double' });
      // Shields hung on the wall, and a straw training dummy by the door.
      for (const sx of [p.x + p.w * 0.35, p.x + p.w * 0.65]) {
        g.fillStyle(0x3f6fd0);
        g.fillRoundedRect(sx - 7, p.y + p.h * 0.66, 14, 16, { tl: 2, tr: 2, bl: 7, br: 7 });
        g.fillStyle(0xf0d070);
        g.fillCircle(sx, p.y + p.h * 0.66 + 7, 3);
      }
      g.fillStyle(0xd8c060);
      g.fillRect(p.x + p.w + 14, p.y + p.h - 26, 8, 22);
      g.fillRect(p.x + p.w + 8, p.y + p.h - 20, 20, 5);
      g.fillCircle(p.x + p.w + 18, p.y + p.h - 30, 6);
      return;
    }
    case 'herreria': {
      house(g, p, tint, { chimney: true, plaster: 0xb8aa90 });
      // The forge's open side glows, the anvil waits.
      g.fillStyle(0xff7a2f, 0.9);
      g.fillRect(p.x + p.w - 30, p.y + p.h - 26, 20, 14);
      g.fillStyle(0xffd27a);
      g.fillRect(p.x + p.w - 25, p.y + p.h - 22, 10, 6);
      g.fillStyle(0x3a3a3a);
      g.fillRect(p.x - 24, p.y + p.h - 16, 20, 8);
      g.fillRect(p.x - 18, p.y + p.h - 8, 8, 8);
      return;
    }
    case 'granero': {
      house(g, p, tint, { door: 'double', plaster: 0x9a6a3e });
      g.lineStyle(3, 0xe6d6b0, 0.9);
      const dx = p.x + p.w / 2;
      const dy = p.y + p.h - 7;
      g.lineBetween(dx - 16, dy - 26, dx + 16, dy);
      g.lineBetween(dx + 16, dy - 26, dx - 16, dy);
      return;
    }
    case 'ayuntamiento': {
      house(g, p, tint, { door: 'double' });
      // The keep in the middle, taller, with a gold-trimmed spire and the kingdom's banners.
      const kw = p.w * 0.34;
      const kx = p.x + p.w / 2 - kw / 2;
      g.fillStyle(0x000000, 0.25);
      g.fillRect(kx + 8, p.y - 30, kw, 60);
      g.fillStyle(0x8c877b);
      g.fillRect(kx, p.y - 36, kw, 58);
      g.fillStyle(0xa8a294);
      for (let bx = kx; bx < kx + kw; bx += 12) g.fillRect(bx, p.y - 44, 8, 10);
      g.fillStyle(shade(tint, -0.25));
      g.fillTriangle(kx - 6, p.y - 34, kx + kw + 6, p.y - 34, kx + kw / 2, p.y - 86);
      g.fillStyle(tint);
      g.fillTriangle(kx - 6, p.y - 34, kx + kw / 2, p.y - 34, kx + kw / 2, p.y - 86);
      g.fillStyle(0xf0d070);
      g.fillCircle(kx + kw / 2, p.y - 88, 4);
      g.fillStyle(0x2c3440);
      g.fillRoundedRect(kx + kw / 2 - 7, p.y - 22, 14, 18, { tl: 7, tr: 7, bl: 0, br: 0 });
      g.fillStyle(0xffd27a, 0.6);
      g.fillRoundedRect(kx + kw / 2 - 5, p.y - 20, 10, 14, { tl: 5, tr: 5, bl: 0, br: 0 });
      banner(g, p.x - 18, p.y + p.h - 58, 58, tint);
      banner(g, p.x + p.w + 4, p.y + p.h - 58, 58, tint);
      return;
    }
    case 'torre':
      return tower(g, p);
    case 'empalizada':
      return palisade(g, p);
    case 'porton':
      return gate(g, p);
    case 'campo':
      return field(g, p);
    case 'pozo':
      return well(g, p);
    case 'fogata':
      return campfire(g, p);
    case 'carreta':
      return cart(g, p);
    case 'estandarte':
      return banner(g, p.x, p.y, p.h, tint);
    case 'lena':
      return logs(g, p);
  }
}

/** The ground of a settlement: a cobbled square around the altar and packed earth inside the walls. */
export function drawSettlementGround(g: G, def: ZoneDefinition) {
  const props = def.props ?? [];
  const walls = props.filter((p) => p.kind === 'empalizada');
  if (!walls.length) return;
  const minX = Math.min(...walls.map((p) => p.x));
  const minY = Math.min(...walls.map((p) => p.y));
  const maxX = Math.max(...walls.map((p) => p.x + p.w));
  const maxY = Math.max(...walls.map((p) => p.y + p.h));
  g.fillStyle(0x7a9a4a, 0.35);
  g.fillRect(minX, minY, maxX - minX, maxY - minY);
  // Cobbles: irregular grey stones in rings around the altar.
  const { x, y } = def.shrine;
  g.fillStyle(0x8a826e);
  g.fillCircle(x, y, 200);
  for (let r = 20; r < 196; r += 14)
    for (let a = 0; a < Math.PI * 2; a += 14 / r) {
      const jitter = ((Math.sin(a * 91 + r) + 1) * 3) | 0;
      g.fillStyle((Math.round(a * r) + r) % 3 ? 0xa39a82 : 0x958c75);
      g.fillRoundedRect(x + Math.cos(a) * r - 6, y + Math.sin(a) * r - 5, 11 + jitter, 9, 3);
    }
  g.lineStyle(6, 0x6b6452, 0.8);
  g.strokeCircle(x, y, 200);
}

/** The altar: an octagonal stone dais, four rune pillars and a floating mana crystal. */
export function drawAltar(g: G, at: Vec) {
  const { x, y } = at;
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(x + 8, y + 14, 120, 50);
  const octagon = (radius: number) =>
    Array.from({ length: 8 }, (_, i) => ({ x: x + Math.cos((i * Math.PI) / 4 + Math.PI / 8) * radius, y: y + Math.sin((i * Math.PI) / 4 + Math.PI / 8) * radius * 0.8 }));
  g.fillStyle(0x5f5a50);
  g.fillPoints(octagon(54), true);
  g.fillStyle(0x9a9484);
  g.fillPoints(octagon(46), true);
  g.fillStyle(0xb8b2a0);
  g.fillPoints(octagon(34), true);
  // Runes carved in the ring, glowing blue.
  g.fillStyle(0x7fd6ff, 0.8);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.fillRect(x + Math.cos(a) * 40 - 2, y + Math.sin(a) * 32 - 3, 4, 6);
  }
  for (const [px, py] of [[-44, -30], [44, -30], [-44, 26], [44, 26]]) {
    g.fillStyle(0x000000, 0.3);
    g.fillRect(x + px - 4, y + py + 2, 12, 12);
    g.fillStyle(0x7a7468);
    g.fillRect(x + px - 6, y + py - 18, 12, 26);
    g.fillStyle(0xa8a294);
    g.fillRect(x + px - 6, y + py - 20, 12, 5);
    g.fillStyle(0x7fd6ff);
    g.fillRect(x + px - 2, y + py - 12, 4, 10);
  }
  g.fillStyle(0x3a6a9a);
  g.fillCircle(x, y, 18);
  g.fillStyle(0x7fd6ff, 0.9);
  g.fillCircle(x, y, 12);
}

/** Peasant with a straw hat (4), a work tunic (3) and a leather apron (5). */
const VILLAGER_ART = [
  '................', '....44444444....', '...4444444444...', '.....277772.....',
  '.....777777.....', '......7777......', '....33333333....', '...3335555333...',
  '..73335555337...', '..7.33555533.7..', '....33555533....', '....33333333....',
  '.....33..33.....', '.....33..33.....', '.....88..88.....', '................',
];

const VILLAGER_LOOKS = [
  { cloth: '#8a6a44', light: '#e8c878' },
  { cloth: '#6a8a5a', light: '#d8c070' },
  { cloth: '#8a5a6a', light: '#e0d0a0' },
];

export function makeVillagerTextures(scene: Phaser.Scene) {
  VILLAGER_LOOKS.forEach((look, i) => {
    for (let frame = 0; frame < 2; frame++) {
      const key = `villager-${i}-${frame}`;
      if (scene.textures.exists(key)) continue;
      scene.textures.generate(key, {
        data: VILLAGER_ART.map((row, r) => (frame === 1 && r >= 12 ? row.slice(0, 3) + row.slice(3, 13).split('').reverse().join('') + row.slice(13) : row)),
        pixelWidth: 2,
        palette: palette(look.cloth, look.light) as Phaser.Types.Create.Palette,
      });
    }
  });
}

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  look: number;
  from: Vec;
  to: Vec;
  t: number;
  pause: number;
}

/**
 * The life of a settlement, only on this screen: villagers wandering between the open spots of the
 * square, guards at the gates, the fire flickering and the altar breathing. Nothing here is
 * simulated or sent; everyone sees their own villagers.
 */
export class Settlement {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private walkers: Walker[] = [];
  private stops: Vec[];

  constructor(private scene: Phaser.Scene, def: ZoneDefinition) {
    const props = def.props ?? [];
    const { x, y } = def.shrine;
    // The altar's crystal floats and breathes.
    const glow = scene.add.circle(x, y, 26, 0x7fd6ff, 0.25).setDepth(4);
    const crystal = scene.add.star(x, y - 18, 4, 5, 13, 0xbff0ff, 1).setDepth(11);
    scene.tweens.add({ targets: glow, scale: 1.6, alpha: 0.05, duration: 1400, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: crystal, y: y - 28, angle: 45, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.objects.push(glow, crystal);
    for (const fire of props.filter((p) => p.kind === 'fogata' || p.kind === 'herreria')) {
      const fx = fire.kind === 'fogata' ? fire.x + fire.w / 2 : fire.x + fire.w - 20;
      const fy = fire.kind === 'fogata' ? fire.y + fire.h / 2 - 4 : fire.y + fire.h - 22;
      const size = fire.kind === 'fogata' ? 1 : 0.5;
      const outer = scene.add.circle(fx, fy, 11 * size, 0xff7a2f, 0.85).setDepth(5);
      const inner = scene.add.circle(fx, fy - 3 * size, 6 * size, 0xffd27a, 1).setDepth(5);
      scene.tweens.add({ targets: outer, scaleY: 1.35, scaleX: 0.85, duration: 180, yoyo: true, repeat: -1 });
      scene.tweens.add({ targets: inner, scaleY: 1.5, y: fy - 6 * size, duration: 140, yoyo: true, repeat: -1 });
      this.objects.push(outer, inner);
    }
    // Open spots of the square: within reach of the altar and away from everything solid.
    this.stops = [];
    for (let r = 90; r <= 260; r += 45)
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        const stop = { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
        const clear = !props.some((p) => p.solid && stop.x > p.x - 30 && stop.x < p.x + p.w + 30 && stop.y > p.y - 30 && stop.y < p.y + p.h + 30);
        if (clear) this.stops.push(stop);
      }
    if (!props.length || this.stops.length < 2) return;
    makeVillagerTextures(scene);
    for (let i = 0; i < 6; i++) {
      const from = this.stops[(i * 5) % this.stops.length];
      const to = this.stops[(i * 7 + 3) % this.stops.length];
      const look = i % VILLAGER_LOOKS.length;
      const sprite = scene.add.sprite(from.x, from.y, `villager-${look}-0`).setOrigin(0.5, 0.7).setDepth(9);
      this.walkers.push({ sprite, look, from, to, t: (i * 0.17) % 1, pause: i * 0.4 });
      this.objects.push(sprite);
    }
    // Guards in the kingdom's blue, standing at each gate.
    for (const gate of props.filter((p) => p.kind === 'porton')) {
      const inside = gate.w >= gate.h
        ? [{ x: gate.x + 20, y: gate.y - 28 }, { x: gate.x + gate.w - 20, y: gate.y - 28 }]
        : [{ x: gate.x - 26, y: gate.y + 22 }, { x: gate.x - 26, y: gate.y + gate.h - 22 }];
      for (const spot of inside) {
        const guard = scene.add.sprite(spot.x, spot.y, 'blue-guardian-0').setOrigin(0.5, 0.7).setDepth(9);
        guard.setFlipX(gate.w < gate.h ? false : spot.x > gate.x + gate.w / 2);
        this.objects.push(guard);
      }
    }
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    for (const w of this.walkers) {
      if (w.pause > 0) {
        w.pause -= dt;
        w.sprite.setTexture(`villager-${w.look}-0`);
        continue;
      }
      const length = Math.max(1, Math.hypot(w.to.x - w.from.x, w.to.y - w.from.y));
      w.t += (38 * dt) / length;
      if (w.t >= 1) {
        w.from = w.to;
        w.to = this.stops[Math.floor(Math.random() * this.stops.length)];
        w.t = 0;
        w.pause = 1 + Math.random() * 3;
        continue;
      }
      w.sprite.setPosition(w.from.x + (w.to.x - w.from.x) * w.t, w.from.y + (w.to.y - w.from.y) * w.t);
      w.sprite.setFlipX(w.to.x < w.from.x);
      w.sprite.setTexture(`villager-${w.look}-${Math.floor(time / 180) % 2}`);
    }
  }

  destroy() {
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
    this.walkers = [];
  }
}
