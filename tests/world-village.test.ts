import { describe, it, expect } from 'vitest';
import { RULES, blocked, lineClear } from '@bandera/shared';
import { zone } from '@bandera/shared/rpg/zones';
import { roadPaths } from '@bandera/shared/rpg/terrain';

describe('el pueblo del Valle de Umbral', () => {
  const valle = zone('umbral');
  const props = valle.props ?? [];

  it('tiene lo que un pueblo de Warcraft III: ayuntamiento, casas, cuartel, torres, empalizada, portones y campos', () => {
    for (const kind of ['ayuntamiento', 'casa', 'cuartel', 'herreria', 'granero', 'torre', 'empalizada', 'porton', 'campo'] as const)
      expect(props.some((p) => p.kind === kind), kind).toBe(true);
  });

  it('cada edificio sólido es pared: los cuerpos no lo atraviesan', () => {
    for (const p of props.filter((q) => q.solid)) {
      expect(valle.terrain.walls.some((w) => w.x === p.x && w.y === p.y && w.w === p.w && w.h === p.h), p.kind).toBe(true);
      expect(blocked(p.x + p.w / 2, p.y + p.h / 2, RULES.radius, valle.terrain), p.kind).toBe(true);
    }
    for (const p of props.filter((q) => !q.solid && q.kind !== 'porton'))
      expect(valle.terrain.walls.some((w) => w.x === p.x && w.y === p.y), p.kind).toBe(false);
  });

  it('donde nacés y el altar quedan libres, y del altar se llega caminando a cada portón', () => {
    expect(blocked(valle.entry.x, valle.entry.y, RULES.radius, valle.terrain)).toBe(false);
    expect(blocked(valle.shrine.x, valle.shrine.y, RULES.radius, valle.terrain)).toBe(false);
    for (const gate of props.filter((p) => p.kind === 'porton')) {
      const middle = { x: gate.x + gate.w / 2, y: gate.y + gate.h / 2 };
      expect(blocked(middle.x, middle.y, RULES.radius, valle.terrain), 'portón').toBe(false);
    }
    const este = props.find((p) => p.kind === 'porton' && p.h > p.w)!;
    expect(lineClear(valle.shrine, { x: este.x + este.w / 2, y: este.y + este.h / 2 }, valle.terrain)).toBe(true);
  });

  it('los caminos salen del pueblo por los portones, no por encima de la empalizada', () => {
    const walls = props.filter((p) => p.kind === 'empalizada');
    for (const path of roadPaths('umbral'))
      for (const point of path)
        for (const w of walls)
          expect(point.x > w.x + 4 && point.x < w.x + w.w - 4 && point.y > w.y + 4 && point.y < w.y + w.h - 4, `camino sobre la empalizada en ${Math.round(point.x)},${Math.round(point.y)}`).toBe(false);
  });
});
