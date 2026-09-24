import { expect, it } from 'vitest';
import { RULES, idleInput } from '@bandera/shared';
import { Practice, PRACTICE_PLAYER } from '../packages/client/src/practice.js';

it.each([650, 760])('Singularidad daña al dummy de práctica al apuntar a %i', (targetX) => {
  const practice = new Practice('mage');
  const mage = practice.duel.state.players.find((p) => p.id === PRACTICE_PLAYER)!;
  const dummy = practice.duel.state.players.find((p) => p.id === 'practice-dummy')!;
  mage.x = 600;
  mage.y = 270;

  const cast = idleInput(1);
  cast.slots.skill2.pressed = true;
  cast.aimX = targetX;
  cast.aimY = dummy.y;
  practice.step(cast);

  for (let i = 0; i < Math.ceil(5 / RULES.tick); i++) practice.step(idleInput());
  if (targetX !== 760) expect(dummy.x).toBeLessThan(760);

  for (let i = 0; i < Math.ceil(2 / RULES.tick); i++) practice.step(idleInput());
  expect(dummy.hp).toBeLessThan(dummy.maxHp);
});
