import Phaser from 'phaser';
import type { MobFamilyId } from '@bandera/shared/rpg/zones';

/**
 * The world's monsters, painted instead of pixelled: chunky silhouettes with a dark outline, a lit
 * top and a shaded belly, seen from the side the way a Warcraft III unit reads from the camera. Each
 * family has three forms (levels 1, 10 and 20) that change more than the name — a wolf pup grows
 * into a black warg with a spiked back and red eyes, a goblin thief ends up crowned — and two
 * walking frames. Everything is drawn once into textures at start, so a camp of monsters costs the
 * same as the old sprites every frame.
 */

type G = Phaser.GameObjects.Graphics;
type Form = 0 | 1 | 2;
type Frame = 0 | 1;

/** Texture size; the creature stands on GROUND and faces right (the sprite flips to face left). */
export const MONSTER_TEXTURE = 96;
const GROUND = 80;
/** How the 96 px painting maps to the world, before each family's own scale. */
export const MONSTER_DISPLAY = 0.56;
/** Where the feet are, as a sprite origin. */
export const MONSTER_ORIGIN_Y = GROUND / MONSTER_TEXTURE;

const OUTLINE = 0x16110d;
const shade = (color: number, amount: number) => {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return amount >= 0 ? c.clone().lighten(amount * 100).color : c.clone().darken(-amount * 100).color;
};

function ellipse(g: G, x: number, y: number, rx: number, ry: number, color: number, outline = true) {
  g.fillStyle(color);
  g.fillEllipse(x, y, rx * 2, ry * 2);
  if (outline) {
    g.lineStyle(2, OUTLINE, 0.9);
    g.strokeEllipse(x, y, rx * 2, ry * 2);
  }
}
function circle(g: G, x: number, y: number, r: number, color: number, outline = true) {
  g.fillStyle(color);
  g.fillCircle(x, y, r);
  if (outline) {
    g.lineStyle(2, OUTLINE, 0.9);
    g.strokeCircle(x, y, r);
  }
}
function poly(g: G, points: number[], color: number, outline = true) {
  const pts = [];
  for (let i = 0; i < points.length; i += 2) pts.push({ x: points[i], y: points[i + 1] });
  g.fillStyle(color);
  g.fillPoints(pts, true);
  if (outline) {
    g.lineStyle(2, OUTLINE, 0.9);
    g.strokePoints(pts, true);
  }
}
function limb(g: G, x1: number, y1: number, x2: number, y2: number, width: number, color: number) {
  g.lineStyle(width + 3, OUTLINE, 0.9);
  g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(width, color, 1);
  g.lineBetween(x1, y1, x2, y2);
}
function rect(g: G, x: number, y: number, w: number, h: number, color: number, radius = 2) {
  g.fillStyle(color);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(2, OUTLINE, 0.9);
  g.strokeRoundedRect(x, y, w, h, radius);
}
function eye(g: G, x: number, y: number, r: number, color: number) {
  g.fillStyle(color, 0.35);
  g.fillCircle(x, y, r * 2.2);
  g.fillStyle(color);
  g.fillCircle(x, y, r);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.35);
}
/** Four legs of a beast, alternating pairs between frames. */
function beastLegs(g: G, backX: number, frontX: number, top: number, length: number, width: number, color: number, frame: Frame) {
  const swing = frame ? 4 : -4;
  const legs: [number, number][] = [
    [backX - 3, -swing],
    [frontX - 3, swing],
    [backX + 4, swing],
    [frontX + 4, -swing],
  ];
  legs.forEach(([x, s], i) => {
    const tone = i < 2 ? shade(color, -0.25) : color;
    limb(g, x, top, x + s, top + length, width, tone);
    ellipse(g, x + s + 1, top + length + 1, width * 0.7, width * 0.4, shade(tone, -0.3), false);
  });
}

// ─── Beasts ─────────────────────────────────────────────────────────────────────────────────────

