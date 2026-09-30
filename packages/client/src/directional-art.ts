import type Phaser from 'phaser';
import type { Facing } from './locomotion';

/** Pixel-art poses assembled from head, torso, arms and independently stepping legs.
 * Back poses replace facial features with hood/hair/helmet, rather than mirroring a face.
 * Five authored projections supply eight directions; west mirrors east. */
export function pose(rows: string[], direction: Facing, frame: number): string[] {
  const out = Array.from({ length: 20 }, () => Array<string>(20).fill('.'));
  const walking = frame >= 2;
  const step = walking ? [0, 1, 2, 0, -1, -2][frame - 2] : 0;
  const back = direction >= 5;
  const side = direction === 0 || direction === 4;
  const diagonal = [1, 3, 5, 7].includes(direction);
  const mirror = [3, 4, 5].includes(direction);
  const bob = walking && [3, 5, 6].includes(frame) ? -1 : frame === 1 ? -1 : 0;
  const armored = rows.slice(0, 6).join('').split('1').length > 12;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    let pixel = rows[y][x];
    if (pixel === '.') continue;
    let px = x, py = y;
    const head = y < 6, legs = y >= 12, arm = y >= 7 && y < 12 && (x < 4 || x > 11);
    if (head && back && ['7', '2'].includes(pixel)) pixel = armored ? '1' : '3';
    if (head && side) {
      px = Math.round(8 + (x - 8) * .65);
      if (pixel === '7' && x < 8) pixel = '3';
    } else if (head && diagonal) {
      px += 1;
      if (!back && pixel === '7' && x < 6) pixel = '3';
    }
    if (side && !head) px = Math.round(8 + (x - 8) * .65);
    if (legs) {
      const leg = x < 8 ? 1 : -1;
      py += Math.round(step * leg / 2);
      if (side || diagonal) px += Math.round(step * leg / 2);
    } else {
      py += bob;
      if (arm) { py -= Math.round(step * (x < 8 ? 1 : -1) / 2); px += Math.sign(step) * (x < 8 ? -1 : 1); }
    }
    px = (mirror ? 15 - px : px) + 2; py += 2;
    if (px >= 0 && px < 20 && py >= 0 && py < 20) out[py][px] = pixel;
  }
  return out.map(row => row.join(''));
}

export function ensureActorAtlas(scene: Phaser.Scene, key: string, rows: string[], colors: Record<string, string>): string {
  const name = `actor-${key}`;
  if (scene.textures.exists(name)) return name;
  const atlas = scene.textures.createCanvas(name, 8 * 40, 8 * 40)!;
  const context = atlas.context;
  for (let direction = 0; direction < 8; direction++) for (let frame = 0; frame < 8; frame++) {
    const pixels = pose(rows, direction as Facing, frame);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const c = colors[pixels[y][x]];
      if (!c) continue;
      context.fillStyle = c; context.fillRect(frame * 40 + x * 2, direction * 40 + y * 2, 2, 2);
    }
    atlas.add(direction * 8 + frame, 0, frame * 40, direction * 40, 40, 40);
  }
  atlas.refresh();
  return name;
}
