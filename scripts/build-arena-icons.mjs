// Draws the arena skill icons that are vector art (the knight's techniques), and rasterises them to
// the 128 px PNGs the HUD loads from packages/client/public/assets/skills. Run after changing one:
//   node scripts/build-arena-icons.mjs
// It renders with the Chromium that Playwright installs for the browser tests.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'packages/client/public/assets/skills';
const SIZE = 128;

/** A card in the arena's style: a dark vignette, the art, and a thin rim in the skill's colour. */
const card = (rim, background, art) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${SIZE}" height="${SIZE}">` +
  `<defs>` +
  `<radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${background[0]}"/><stop offset="1" stop-color="${background[1]}"/></radialGradient>` +
  `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>` +
  `<filter id="haze" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter>` +
  `</defs>` +
  `<rect width="64" height="64" rx="7" fill="url(#bg)"/>` +
  art +
  `<rect x=".75" y=".75" width="62.5" height="62.5" rx="6.6" fill="none" stroke="${rim}" stroke-opacity=".55" stroke-width="1.5"/>` +
  `</svg>`;

/** A four-pointed glint. */
const glint = (x, y, r, color) =>
  `<path d="M${x} ${y - r} L${x + r * 0.22} ${y - r * 0.22} L${x + r} ${y} L${x + r * 0.22} ${y + r * 0.22} L${x} ${y + r} L${x - r * 0.22} ${y + r * 0.22} L${x - r} ${y} L${x - r * 0.22} ${y - r * 0.22} Z" fill="${color}"/>`;

/** A longsword along +x, centred on the origin, 50 units from pommel to tip. */
const sword = (blade = '#eef3f6', edge = '#10151a') =>
  `<circle cx="-22" cy="0" r="3.2" fill="#c9a24a" stroke="#1b1206" stroke-width="1.2"/>` +
  `<rect x="-20" y="-2.2" width="9" height="4.4" rx="1.4" fill="#5a3a1c" stroke="#1b1206" stroke-width="1.2"/>` +
  `<rect x="-11.5" y="-8.5" width="3.6" height="17" rx="1.4" fill="#d8b25a" stroke="#1b1206" stroke-width="1.2"/>` +
  `<path d="M-7.6 -3.2 L17 -3.2 L25 0 L17 3.2 L-7.6 3.2 Z" fill="${blade}" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round"/>` +
  `<path d="M-6 0 L16 0" stroke="#8fa3b0" stroke-width="1.1"/>`;

/** A lightning bolt from one point to another, broken into `steps` jags. */
function bolt(x1, y1, x2, y2, steps, jag, seed) {
  let s = seed;
  const random = () => ((s = (s * 9301 + 49297) % 233280) / 233280) * 2 - 1;
  const nx = -(y2 - y1), ny = x2 - x1, len = Math.hypot(nx, ny);
  const points = [[x1, y1]];
  for (let i = 1; i < steps; i++) {
    const t = i / steps, off = random() * jag;
    points.push([x1 + (x2 - x1) * t + (nx / len) * off, y1 + (y2 - y1) * t + (ny / len) * off]);
  }
  points.push([x2, y2]);
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

const ICONS = {
  // Q · Corte Celestial: one long, narrow white-gold cut across the whole card, and the blade that
  // threw it. Precision, not mass.
  'guardian-flurry': card('#ffd35a', ['#2a2a3a', '#06060a'],
    `<path d="M2 48 Q30 14 62 19 Q31 25 2 48 Z" fill="#ffd35a" opacity=".6" filter="url(#haze)"/>` +
    `<path d="M2 48 Q30 14 62 19 Q31 25 2 48 Z" fill="#ffc93a" filter="url(#glow)"/>` +
    `<path d="M2 48 Q30 16.5 62 19 Q31 23 2 48 Z" fill="#fff6d6"/>` +
    `<path d="M7 44 Q31 18.5 58 19.6" fill="none" stroke="#ffffff" stroke-width="1.1"/>` +
    `<path d="M10 52 Q30 34 50 31" fill="none" stroke="#ffd35a" stroke-width=".8" opacity=".6"/>` +
    `<g transform="translate(25 51) rotate(-22) scale(.74)">${sword()}</g>` +
    glint(54, 13, 5.5, '#fff2b8') + glint(10, 34, 3, '#ffd35a') + glint(47, 33, 2.2, '#ffffff')),

  // Space · Paso Relámpago: the body let go as lightning, toward where it aims.
  'guardian-step': card('#5cc8ff', ['#14263a', '#04070c'],
    `<path d="M8 50 L24 42 M6 40 L20 34 M12 58 L26 49" stroke="#5cc8ff" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
    `<path d="${bolt(14, 50, 56, 12, 6, 7, 7)}" fill="none" stroke="#5cc8ff" stroke-width="6" stroke-linejoin="round" opacity=".6" filter="url(#glow)"/>` +
    `<path d="${bolt(14, 50, 56, 12, 6, 7, 7)}" fill="none" stroke="#f2fbff" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="${bolt(26, 44, 44, 38, 3, 4, 3)}" fill="none" stroke="#9fe1ff" stroke-width="1.1"/>` +
    `<path d="M47 9 L58 9 L58 20" fill="none" stroke="#f2fbff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    glint(56, 12, 4.5, '#ffffff')),

  // R · Despertar del Relámpago: the mandala going through, the blade taken by violet lightning.
  'guardian-awaken': card('#b56cff', ['#2a1440', '#07040c'],
    `<circle cx="32" cy="32" r="22" fill="none" stroke="#a64fe0" stroke-width="5" opacity=".35" filter="url(#glow)"/>` +
    `<circle cx="32" cy="32" r="22" fill="none" stroke="#e2c4ff" stroke-width="1.2"/>` +
    `<circle cx="32" cy="32" r="17" fill="none" stroke="#b56cff" stroke-width=".8" stroke-dasharray="2.2 1.6"/>` +
    `<path d="M32 13 L48.5 41.5 L15.5 41.5 Z M32 51 L15.5 22.5 L48.5 22.5 Z" fill="none" stroke="#c99bff" stroke-width=".9" opacity=".85"/>` +
    Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2, x = 32 + Math.cos(a) * 22, y = 32 + Math.sin(a) * 22;
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.3" fill="#f0d8ff"/>`;
    }).join('') +
    `<g transform="translate(32 33) rotate(-90) scale(.78)">${sword('#f3e6ff', '#1a0b24')}</g>` +
    `<path d="${bolt(22, 16, 30, 50, 5, 5, 11)}" fill="none" stroke="#d9a6ff" stroke-width="1.6" stroke-linejoin="round" filter="url(#glow)"/>` +
    `<path d="${bolt(42, 14, 35, 48, 5, 5, 5)}" fill="none" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"/>` +
    glint(32, 8, 3.5, '#ffffff')),
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
for (const [name, svg] of Object.entries(ICONS)) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  writeFileSync(`${OUT}/${name}.png`, await page.locator('svg').screenshot({ omitBackground: true }));
}
await browser.close();
console.log(`${Object.keys(ICONS).length} íconos en ${OUT}`);
