import { describe, expect, it } from 'vitest';
import {
  bladeCrosses,
  curve,
  laneHit,
  sectorHit,
  waveFront,
  waveHalfWidth,
  wavePoint,
  waveSource,
  waveStrength,
  waveTouch,
  type Blade,
  type Sector,
  type WaveShape,
} from '@bandera/shared';

const deg = (value: number) => (value * Math.PI) / 180;

describe('curvas de datos', () => {
  it('une los puntos con rectas y queda plana más allá de los extremos', () => {
    const points = [[0, 1], [0.5, 0.8], [1, 0.4]] as const;
    expect(curve(points, -1)).toBe(1);
    expect(curve(points, 0.25)).toBeCloseTo(0.9);
    expect(curve(points, 0.75)).toBeCloseTo(0.6);
    expect(curve(points, 2)).toBe(0.4);
    expect(curve([], 3)).toBe(0);
  });
});

describe('el barrido de una hoja', () => {
  // A blade 58 long sweeping from the swordsman's right (+60°) to his left (−60°), facing east.
  const sweep: Sector = { x: 100, y: 100, from: deg(60), to: deg(-60), inner: 8, outer: 58 };

  it('toca a quien está dentro del arco y del alcance', () => {
    expect(sectorHit(sweep, { x: 140, y: 100 }, 12)).toBe(true);
    expect(sectorHit(sweep, { x: 100 + Math.cos(deg(50)) * 50, y: 100 + Math.sin(deg(50)) * 50 }, 12)).toBe(true);
  });

  it('no toca detrás, ni fuera del alcance, ni al costado del arco', () => {
    expect(sectorHit(sweep, { x: 60, y: 100 }, 12)).toBe(false);
    expect(sectorHit(sweep, { x: 100 + 58 + 12.5, y: 100 }, 12)).toBe(false);
    expect(sectorHit(sweep, { x: 100, y: 150 }, 12)).toBe(false);
  });

  it('cuenta el ancho del cuerpo: el borde de un cuerpo grande alcanza', () => {
    const edge = { x: 100 + Math.cos(deg(70)) * 50, y: 100 + Math.sin(deg(70)) * 50 };
    expect(sectorHit(sweep, edge, 2)).toBe(false);
    expect(sectorHit(sweep, edge, 12)).toBe(true);
    expect(sectorHit(sweep, { x: 100 + 58 + 10, y: 100 }, 12)).toBe(true);
  });

  it('un tramo fino del barrido solo toca a quien la hoja tiene delante en ese momento', () => {
    // The first third of the sweep: the blade is still on the right.
    const slice: Sector = { ...sweep, from: deg(60), to: deg(20) };
    expect(sectorHit(slice, { x: 100 + Math.cos(deg(40)) * 40, y: 100 + Math.sin(deg(40)) * 40 }, 6)).toBe(true);
    expect(sectorHit(slice, { x: 100 + Math.cos(deg(-40)) * 40, y: 100 + Math.sin(deg(-40)) * 40 }, 6)).toBe(false);
  });

  it('un barrido que cruza ±180° sigue siendo el camino corto', () => {
    const west: Sector = { x: 0, y: 0, from: deg(150), to: deg(-150), inner: 0, outer: 50 };
    expect(sectorHit(west, { x: -40, y: 0 }, 5)).toBe(true);
    expect(sectorHit(west, { x: 40, y: 0 }, 5)).toBe(false);
  });
});

describe('el corte vertical', () => {
  const lane = { x: 100, y: 100, angle: 0, near: 0, far: 84, halfWidth: 13 };
  it('es una franja hacia donde se apunta', () => {
    expect(laneHit(lane, { x: 170, y: 100 }, 12)).toBe(true);
    expect(laneHit(lane, { x: 170, y: 124 }, 12)).toBe(true);
    expect(laneHit(lane, { x: 170, y: 130 }, 12)).toBe(false);
    expect(laneHit(lane, { x: 60, y: 100 }, 12)).toBe(false);
    expect(laneHit(lane, { x: 200, y: 100 }, 12)).toBe(false);
  });
  it('gira con la puntería', () => {
    const down = { ...lane, angle: Math.PI / 2 };
    expect(laneHit(down, { x: 100, y: 170 }, 12)).toBe(true);
    expect(laneHit(down, { x: 170, y: 100 }, 12)).toBe(false);
  });
});