function wolf(g: G, form: Form, frame: Frame) {
  const fur = [0x8f949b, 0x5f6670, 0x2f323a][form];
  const light = shade(fur, 0.35);
  const eyeColor = form === 2 ? 0xff3b30 : 0xffd23f;
  // Bushy tail, raised a little when walking.
  poly(g, [26, 52, 6, 40 + frame * 3, 4, 50 + frame * 2, 14, 56, 26, 60], shade(fur, -0.1));
  poly(g, [8, 44 + frame * 3, 4, 50 + frame * 2, 10, 50], light, false);
  beastLegs(g, 32, 60, 60, 16, 6.5, fur, frame);
  ellipse(g, 44, 55, 24, 13.5, fur);
  ellipse(g, 46, 63, 16, 4.5, light, false);
  // Neck, head, snout, ears.
  ellipse(g, 63, 49, 13, 13, fur);
  poly(g, [66, 38, 69, 25, 74, 38], shade(fur, -0.2));
  poly(g, [71, 38, 77, 27, 79, 40], fur);
  ellipse(g, 73, 43, 11, 9, fur);
  poly(g, [79, 40, 94, 46, 92, 51, 78, 51], light);
  circle(g, 92, 47, 2.2, 0x111111, false);
  g.lineStyle(1.5, OUTLINE, 0.8);
  g.lineBetween(82, 50, 91, 51);
  eye(g, 77, 42, 1.8, eyeColor);
  // A pup has a light chest; the grown wolf a dark mane; the warg spikes of bone along its back.
  if (form >= 1) for (let i = 0; i < 5; i++) poly(g, [52 + i * 4, 44 - i * 0.5, 55 + i * 4, 36 - i, 58 + i * 4, 44], shade(fur, -0.3), false);
  if (form === 2) {
    for (let i = 0; i < 5; i++) poly(g, [28 + i * 7, 47, 31 + i * 7, 37 - (i % 2) * 3, 34 + i * 7, 47], 0xe6dcc8);
    g.lineStyle(2, 0xb83a30, 0.9);
    g.lineBetween(70, 38, 76, 46);
  }
}

function boar(g: G, form: Form, frame: Frame) {
  const hide = [0x7a4e32, 0x5c4a42, 0x3e3430][form];
  const light = shade(hide, 0.3);
  beastLegs(g, 30, 60, 64, 12, 6, shade(hide, -0.1), frame);
  ellipse(g, 44, 56, 27, 16, hide);
  ellipse(g, 44, 66, 18, 5, light, false);
  // Bristles along the spine.
  for (let i = 0; i < 9; i++) poly(g, [22 + i * 5, 44 - Math.sin(i / 2.7) * 4, 24 + i * 5, 34 - Math.sin(i / 2.7) * 5, 27 + i * 5, 44 - Math.sin(i / 2.7) * 4], shade(hide, -0.35), false);
  if (form === 2)
    for (let i = 0; i < 3; i++) {
      rect(g, 28 + i * 13, 44, 11, 14, 0x8a9096, 2);
      circle(g, 33.5 + i * 13, 51, 1.5, 0xd8dde2, false);
    }
  poly(g, [66, 46, 64, 36, 73, 45], shade(hide, -0.2));
  ellipse(g, 73, 56, 13, 12, hide);
  ellipse(g, 86, 60, 6, 6, 0xc98f7a);
  circle(g, 88, 59, 1.2, 0x2a1a14, false);
  circle(g, 88, 62, 1.2, 0x2a1a14, false);
  const tusk = form === 2 ? 0xb8c0c8 : 0xf0e8d8;
  poly(g, [82, 64, 92, 50 - form * 2, 86, 66], tusk);
  eye(g, 77, 51, 1.8, form === 2 ? 0xff6b3d : 0x1a0f0a);
  g.lineStyle(2, OUTLINE, 0.8);
  g.beginPath();
  g.arc(18, 52, 4, Math.PI, Math.PI * 2.4);
  g.strokePath();
}

