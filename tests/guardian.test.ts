import { describe, expect, it } from 'vitest';
import { CLASSES, Duel, RULES, idleInput, sanitizeInput, type ClassId, type Input, type Player } from '@bandera/shared';

const command = (value: Partial<Input> = {}): Input => ({ ...idleInput(), ...value });
const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);

function arena(enemy: ClassId = 'vanguard', third: ClassId = 'archer') {
  const duel = new Duel('courtyard', 'ffa3');
  const knight = duel.add('knight', 'Caballero', 'guardian');
  const rival = duel.add('rival', 'Rival', enemy);
  const other = duel.add('other', 'Otro', third);
  duel.state.phase = 'playing';
  Object.assign(knight, { x: 330, y: 270, angle: 0, invuln: 0 });
  Object.assign(rival, { x: 800, y: 270, angle: Math.PI, invuln: 0 });
  Object.assign(other, { x: 800, y: 430, angle: Math.PI, invuln: 0 });
  return { duel, knight, rival, other };
}

function run(duel: Duel, count: number, entries: [Player, Partial<Input>][] = []) {
  for (let i = 0; i < count; i++)
    duel.step(new Map(entries.map(([player, value]) => [player.id, command(value)])));
}

describe('caballero ofensivo', () => {
  it('usa espada rápida de 180° y golpea a varios enemigos sin fuego aliado', () => {
    expect(CLASSES.guardian).toMatchObject({ meleeRange: 60, meleeArc: Math.PI, windup: 0.1, meleeCooldown: 0.4, dash: true });
    const { duel, knight, rival, other } = arena();
    Object.assign(rival, { x: 382, y: 251, hp: 10, maxHp: 10 });
    Object.assign(other, { x: 382, y: 289, hp: 10, maxHp: 10 });
    run(duel, 1, [[knight, { sword: true }]]);
    run(duel, 4);
    expect(rival.hp).toBe(9);
    expect(other.hp).toBe(9);
    other.team = knight.team;
    rival.invuln = 0;
    other.invuln = 0;
    Object.assign(rival, { x: 382, y: 251 });
    Object.assign(other, { x: 382, y: 289 });
    knight.swordCd = 0;
    knight.attackLock = 0;
    run(duel, 1, [[knight, { sword: true }]]);
    run(duel, 4);
    expect(rival.hp).toBe(8);
    expect(other.hp).toBe(9);
  });

  it('carga 1,5 s hasta 2× y combina multiplicativamente con furia', () => {
    const { duel, knight, rival } = arena();
    Object.assign(rival, { x: 388, y: 270, hp: 10, maxHp: 10 });
    run(duel, 1, [[knight, { fury: true }]]);
    expect(knight.furyLeft).toBeCloseTo(RULES.furyDuration);
    run(duel, ticks(RULES.overchargeTime), [[knight, { charge: true }]]);
    run(duel, 1, [[knight, { sword: true }]]);
    run(duel, 4);
    expect(rival.hp).toBeCloseTo(10 - 2 * 1.4);
    expect(duel.state.events.some((event) => event.kind === 'fury')).toBe(true);
  });

  it('mantiene guardia sin límite, bloquea repetidamente y camina al 45 %', () => {
    const { duel, knight, rival } = arena();
    const start = knight.x;
    run(duel, ticks(1), [[knight, { guard: true, x: 1, angle: 0 }]]);
    expect(knight.guarding).toBe(true);
    expect(knight.guardCd).toBe(0);
    expect(knight.x - start).toBeCloseTo(CLASSES.guardian.speed * RULES.guardSpeed, 0);
    run(duel, ticks(7), [[knight, { guard: true, angle: 0 }]]);
    for (let i = 0; i < 3; i++) {
      knight.invuln = 0;
      expect(duel.damage(knight, rival, Math.PI, 1)).toBe(false);
    }
    expect(knight.hp).toBe(CLASSES.guardian.hp);
    expect(knight.guarding).toBe(true);
  });

  it('bloquea hielo, pero viento y trampas atraviesan sin bajar la guardia', () => {
    const { duel, knight, rival } = arena();
    run(duel, 1, [[knight, { guard: true }]]);
    expect(duel.damage(knight, rival, Math.PI, 0, { freeze: true })).toBe(false);
    expect(knight.frozenLeft).toBe(0);
    knight.invuln = 0;
    expect(duel.damage(knight, rival, Math.PI, 1, { pierce: true })).toBe(true);
    expect(knight.hp).toBe(2);
    expect(knight.guarding).toBe(true);
    knight.invuln = 0;
    duel.state.traps.push({ id: 99, owner: rival.id, team: rival.team, x: knight.x, y: knight.y, armLeft: 0, life: 1 });
    run(duel, 1, [[knight, { guard: true }]]);
    expect(knight.hp).toBe(1.5);
    expect(knight.guarding).toBe(true);
    run(duel, ticks(RULES.trapStun), [[knight, { guard: true }]]);
    expect(knight.guarding).toBe(true);
  });

  it('suelta la guardia al atacar, aturdirse, morir o embestir y aplica 1 s de recarga', () => {
    for (const action of ['sword', 'shieldBash', 'dash'] as const) {
      const { duel, knight } = arena();
      run(duel, 1, [[knight, { guard: true }]]);
      run(duel, 1, [[knight, { guard: true, [action]: true }]]);
      expect(knight.guarding).toBe(false);
      expect(knight.guardCd).toBeCloseTo(RULES.guardCooldown);
    }
    const stunned = arena();
    run(stunned.duel, 1, [[stunned.knight, { guard: true }]]);
    stunned.knight.stunLeft = 1;
    run(stunned.duel, 1, [[stunned.knight, { guard: true }]]);
    expect(stunned.knight.guarding).toBe(false);
    const dead = arena();
    run(dead.duel, 1, [[dead.knight, { guard: true }]]);
    dead.duel.damage(dead.knight, dead.rival, 0, 99);
    expect(dead.knight.guarding).toBe(false);
  });

  it('embiste unos 190 u, es vulnerable y daña una sola vez a cada enemigo', () => {
    const { duel, knight, rival, other } = arena('vanguard', 'necromancer');
    Object.assign(rival, { x: 365, y: 270, hp: 10, maxHp: 10 });
    Object.assign(other, { x: 430, y: 270, hp: 10, maxHp: 10 });
    run(duel, 1, [[other, { summon: true }]]);
    const zombie = duel.state.zombies[0];
    Object.assign(zombie, { x: 485, y: 270, spawnLeft: 0, frozenLeft: 99 });
    const zombieHp = zombie.hp;
    const start = knight.x;
    run(duel, 1, [[knight, { dash: true, x: 1 }]]);
    expect(knight.dashInvulnerable).toBe(false);
    expect(knight.dashCd).toBeCloseTo(RULES.guardianDashCooldown);
    run(duel, ticks(RULES.guardianDashDuration) + 1);
    expect(knight.x - start).toBeCloseTo(190, 0);
    expect(rival.hp).toBe(9);
    expect(other.hp).toBe(9);
    expect(zombie.hp).toBe(zombieHp - RULES.guardianDashDamage);
    knight.invuln = 0;
    expect(duel.damage(knight, rival, Math.PI, 1)).toBe(true);
  });

  it('la embestida no hiere aliados y se detiene ante paredes', () => {
    const friendly = arena();
    Object.assign(friendly.rival, { x: 365, y: 270, hp: 10, maxHp: 10, team: friendly.knight.team });
    run(friendly.duel, 12, [[friendly.knight, { dash: true, x: 1 }]]);
    expect(friendly.rival.hp).toBe(10);
    const blocked = arena();
    Object.assign(blocked.knight, { x: 395, y: 185, angle: 0 });
    run(blocked.duel, 12, [[blocked.knight, { dash: true, x: 1 }]]);
    expect(blocked.knight.x).toBeLessThanOrEqual(423 - RULES.radius + 1e-8);
  });

  it('Q daña, empuja y aturde 1,5 s; otro escudo frontal lo bloquea', () => {
    const open = arena();
    Object.assign(open.rival, { x: 370, y: 270, hp: 10, maxHp: 10 });
    run(open.duel, 1, [[open.knight, { shieldBash: true }]]);
    run(open.duel, ticks(RULES.shieldBashWindup));
    expect(open.rival.hp).toBe(9.5);
    expect(open.rival.stunLeft).toBeCloseTo(RULES.shieldBashStun);
    expect(open.rival.x).toBeGreaterThan(370);
    expect(open.knight.shieldBashCd).toBeGreaterThan(RULES.shieldBashCooldown - 0.3);

    const blocked = arena('guardian');
    Object.assign(blocked.rival, { x: 370, y: 270, angle: Math.PI, hp: 10, maxHp: 10 });
    run(blocked.duel, 1, [[blocked.rival, { guard: true, angle: Math.PI }]]);
    run(blocked.duel, 1, [[blocked.knight, { shieldBash: true }], [blocked.rival, { guard: true, angle: Math.PI }]]);
    run(blocked.duel, ticks(RULES.shieldBashWindup), [[blocked.rival, { guard: true, angle: Math.PI }]]);
    expect(blocked.rival.hp).toBe(10);
    expect(blocked.rival.stunLeft).toBe(0);
    expect(blocked.rival.guarding).toBe(true);
  });

  it('furia dura 5 s, recarga 15 s, revela arbustos y se cancela al morir', () => {
    const { duel, knight, rival } = arena();
    run(duel, 1, [[knight, { fury: true }]]);
    expect(knight.furyLeft).toBeCloseTo(5);
    expect(knight.furyCd).toBeCloseTo(15);
    expect(knight.revealLeft).toBeCloseTo(1.5);
    run(duel, ticks(5));
    expect(knight.furyLeft).toBe(0);
    knight.furyCd = 0;
    run(duel, 1, [[knight, { fury: true }]]);
    duel.resetArena();
    expect(knight.furyLeft).toBe(0);
    knight.furyCd = 0;
    run(duel, 1, [[knight, { fury: true }]]);
    knight.invuln = 0;
    duel.damage(knight, rival, 0, 99);
    expect(knight.furyLeft).toBe(0);
    duel.state.phase = 'finished';
    knight.furyLeft = 3;
    expect(duel.selectClass(knight.id, 'archer')).toBe(true);
    expect(knight.furyLeft).toBe(0);
  });

  it('rechaza habilidades manipuladas en otras clases y normaliza entradas inválidas', () => {
    const { duel, rival } = arena();
    run(duel, 1, [[rival, { shieldBash: true, fury: true }]]);
    expect(rival.shieldBashCd).toBe(0);
    expect(rival.furyCd).toBe(0);
    expect(sanitizeInput({ ...idleInput(), shieldBash: 'sí', fury: 1 })).toMatchObject({ shieldBash: false, fury: false });
  });
});
