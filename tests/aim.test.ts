import { describe, expect, it } from 'vitest';
import { ARENA_BOUNDS } from '@bandera/shared';
import { Aim } from '../packages/client/src/aim';

/** A camera that shows the arena as it is: screen and world coordinates match. */
const toWorld = (x: number, y: number) => ({ x, y });
const resolve = (aim: Aim, origin: { x: number; y: number }, reach = 150) =>
  aim.resolve(origin, toWorld, ARENA_BOUNDS, reach);

describe('un solo aimDirection para todas las entradas', () => {
  it('el mouse sigue apuntando al cursor aunque el personaje camine sin moverlo', () => {
    const aim = new Aim();
    aim.pointer(500, 270);
    resolve(aim, { x: 100, y: 270 });
    expect(aim.angle).toBeCloseTo(0);
    // The character strafes down; the mouse has not moved.
    resolve(aim, { x: 100, y: 470 });
    expect(aim.angle).toBeCloseTo(Math.atan2(-200, 400));
    expect([aim.x, aim.y]).toEqual([500, 270]);
    expect(aim.pointed).toBe(true);
  });

  it('el cursor se vuelve a leer con la cámara de cada cuadro', () => {
    const aim = new Aim();
    aim.pointer(480, 270);
    aim.resolve({ x: 480, y: 100 }, toWorld, ARENA_BOUNDS, 150);
    expect(aim.angle).toBeCloseTo(Math.PI / 2);
    // The camera scrolled 300 to the right: the same spot of the screen is another place.
    aim.resolve({ x: 480, y: 100 }, (x, y) => ({ x: x + 300, y }), ARENA_BOUNDS, 150);
    expect(aim.x).toBe(780);
    expect(aim.angle).toBeCloseTo(Math.atan2(170, 300));
  });

  it('una palanca da dirección y, al soltarla, se conserva la última', () => {
    const aim = new Aim();
    expect(aim.direction(0, -40, 'stick', 8)).toBe(true);
    resolve(aim, { x: 400, y: 300 });
    expect(aim.angle).toBeCloseTo(-Math.PI / 2);
    expect([aim.x, aim.y]).toEqual([400, 150]);
    expect(aim.pointed).toBe(false);
    // Back at the centre (or let go): inside the deadzone nothing changes.
    expect(aim.direction(2, 3, 'stick', 8)).toBe(false);
    expect(aim.direction(0, 0, 'stick', 8)).toBe(false);
    resolve(aim, { x: 430, y: 300 });
    expect(aim.angle).toBeCloseTo(-Math.PI / 2);
    expect(aim.source).toBe('stick');
  });

  it('moverse nunca cambia la puntería de una palanca', () => {
    const aim = new Aim();
    aim.direction(1, 0, 'stick');
    for (const origin of [{ x: 200, y: 200 }, { x: 200, y: 400 }, { x: 600, y: 90 }]) {
      resolve(aim, origin);
      expect(aim.angle).toBeCloseTo(0);
      expect(aim.y).toBeCloseTo(origin.y);
    }
  });

  it('cerca del borde el punto queda sobre el rayo, sin torcer la dirección', () => {
    const aim = new Aim();
    aim.direction(1, 1, 'stick');
    const origin = { x: ARENA_BOUNDS.maxX - 30, y: 200 };
    resolve(aim, origin);
    expect(aim.x).toBeCloseTo(ARENA_BOUNDS.maxX);
    expect(Math.atan2(aim.y - origin.y, aim.x - origin.x)).toBeCloseTo(Math.PI / 4);
  });

  it('un punto del mapa tocado con el dedo es el objetivo, y cada fuente reemplaza a la anterior', () => {
    const aim = new Aim();
    aim.target({ x: 700, y: 100 });
    resolve(aim, { x: 300, y: 100 });
    expect([aim.x, aim.y, aim.pointed]).toEqual([700, 100, true]);
    expect(aim.angle).toBeCloseTo(0);
    aim.direction(0, 1, 'keys');
    resolve(aim, { x: 300, y: 100 });
    expect(aim.pointed).toBe(false);
    expect(aim.source).toBe('keys');
    expect(aim.angle).toBeCloseTo(Math.PI / 2);
    aim.pointer(100, 100);
    resolve(aim, { x: 300, y: 100 });
    expect(aim.source).toBe('pointer');
    expect(aim.angle).toBeCloseTo(Math.PI);
  });

  it('un cursor fuera de la arena apunta hacia él y deja el punto dentro', () => {
    const aim = new Aim();
    aim.pointer(ARENA_BOUNDS.maxX + 200, 270);
    resolve(aim, { x: 900, y: 270 });
    expect(aim.angle).toBeCloseTo(0);
    expect(aim.x).toBe(ARENA_BOUNDS.maxX);
  });
});