function spider(g: G, form: Form, frame: Frame) {
  const shell = [0x4a3526, 0x2d2440, 0x151218][form];
  const legColor = shade(shell, -0.15);
  // Eight legs: four reaching forward, four back, knees high, alternating by frame.
  for (let i = 0; i < 4; i++) {
    const lift = (i + frame) % 2 ? -4 : 3;
    const baseX = 50 + i * 4;
    limb(g, baseX, 56, baseX + 14 + i * 4, 34 + lift, 3, legColor);
    limb(g, baseX + 14 + i * 4, 34 + lift, baseX + 22 + i * 6, GROUND, 2.5, legColor);
    limb(g, baseX - 2, 58, baseX - 20 - i * 3, 36 - lift, 3, shade(legColor, -0.2));
    limb(g, baseX - 20 - i * 3, 36 - lift, baseX - 30 - i * 5, GROUND, 2.5, shade(legColor, -0.2));
  }
  const abdomen = 17 + form * 3;
  ellipse(g, 32, 52, abdomen, abdomen - 3, shell);
  g.fillStyle(0xffffff, 0.12);
  g.fillEllipse(28, 44, abdomen, 8);
  if (form === 1) for (const [x, y] of [[26, 50], [36, 46], [32, 58]]) circle(g, x, y, 3, 0x9a5ad0, false);
  if (form === 2) {
    poly(g, [26, 42, 38, 42, 32, 52, 38, 62, 26, 62, 32, 52], 0xd8262c, false);
    poly(g, [58, 44, 60, 34, 64, 40, 68, 32, 70, 40, 74, 34, 74, 45], 0xd8b040);
  }
  ellipse(g, 64, 56, 12, 10, shade(shell, 0.15));
  for (const [x, y] of [[70, 51], [73, 54], [68, 55], [72, 58]]) eye(g, x, y, 1.5, form === 0 ? 0xff5a3a : 0xff2d55);
  poly(g, [74, 60, 80, 66, 74, 64], 0xe8e0d0);
}

function toad(g: G, form: Form, frame: Frame) {
  const skin = [0xa8b87a, 0x7f9a4a, 0x5a4a6a][form];
  const size = 1 + form * 0.12;
  const hop = frame ? -2 : 0;
  // Folded hind leg, then the fat body, the front arms and the eyes on top.
  ellipse(g, 30, 70 + hop, 14 * size, 9, shade(skin, -0.15));
  ellipse(g, 48, 60 + hop, 28 * size, 18 * size, skin);
  ellipse(g, 52, 70 + hop, 20 * size, 6, 0xe8e0b8, false);
  for (const [x, y, r] of [[36, 50, 3], [48, 46, 2.5], [58, 52, 3], [30, 60, 2.5], [44, 56, 2]])
    circle(g, x, y + hop, r + form * 0.6, shade(skin, form === 1 ? 0.35 : -0.25), false);
  limb(g, 66, 66 + hop, 72, GROUND, 5, skin);
  ellipse(g, 74, GROUND, 6, 2.5, shade(skin, -0.2), false);
  for (const x of [58, 70]) {
    circle(g, x, 40 * size + hop - form * 4, 7, skin);
    eye(g, x + 1, 39 * size + hop - form * 4, 3, 0xffd23f);
    g.fillStyle(0x111111);
    g.fillRect(x - 0.5, 36 * size + hop - form * 4, 2.5, 6);
  }
  g.lineStyle(2.5, OUTLINE, 0.9);
  g.beginPath();
  g.arc(64, 54 + hop, 16 * size, 0.15, 0.9);
  g.strokePath();
  if (form === 2) poly(g, [54, 26 + hop, 56, 16 + hop, 60, 22 + hop, 64, 14 + hop, 68, 22 + hop, 72, 16 + hop, 74, 27 + hop], 0xd8b040);
}

// ─── Walkers on two legs ────────────────────────────────────────────────────────────────────────

function legs(g: G, x: number, top: number, color: number, frame: Frame, width = 6, boot = 0x2a1f18) {
  const s = frame ? 5 : -5;
  limb(g, x - 3, top, x - 3 + s, GROUND - 2, width, shade(color, -0.2));
  limb(g, x + 4, top, x + 4 - s, GROUND - 2, width, color);
  ellipse(g, x - 1 + s, GROUND, width * 0.9, 3, boot, false);
  ellipse(g, x + 6 - s, GROUND, width * 0.9, 3, boot, false);
}

