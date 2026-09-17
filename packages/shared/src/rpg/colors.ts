/**
 * The colour of every affinity and element, in one place. Skills, combos, projectiles, the HUD
 * and the generated icons all read it, so lightning is the same violet on a bolt, on an electrified
 * dagger, in a callout and on its icon.
 *
 * No imports: skills.ts and combos.ts both use it, and neither may load the other through it.
 */
export const AFFINITY_COLORS = {
  fuego: '#ff7a2f',
  agua: '#7dd8ff',
  tierra: '#c9a36b',
  viento: '#bff5e8',
  // Violet lightning, bright enough to read against grass and water; its core is almost white.
  rayo: '#b06bff',
  // Shadow is dark wine: blood it drinks, never mistaken for lightning's violet.
  sombra: '#8a2f5a',
  luz: '#fff1a8',
  fuerza: '#e0a060',
  destreza: '#8fe3b0',
  sigilo: '#8e9ab0',
} as const;

/** The pale core a bolt of each element is drawn with over its colour. */
export const ELEMENT_CORES = {
  fuego: '#ffe0a0',
  hielo: '#e6f9ff',
  viento: '#ffffff',
  rayo: '#f3e6ff',
  sombra: '#2a0f1f',
  luz: '#ffffff',
  tierra: '#6b5236',
  fisico: '#e3e5d5',
} as const;

export const ELEMENT_COLORS = {
  fuego: AFFINITY_COLORS.fuego,
  hielo: AFFINITY_COLORS.agua,
  viento: AFFINITY_COLORS.viento,
  rayo: AFFINITY_COLORS.rayo,
  sombra: AFFINITY_COLORS.sombra,
  luz: AFFINITY_COLORS.luz,
  tierra: AFFINITY_COLORS.tierra,
  fisico: '#b8ab94',
} as const;

/** Phaser wants numbers. */
export const hex = (color: string) => parseInt(color.slice(1), 16);
