// Builds the world's icons from the game-icons.net glyphs in assets-src/game-icons (CC BY 3.0):
// each glyph framed and tinted with its element or rarity colour. Run after changing skills or items:
//   pnpm run build -w @bandera/shared && node scripts/build-icons.mjs
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { SKILLS_WORLD, AFFINITIES } from '@bandera/shared/rpg/skills';
import { ITEMS } from '@bandera/shared/rpg/items';

const SRC = 'assets-src/game-icons';
const OUT = 'packages/client/public/assets/icons';
const { glyphs } = JSON.parse(readFileSync(`${SRC}/map.json`, 'utf8'));
mkdirSync(OUT, { recursive: true });

const AFFINITY_COLOR = {
  fuego: '#ff7a2f', agua: '#4fa8e0', tierra: '#b8894f', viento: '#8fd8e8', rayo: '#e6d23a',
  sombra: '#8a5ad0', luz: '#f0d060', fuerza: '#d0803a', destreza: '#4fbf7a', sigilo: '#3f9a6a',
};
const RARITY_COLOR = { comun: '#7a8a96', rara: '#3a86d8', epica: '#9a5ae0', legendaria: '#d8a020', unica: '#e0406a' };
const ELEMENT_COLOR = {
  fuego: '#ff7a2f', hielo: '#4fa8e0', viento: '#8fd8e8', rayo: '#e6d23a', sombra: '#8a5ad0',
  luz: '#f0d060', tierra: '#b8894f', fisico: '#8a7a64',
};

const shade = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * amount)));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
};

/** Only the white glyph paths: the source's black backdrop is dropped for our own frame. */
function glyphPaths(name) {
  const svg = readFileSync(`${SRC}/${name}.svg`, 'utf8');
  return [...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*\/>/g)]
    .filter((m) => !/^M0 0h512v512H0z$/.test(m[1]))
    .map((m) => `<path d="${m[1]}"/>`)
    .join('');
}

let written = 0;
/** A combo: the weapon's glyph large, and the affinity's glyph in a badge over its corner. */
function comboIcon(key, weaponGlyph, badgeGlyph, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<defs><radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${shade(color, 1.15)}"/>` +
    `<stop offset=".6" stop-color="${shade(color, 0.55)}"/><stop offset="1" stop-color="${shade(color, 0.22)}"/></radialGradient></defs>` +
    `<rect width="512" height="512" rx="44" fill="#0a0806"/>` +
    `<rect x="18" y="18" width="476" height="476" rx="34" fill="url(#g)"/>` +
    `<rect x="18" y="18" width="476" height="476" rx="34" fill="none" stroke="${shade(color, 1.4)}" stroke-opacity=".55" stroke-width="10"/>` +
    `<g transform="translate(46 86) scale(.68)" fill="#fff" stroke="#000" stroke-opacity=".45" stroke-width="18" paint-order="stroke">${glyphPaths(weaponGlyph)}</g>` +
    `<circle cx="378" cy="134" r="104" fill="${shade(color, 0.35)}" stroke="${shade(color, 1.5)}" stroke-width="12"/>` +
    `<g transform="translate(298 54) scale(.3125)" fill="${shade(color, 1.6)}">${glyphPaths(badgeGlyph)}</g>` +
    `</svg>`;
  writeFileSync(`${OUT}/${key}.svg`, svg);
  written++;
}

function icon(key, glyph, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<defs><radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${shade(color, 1.15)}"/>` +
    `<stop offset=".6" stop-color="${shade(color, 0.55)}"/><stop offset="1" stop-color="${shade(color, 0.22)}"/></radialGradient></defs>` +
    `<rect width="512" height="512" rx="44" fill="#0a0806"/>` +
    `<rect x="18" y="18" width="476" height="476" rx="34" fill="url(#g)"/>` +
    `<rect x="18" y="18" width="476" height="476" rx="34" fill="none" stroke="${shade(color, 1.4)}" stroke-opacity=".55" stroke-width="10"/>` +
    `<g transform="translate(66 66) scale(.742)" fill="#fff" stroke="#000" stroke-opacity=".45" stroke-width="18" paint-order="stroke">${glyphPaths(glyph)}</g>` +
    `</svg>`;
  writeFileSync(`${OUT}/${key}.svg`, svg);
  written++;
}

const affinityColor = (school) => AFFINITY_COLOR[school] ?? (school === 'monstruo' ? '#a05a4a' : '#9a8a70');
const WEAPON_GLYPH = { espada: 'broadsword', baston: 'crescent-staff', arco: 'bow-arrow', daga: 'plain-dagger', escudo: 'spiked-shield' };
const AFFINITY_BADGE = {
  fuego: glyphs['el-fuego'], agua: glyphs['el-hielo'], tierra: glyphs['el-tierra'], viento: glyphs['el-viento'],
  rayo: glyphs['el-rayo'], sombra: glyphs['el-sombra'], luz: glyphs['el-luz'],
  fuerza: 'muscle-up', destreza: 'sprint', sigilo: 'cloak-dagger',
};
for (const skill of Object.values(SKILLS_WORLD)) {
  if (skill.weapon) {
    comboIcon(`skill-${skill.id}`, WEAPON_GLYPH[skill.weapon], AFFINITY_BADGE[skill.school], skill.color);
    continue;
  }
  const glyph = glyphs[skill.id];
  if (!glyph) throw new Error(`Sin glifo para la habilidad ${skill.id}`);
  icon(`skill-${skill.id}`, glyph, affinityColor(skill.school));
  icon(`grimorio-${skill.id}`, glyphs.grimorio, affinityColor(skill.school));
}
for (const affinity of AFFINITIES) icon(`tomo-${affinity}`, glyphs.tomo, AFFINITY_COLOR[affinity]);
for (const item of Object.values(ITEMS)) {
  if (item.kind === 'grimorio') continue;
  const glyph = glyphs[item.id];
  if (!glyph) throw new Error(`Sin glifo para el objeto ${item.id}`);
  icon(`item-${item.id}`, glyph, RARITY_COLOR[item.rarity]);
}
icon('item-manual_practica', glyphs.manual_practica, RARITY_COLOR.rara);
icon('item-fragmento_reflejo', glyphs.fragmento_reflejo, RARITY_COLOR.unica);
for (const [element, color] of Object.entries(ELEMENT_COLOR)) icon(`el-${element}`, glyphs[`el-${element}`], color);
copyFileSync(`${SRC}/CREDITS.md`, `${OUT}/CREDITS.md`);
console.log(`${written} íconos en ${OUT}`);