function goblin(g: G, form: Form, frame: Frame) {
  const skin = 0x6f9a3a;
  const cloth = [0x6b4a2c, 0x4a3a2a, 0x5a2a6a][form];
  if (form === 2) poly(g, [34, 44, 26, 74, 46, 70], 0x7a2a8a);
  legs(g, 46, 62, cloth, frame, 5);
  rect(g, 36, 44, 22, 21, cloth, 5);
  rect(g, 36, 56, 22, 4, 0x3a2a1a, 1);
  // Big pointed ears, a hooked nose, a mean grin.
  poly(g, [40, 32, 22, 22, 38, 40], skin);
  circle(g, 48, 32, 11, skin);
  poly(g, [56, 30, 72, 20, 58, 38], shade(skin, 0.1));
  poly(g, [57, 32, 66, 36, 57, 38], shade(skin, -0.15));
  eye(g, 52, 29, 2, 0xffd23f);
  g.lineStyle(1.5, OUTLINE, 0.9);
  g.lineBetween(46, 38, 54, 38);
  g.fillStyle(0xf0e8d0);
  g.fillTriangle(48, 38, 50, 38, 49, 40);
  if (form === 1) poly(g, [37, 26, 58, 22, 58, 28, 38, 30], 0xb8433a);
  if (form === 2) poly(g, [38, 22, 40, 12, 44, 18, 48, 10, 52, 18, 56, 12, 58, 22], 0xd8b040);
  // What it holds: a stone to throw, then a dagger.
  limb(g, 56, 48, 66, 42 + frame * 2, 4, skin);
  if (form === 0) circle(g, 68, 40 + frame * 2, 4.5, 0x8a8a84);
  else poly(g, [64, 44, 80, 32, 82, 34, 67, 46], 0xd8dde2);
}

function bandit(g: G, form: Form, frame: Frame) {
  const cloak = [0x5a4a3a, 0x3e3a36, 0x6a1f1f][form];
  if (form >= 1) poly(g, [36, 34, 22, 76, 50, 72], shade(cloak, -0.25));
  legs(g, 47, 60, 0x4a3a2c, frame, 7);
  rect(g, 34, 34, 28, 30, cloak, 7);
  if (form >= 1) {
    rect(g, 36, 40, 24, 14, 0x6b4a2c, 3);
    g.lineStyle(2, 0x3a2a1a, 0.9);
    g.lineBetween(38, 47, 58, 47);
  }
  rect(g, 34, 56, 28, 5, 0x2a1f18, 1);
  circle(g, 49, 26, 10, 0xc99a74);
  // Hood, scarf over the mouth, and for the lord of ash a horned helm.
  poly(g, [36, 30, 40, 14, 56, 12, 62, 24, 58, 20, 42, 22], form === 2 ? 0x5a5f66 : shade(cloak, 0.1));
  if (form === 2) {
    poly(g, [40, 16, 30, 2, 44, 12], 0xe6dcc8);
    poly(g, [58, 16, 66, 0, 60, 14], 0xe6dcc8);
  }
  rect(g, 44, 28, 16, 6, form === 0 ? 0x8a6a44 : 0x2a2a2a, 2);
  eye(g, 54, 23, 1.6, form === 2 ? 0xff7a2f : 0x1a1410);
  // The fire bottle, held high, burning.
  limb(g, 58, 40, 68, 26 - frame * 2, 6, cloak);
  rect(g, 64, 14 - frame * 2, 8, 12, 0x5a8a4a, 2);
  const flame = form === 2 ? 1.4 : 1;
  poly(g, [65, 14 - frame * 2, 68, 4 - frame * 3 - 4 * flame, 72, 14 - frame * 2], 0xff7a2f, false);
  poly(g, [67, 14 - frame * 2, 68.5, 8 - frame * 3 - 2 * flame, 70, 14 - frame * 2], 0xffd27a, false);
}

