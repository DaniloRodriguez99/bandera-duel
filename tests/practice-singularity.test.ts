import { expect, it } from 'vitest';
import { RULES, idleInput } from '@bandera/shared';
import { Practice, PRACTICE_PLAYER } from '../packages/client/src/practice.js';

it.each([650, 760])('Singularidad daña al dummy de práctica al apuntar a %i', (targetX) => {
  const practice = new Practice('mage');
  const mage = practice.duel.state.players.find((p) => p.id === PRACTICE_PLAYER)!;
  const dummy = practice.duel.state.players.find((p) => p.id === 'practice-dummy')!;
  mage.x = 600;
  mage.y = 270;

  const key = (state: { pressed?: boolean; held?: boolean; released?: boolean }) => {
    const input = idleInput(1);
    input.slots.skill2 = { pressed: false, held: false, released: false, ...state };
    input.aimX = targetX;
    input.aimY = dummy.y;
    return input;
  };
  practice.step(key({ pressed: true, held: true }));
  for (let i = 1; i < Math.ceil(1 / RULES.tick); i++) practice.step(key({ held: true }));
  practice.step(key({ released: true }));

  for (let i = 0; i < Math.ceil(2 / RULES.tick); i++) practice.step(idleInput());
  if (targetX !== 760) expect(dummy.x).toBeLessThan(760);

  for (let i = 0; i < Math.ceil(1.5 / RULES.tick); i++) practice.step(idleInput());
  expect(dummy.hp).toBeLessThan(dummy.maxHp);
});
