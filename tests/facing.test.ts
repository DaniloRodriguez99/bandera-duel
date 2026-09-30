import { describe, expect, it } from 'vitest';
import { newPlayer } from '@bandera/shared';
import { Locomotion, facingFor, fighting } from '../packages/client/src/locomotion';

describe('hacia dónde mira el cuerpo', () => {
  it('en plena pelea: golpeando, cargando, preparando, recién disparado o con la guardia arriba', () => {
    const idle = newPlayer('p', 'P', 'blue', 'archer');
    expect(fighting(idle)).toBe(false);
    for (const change of [
      { move: 'guardian.sword:0:0' },
      { chargeSkill: 'guardian.sword' as const },
      { shotCharge: 0.2 },
      { specialCharge: 0.2 },
      { blackHoleCharge: 0.2 },
      { blinkCharge: 0.2 },
      { windup: 0.1 },
      { attackLock: 0.1 },
      { counterLeft: 0.1 },
    ])
      expect(fighting({ ...idle, ...change })).toBe(true);
  });

  it('mirar al apuntado gana a mirar hacia donde se camina', () => {
    const body = new Locomotion();
    body.update(100, 100, 16);
    // Walking east...
    body.update(110, 100, 16);
    expect(body.facing).toBe(facingFor(1, 0));
    // ...while striking west.
    body.face(-1, 0);
    expect(body.facing).toBe(facingFor(-1, 0));
    expect(body.frame(0)).toBe(facingFor(-1, 0) * 8 + 2 + Math.floor(body.phase));
  });
});