function ent(g: G, form: Form, frame: Frame) {
  const bark = [0x7a5634, 0x6b4a2c, 0x4e3a28][form];
  const leaves = [0x7fc454, 0x4f9a3a, 0x3a6a2a][form];
  // Roots for feet, stepping.
  const s = frame ? 4 : -4;
  poly(g, [36, 68, 26 + s, GROUND, 40 + s, GROUND - 2, 44, 70], shade(bark, -0.2));
  poly(g, [52, 68, 56 - s, GROUND - 2, 70 - s, GROUND, 58, 66], bark);
  // Trunk body with bark grooves, branch arms.
  poly(g, [34, 70, 38, 30, 58, 28, 62, 70], bark);
  g.lineStyle(2, shade(bark, -0.35), 0.9);
  for (const x of [42, 49, 55]) g.lineBetween(x, 34, x + (x % 2 ? 2 : -2), 66);
  limb(g, 36, 40, 20, 30 + frame * 3, 5, bark);
  limb(g, 20, 30 + frame * 3, 12, 20, 3, bark);
  limb(g, 60, 40, 76, 34 - frame * 3, 5, bark);
  limb(g, 76, 34 - frame * 3, 86, 26, 3, bark);
  // Canopy: more of it with age, and moss hanging like a beard on the elder.
  const crowns = form === 0 ? [[48, 22, 14]] : form === 1 ? [[40, 22, 13], [56, 18, 14], [48, 10, 12]] : [[36, 22, 14], [58, 20, 15], [46, 8, 14], [24, 30, 9], [72, 26, 9]];
  for (const [x, y, r] of crowns) circle(g, x, y, r, leaves);
  for (const [x, y, r] of crowns) {
    g.fillStyle(shade(leaves, 0.3), 0.7);
    g.fillCircle(x - r * 0.3, y - r * 0.35, r * 0.4);
  }
  if (form === 0) {
    circle(g, 12, 20, 4, leaves);
    circle(g, 86, 26, 4, leaves);
  }
  g.fillStyle(0x1a120a);
  g.fillEllipse(44, 42, 6, 4);
  g.fillEllipse(54, 42, 6, 4);
  if (form >= 1) {
    eye(g, 44, 42, 1.8, 0xffe07a);
    eye(g, 54, 42, 1.8, 0xffe07a);
  }
  if (form === 2) for (let i = 0; i < 5; i++) poly(g, [42 + i * 3, 48, 43 + i * 3, 60 + (i % 2) * 5, 45 + i * 3, 48], 0x5a7a3a, false);
}

function ghoul(g: G, form: Form, frame: Frame) {
  const skin = [0x9aa88a, 0x8a9a7a, 0x5a6a5c][form];
  if (form === 2) {
    g.fillStyle(0x6a3a8a, 0.25);
    g.fillEllipse(48, 50, 70, 60);
  }
  legs(g, 44, 60, skin, frame, 5, 0x3a3a30);
  // Hunched: the back bends forward and the head hangs low and ahead.
  poly(g, [30, 64, 32, 40, 48, 30, 62, 38, 58, 62], skin);
  g.lineStyle(2, shade(skin, -0.35), 0.9);
  for (let i = 0; i < 4; i++) g.lineBetween(38 + i * 5, 44 + i, 42 + i * 5, 56 + i);
  if (form === 2) for (let i = 0; i < 5; i++) circle(g, 34 + i * 5, 38 - i * 1.5, 2, 0xe6dcc8, false);
  poly(g, [32, 58, 30, 68, 58, 68, 58, 60], 0x4a4038);
  circle(g, 66, 40, 9, skin);
  eye(g, 70, 38, 2, 0xff3b30);
  g.lineStyle(1.5, OUTLINE, 0.9);
  g.lineBetween(64, 45, 74, 45);
  g.fillStyle(0xf0e8d0);
  for (let i = 0; i < 4; i++) g.fillTriangle(65 + i * 2.5, 45, 66.5 + i * 2.5, 45, 65.8 + i * 2.5, 48);
  // Long arms dragging claws; the voracious one's are red.
  const claw = form >= 1 ? 0xb8433a : 0xe6dcc8;
  limb(g, 58, 42, 72, 58 + frame * 3, 4, skin);
  limb(g, 72, 58 + frame * 3, 80, 70, 3, skin);
  for (let i = 0; i < 3; i++) poly(g, [79, 69 + i, 88 + i, 72 + i * 3, 80, 72 + i], claw, false);
  limb(g, 40, 42, 34, 60 - frame * 3, 4, shade(skin, -0.2));
}