describe('cortar algo que vuela', () => {
  const blade: Blade = { kind: 'arc', x: 100, y: 100, from: deg(10), to: deg(-10), inner: 8, outer: 58 };
  it('lo encuentra aunque sus dos extremos queden fuera del tramo', () => {
    // Crossing the thin slice from one side to the other within one step.
    expect(bladeCrosses(blade, { x: 140, y: 80 }, { x: 140, y: 120 }, 3)).toBe(true);
    expect(bladeCrosses(blade, { x: 170, y: 80 }, { x: 170, y: 120 }, 3)).toBe(false);
    expect(bladeCrosses(blade, { x: 60, y: 80 }, { x: 60, y: 120 }, 3)).toBe(false);
  });
});

describe('el frente de un tajo que viaja', () => {
  const crescent: WaveShape = { x: 100, y: 200, angle: 0, halfWidth: 24, spread: 0, bow: 10, thickness: 16 };
  const fan: WaveShape = { ...crescent, halfWidth: 60, spread: 0.45, bow: 20 };

  it('el centro va adelante y las puntas atrás', () => {
    expect(waveFront(crescent, 100, 0)).toBe(100);
    expect(waveFront(crescent, 100, 1)).toBe(90);
    expect(wavePoint(crescent, 100, 0)).toEqual({ x: 200, y: 200 });
    expect(wavePoint(crescent, 100, 1).y).toBeCloseTo(224);
    expect(wavePoint(crescent, 100, -1).y).toBeCloseTo(176);
  });

  it('un tajo con apertura se ensancha a medida que avanza', () => {
    expect(waveHalfWidth(crescent, 500)).toBe(24);
    expect(waveHalfWidth(fan, 0)).toBe(60);
    expect(waveHalfWidth(fan, 900)).toBeCloseTo(465);
    // Each part of the front set out from its own point of the blade.
    expect(waveSource(fan, 1).y).toBeCloseTo(260);
    expect(waveSource(fan, 1).x).toBeCloseTo(100 - 20);
  });

  it('toca a un cuerpo cuando el frente le pasa por encima, y dice en qué parte', () => {
    const body = { x: 200, y: 212 };
    expect(waveTouch(crescent, 60, 66, body, 12)).toBeNull();
    const place = waveTouch(crescent, 94, 100, body, 12);
    expect(place).toBeCloseTo(0.5);
    // Past it: the front has moved on.
    expect(waveTouch(crescent, 130, 136, body, 12)).toBeNull();
    // Beside it: out of its width.
    expect(waveTouch(crescent, 94, 100, { x: 200, y: 240 }, 12)).toBeNull();
    // Behind the blade it left from.
    expect(waveTouch(crescent, 0, 6, { x: 60, y: 200 }, 12)).toBeNull();
  });

  it('ningún paso salta a un cuerpo: los tramos consecutivos se tocan', () => {
    const body = { x: 300, y: 200 };
    let touched = 0;
    for (let travelled = 0; travelled < 400; travelled += 6)
      if (waveTouch(crescent, travelled, travelled + 6, body, 12) !== null) touched++;
    expect(touched).toBeGreaterThan(0);
  });

  it('los huecos cortados quitan su parte del daño', () => {
    const gaps = [{ from: -0.2, to: 0.2, strength: 1 }, { from: 0.5, to: 1.2, strength: 0.5 }];
    expect(waveStrength(gaps, 0)).toBe(0);
    expect(waveStrength(gaps, 0.3)).toBe(1);
    expect(waveStrength(gaps, 0.8)).toBe(0.5);
    expect(waveStrength([], 0)).toBe(1);
  });
});
