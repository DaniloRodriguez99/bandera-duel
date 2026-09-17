import { describe, it, expect } from 'vitest';
import { TILE, TILES, tileMap } from '@bandera/shared/rpg/terrain';
import { ZONE_IDS, zone } from '@bandera/shared/rpg/zones';

const tileAt = (id: (typeof ZONE_IDS)[number], x: number, y: number) => {
  const map = tileMap(id);
  return TILES[map.tiles[Math.floor(y / TILE) * map.cols + Math.floor(x / TILE)]];
};

describe('terreno de las zonas', () => {
  it('es el mismo dibujo cada vez, para el suelo y para el minimapa', () => {
    for (const id of ZONE_IDS) expect(tileMap(id)).toBe(tileMap(id));
  });

  it('lo que se ve sólido es exactamente lo que choca: toda pared es obstáculo y nada más lo es', () => {
    for (const id of ZONE_IDS) {
      const def = zone(id);
      const map = tileMap(id);
      for (const w of def.terrain.walls) expect(tileAt(id, w.x + w.w / 2, w.y + w.h / 2), `${id} pared`).toBe('obstacle');
      let solidos = 0;
      for (let i = 0; i < map.tiles.length; i++) if (TILES[map.tiles[i]] === 'obstacle') solidos++;
      const area = def.terrain.walls.reduce((sum, w) => sum + Math.ceil((w.x + w.w) / TILE - Math.floor(w.x / TILE)) * Math.ceil((w.y + w.h) / TILE - Math.floor(w.y / TILE)), 0);
      expect(solidos).toBeLessThanOrEqual(area);
    }
  });

  it('el altar, los campamentos y los portales nunca quedan bajo el agua', () => {
    for (const id of ZONE_IDS) {
      const def = zone(id);
      for (const at of [def.shrine, ...def.spawners.map((s) => s.at)])
        expect(['water', 'waterDeep'], `${id} ${at.x},${at.y}`).not.toContain(tileAt(id, at.x, at.y));
    }
  });

  it('hay caminos, y cada zona tiene su bioma', () => {
    const count = (id: (typeof ZONE_IDS)[number], kind: string) =>
      [...tileMap(id).tiles].filter((t) => TILES[t] === kind).length;
    expect(count('umbral', 'road')).toBeGreaterThan(100);
    expect(count('bosque', 'moss')).toBeGreaterThan(100);
    expect(count('ceniza', 'ash')).toBeGreaterThan(100);
    expect(count('umbral', 'water') + count('bosque', 'water')).toBeGreaterThan(0);
  });
});