function fireSpirit(g: G, form: Form, frame: Frame) {
  const outer = [0xff7a2f, 0xd8262c, 0xb01840][form];
  const middle = [0xffb347, 0xff7a2f, 0xff9a3a][form];
  const core = [0xffe8a0, 0xffd27a, 0xcfe8ff][form];
  const sway = frame ? 4 : -4;
  const tall = 1 + form * 0.12;
  const flame = (w: number, color: number, top: number) =>
    poly(g, [48 - w, 70, 48 - w * 1.1, 52, 48 - w * 0.5 + sway * 0.5, 40, 48 + sway, top, 48 + w * 0.6 + sway * 0.4, 42, 48 + w * 1.1, 54, 48 + w, 70], color, color === outer);
  flame(20, outer, 10 / tall);
  flame(14, middle, 24 / tall);
  flame(8, core, 38);
  if (form >= 1) {
    poly(g, [34, 40, 26, 22 + sway, 38, 34], outer);
    poly(g, [62, 40, 70, 22 - sway, 58, 34], outer);
  }
  g.fillStyle(0x2a0a05);
  g.fillEllipse(42, 52, 5, 7);
  g.fillEllipse(54, 52, 5, 7);
  g.fillEllipse(48, 62, 8, 4);
  for (const [x, y] of [[26, 30], [72, 26], [34, 16], [66, 12]]) {
    g.fillStyle(core, 0.8);
    g.fillCircle(x + sway * 0.5, y - frame * 3, 1.8);
  }
}

function skeleton(g: G, form: Form, frame: Frame) {
  const bone = 0xe6e0cc;
  const shadow = 0x9a9480;
  if (form === 2) poly(g, [36, 32, 26, 74, 50, 70], 0x8a1f2a);
  // Legs and arms as bones: thin shafts with knobbed joints.
  const s = frame ? 5 : -5;
  for (const [x, dx] of [[43, s], [52, -s]] as const) {
    limb(g, x, 58, x + dx * 0.5, 68, 3, bone);
    limb(g, x + dx * 0.5, 68, x + dx, GROUND - 2, 3, bone);
    circle(g, x + dx * 0.5, 68, 2.5, bone, false);
  }
  poly(g, [40, 54, 56, 54, 54, 60, 42, 60], bone);
  limb(g, 48, 32, 48, 55, 3, shadow);
  // Ribcage.
  for (let i = 0; i < 4; i++) {
    g.lineStyle(3.5, OUTLINE, 0.9);
    g.strokeEllipse(48, 36 + i * 4.5, 22 - i * 2, 5);
    g.lineStyle(2, bone, 1);
    g.strokeEllipse(48, 36 + i * 4.5, 22 - i * 2, 5);
  }
  if (form === 2) {
    rect(g, 36, 30, 24, 18, 0x5a5f66, 4);
    circle(g, 40, 30, 5, 0x6a7078);
    circle(g, 56, 30, 5, 0x6a7078);
  }
  // Skull.
  circle(g, 50, 20, 10, bone);
  rect(g, 46, 26, 10, 6, bone, 2);
  g.fillStyle(0x1a1410);
  g.fillEllipse(47, 19, 5, 6);
  g.fillEllipse(55, 19, 4, 6);
  if (form >= 1) {
    eye(g, 47, 19, 1.4, form === 2 ? 0x7fffb0 : 0xff5a3a);
    eye(g, 55, 19, 1.2, form === 2 ? 0x7fffb0 : 0xff5a3a);
  }
  if (form === 2) poly(g, [38, 18, 40, 6, 50, 2, 60, 6, 62, 18, 58, 14, 42, 14], 0x5a5f66);
  // Arms: a rusty sword, then a round shield on the other.
  limb(g, 58, 32, 64, 44 + frame * 2, 3, bone);
  if (form >= 1) {
    poly(g, [62, 44 + frame * 2, 82, 22 + frame * 2, 84, 25 + frame * 2, 65, 47 + frame * 2], form === 2 ? 0xc8d0d8 : 0xa07a5a);
    limb(g, 38, 32, 32, 44, 3, bone);
    circle(g, 30, 46, 9, form === 2 ? 0x5a5f66 : 0x7a5634);
    circle(g, 30, 46, 2.5, 0xd8b040, false);
  } else limb(g, 38, 32, 34, 48 - frame * 2, 3, bone);
}

