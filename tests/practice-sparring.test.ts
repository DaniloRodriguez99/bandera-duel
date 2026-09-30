import { describe, expect, it } from 'vitest';
import { CLASSES, RULES, idleInput, type Input, type SkillSlot, type SlotInputState } from '@bandera/shared';
import { Practice, SPARRING, validSparring } from '../packages/client/src/practice';

const ticks = (seconds: number) => Math.round(seconds / RULES.tick);
const key = (slot: SkillSlot, state: Partial<SlotInputState>, extra: Partial<Input> = {}): Input => {
  const input = { ...idleInput(1), ...extra };
  input.slots[slot] = { pressed: false, held: false, released: false, ...state };
  return input;
};

describe('rival de práctica', () => {
  it('cada modo usa su clase, y uno desconocido no vale', () => {
    for (const [mode, { classId }] of Object.entries(SPARRING))
      expect(new Practice('guardian', 'Vos', 'courtyard', undefined, mode as keyof typeof SPARRING).duel.state.players[1].classId).toBe(classId);
    expect(validSparring('arrows')).toBe(true);
    expect(validSparring('nuke')).toBe(false);
  });

  it('inmóvil: no ataca, no gira y vuelve a su lugar al reaparecer', () => {
    const practice = new Practice('archer');
    const dummy = practice.duel.state.players[1];
    for (let i = 0; i < ticks(3); i++) practice.step(idleInput(i));
    expect(practice.duel.state.arrows).toHaveLength(0);
    expect([dummy.x, dummy.y, dummy.angle]).toEqual([760, 270, Math.PI]);
  });

  it('dispara flechas hacia el jugador con un ritmo fijo', () => {
    const practice = new Practice('guardian', 'Vos', 'courtyard', undefined, 'arrows');
    const shots = () => practice.duel.state.events.filter((event) => event.kind === 'shot').length;
    let fired = 0;
    let last = 0;
    const [player, dummy] = practice.duel.state.players;
    Object.assign(player, { x: 300, y: 270, hp: 99, maxHp: 99 });
    for (let i = 0; i < ticks(4.5); i++) {
      practice.step(idleInput(i));
      if (shots() > last) fired++;
      last = shots();
    }
    // One at 1.4 s, 2.8 s and 4.2 s, aimed at where the player stands.
    expect(fired).toBe(3);
    expect(dummy.angle).toBeCloseTo(Math.PI);
    expect(player.hp).toBeLessThan(99);
  });

  it('el Caballero corta esas flechas con un corte cargado a tiempo', () => {
    const practice = new Practice('guardian', 'Vos', 'courtyard', undefined, 'arrows');
    const [player] = practice.duel.state.players;
    Object.assign(player, { x: 300, y: 270, hp: 99, maxHp: 99 });
    // A full charge held facing the rival, let go as each arrow arrives.
    let cuts = 0;
    for (let i = 0; i < ticks(12); i++) {
      const arriving = practice.duel.state.arrows.some((arrow) => arrow.x - player.x < 150);
      const holding = player.chargeSkill === 'guardian.sword';
      practice.step(
        arriving && holding && player.chargeT >= 1.4
          ? key('primary', { released: true })
          : key('primary', { pressed: !holding, held: true }),
      );
      cuts = practice.duel.state.events.filter((event) => event.kind === 'projectileCut').length || cuts;
    }
    expect(cuts).toBeGreaterThan(0);
  });

  it('lanza orbes a plena carga, sin su escudo', () => {
    const practice = new Practice('guardian', 'Vos', 'courtyard', undefined, 'orbs');
    const [player, dummy] = practice.duel.state.players;
    Object.assign(player, { x: 300, y: 270, hp: 99, maxHp: 99 });
    expect(dummy.magicShieldHits).toBe(0);
    let strongest = 0;
    for (let i = 0; i < ticks(3); i++) {
      practice.step(idleInput(i));
      for (const arrow of practice.duel.state.arrows) strongest = Math.max(strongest, arrow.power ?? 0);
    }
    expect(strongest).toBe(1);
    expect(99 - player.hp).toBeCloseTo(2.5);
  });

  it('el que lanza tajos carga una Creciente Escarlata a ritmo fijo, y el Guerrero se la puede devolver', () => {
    const practice = new Practice('vanguard', 'Vos', 'courtyard', undefined, 'waves');
    const [player, dummy] = practice.duel.state.players;
    Object.assign(player, { x: 400, y: 270, angle: 0, hp: 99, maxHp: 99 });
    let thrown = 0;
    let before = 0;
    let parried = false;
    for (let i = 0; i < ticks(8); i++) {
      const wave = practice.duel.state.waves.find((w) => w.owner === dummy.id);
      // Face the dummy and raise the guard as its crescent arrives.
      const input = wave && player.x - (wave.x - wave.travelled) > -60 && !player.counterCd
        ? key('e', { pressed: true }, { angle: 0 })
        : idleInput(i, 0);
      practice.step(input);
      const now = practice.duel.state.waves.filter((w) => w.owner === dummy.id).length;
      if (now > before) thrown++;
      before = now;
      parried ||= practice.duel.state.waves.some((w) => w.owner === player.id);
    }
    // One every 3.5 s, charged past its first step.
    expect(thrown).toBe(2);
    expect(parried).toBe(true);
  });

  it('el que ataca con espada se acerca a medio paso y encadena cortes al llegar', () => {
    const practice = new Practice('archer', 'Vos', 'courtyard', undefined, 'blade');
    const [player, dummy] = practice.duel.state.players;
    Object.assign(player, { x: 560, y: 270, hp: 99, maxHp: 99 });
    const from = dummy.x;
    for (let i = 0; i < ticks(1); i++) practice.step(idleInput(i));
    expect(from - dummy.x).toBeCloseTo(CLASSES.guardian.speed * 0.5, -1);
    for (let i = 0; i < ticks(3); i++) practice.step(idleInput(i));
    expect(player.hp).toBeLessThan(99);
    expect(practice.duel.state.events.some((event) => event.kind === 'swing')).toBe(true);
  });
});
