import { describe, expect, it } from 'vitest';
import { WARRIOR_SLASH_CHARGE, WARRIOR_SWORD_CHARGE, newPlayer, warriorWave } from '@bandera/shared';
import { blueprintSpec } from '../packages/client/src/targeting';

describe('la guía de los tajos del Guerrero', () => {
  const warrior = (change: Record<string, unknown>) => ({ ...newPlayer('w', 'W', 'blue', 'vanguard'), x: 200, y: 270, ...change });

  it('la Creciente cargada muestra todo su alcance, aunque haya muros delante', () => {
    const p = warrior({ chargeSkill: 'vanguard.slash', chargeT: WARRIOR_SLASH_CHARGE.cap });
    const spec = blueprintSpec(p, 'slash')!;
    expect(spec.wave?.piercing).toBe(true);
    expect(spec.wave!.range).toBeGreaterThanOrEqual(warriorWave(WARRIOR_SLASH_CHARGE.cap).range);
  });

  it('el mandoble cargado muestra su tajo hasta media arena', () => {
    const p = warrior({ chargeSkill: 'vanguard.sword', chargeT: WARRIOR_SWORD_CHARGE.cap });
    const spec = blueprintSpec(p, 'sword')!;
    expect(spec.wave?.piercing).toBe(true);
    expect(spec.wave!.range).toBeGreaterThan(470);
    // A tap is the blow itself, in reach of the blade, with no slash to show.
    const tap = blueprintSpec(warrior({}), 'sword')!;
    expect(tap.wave).toBeUndefined();
  });
});