function necromancer(g: G, form: Form, frame: Frame) {
  const robe = [0x4a2a5a, 0x3a1f4a, 0x241430][form];
  const trim = form === 2 ? 0xd8b040 : 0x7a5a9a;
  const s = frame ? 3 : -3;
  // A robe to the ground that sways instead of legs.
  poly(g, [34 + s, GROUND, 38, 34, 58, 34, 64 - s, GROUND], robe);
  g.lineStyle(2.5, trim, 0.9);
  g.lineBetween(34 + s, GROUND - 1, 64 - s, GROUND - 1);
  g.lineBetween(48, 36, 49, GROUND - 2);
  if (form >= 1) {
    ellipse(g, 38, 36, 7, 5, 0xe6e0cc);
    ellipse(g, 58, 36, 7, 5, 0xe6e0cc);
  }
  // Deep hood, a face of shadow and two green lights.
  poly(g, [36, 38, 38, 16, 48, 8, 60, 16, 62, 38], shade(robe, 0.1));
  g.fillStyle(0x0a0610);
  g.fillEllipse(50, 26, 16, 18);
  eye(g, 47, 25, 1.8, 0x7fffb0);
  eye(g, 54, 25, 1.8, 0x7fffb0);
  if (form === 2) poly(g, [38, 12, 40, 2, 44, 8, 48, 0, 52, 8, 56, 2, 60, 12], 0xd8b040);
  // The staff, topped with a skull, burning green for the sunken king.
  limb(g, 66, 12 + frame, 66, GROUND, 3, 0x5a3a22);
  limb(g, 60, 42, 66, 40, 5, robe);
  circle(g, 66, 10 + frame, 6, 0xe6e0cc);
  g.fillStyle(0x1a1410);
  g.fillCircle(64, 9 + frame, 1.5);
  g.fillCircle(68, 9 + frame, 1.5);
  if (form >= 1) {
    g.fillStyle(0x7fffb0, 0.5);
    g.fillCircle(66, 10 + frame, 11 + form * 2);
    poly(g, [60, 6, 66, -4 - frame * 2 - form * 2, 72, 6], 0x7fffb0, false);
  }
}

const PAINTERS: Record<MobFamilyId, (g: G, form: Form, frame: Frame) => void> = {
  lobezno: wolf,
  jabali: boar,
  duende: goblin,
  arana: spider,
  saqueador: bandit,
  ent,
  ghoul,
  espiritu_ceniza: fireSpirit,
  sapo: toad,
  esqueleto: skeleton,
  nigromante: necromancer,
};

export const monsterForm = (level: number): Form => (level >= 20 ? 2 : level >= 10 ? 1 : 0);
export const monsterTexture = (family: MobFamilyId, level: number, frame: number) => `monster-${family}-${monsterForm(level)}-${frame % 2}`;

/** Paints every family × form × frame into its own texture, once. */
export function makeMonsterTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({}, false);
  for (const family of Object.keys(PAINTERS) as MobFamilyId[])
    for (const form of [0, 1, 2] as Form[])
      for (const frame of [0, 1] as Frame[]) {
        const key = `monster-${family}-${form}-${frame}`;
        if (scene.textures.exists(key)) continue;
        g.clear();
        PAINTERS[family](g, form, frame);
        g.generateTexture(key, MONSTER_TEXTURE, MONSTER_TEXTURE);
      }
  g.destroy();
}

export const MONSTER_FAMILIES = Object.keys(PAINTERS) as MobFamilyId[];
