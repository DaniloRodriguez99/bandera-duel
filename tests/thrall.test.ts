import { describe, it, expect } from 'vitest';
import {
  Duel,
  CLASSES,
  RULES,
  type Arrow,
  type ClassId,
  type GameEvent,
  type Player,
  type ThrallSkill,
  type Zombie,
} from '@bandera/shared';
const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
type Spawner = {
  newZombie(owner: Player, at: { x: number; y: number }, fallback: { x: number; y: number }, extra: Partial<Zombie>): Zombie;
};
/** A necromancer (automatic zombies) with a revived player of `classId` and a sturdy rival far away. */
function setup(classId: ClassId) {
  const d = new Duel('courtyard', 'ffa3');
  const n = d.add('n', 'N', 'necromancer'),
    foe = d.add('f', 'F', 'guardian'),
    far = d.add('g', 'G', 'archer');
  d.state.phase = 'playing';
  Object.assign(n, { x: 80, y: 270, zombieAuto: true });
  Object.assign(foe, { x: 880, y: 100, hp: 99 });
  Object.assign(far, { x: 880, y: 500 });
  const hp = CLASSES[classId].hp;
  const thrall = (d as unknown as Spawner).newZombie(n, { x: 300, y: 270 }, n, {
    kind: 'thrall',
    bonus: true,
    hp,
    maxHp: hp,
    life: 9999,
    classId,
    name: 'T',
    shieldHits: classId === 'mage' ? RULES.magicShieldHits : 0,
  });
  d.state.zombies.push(thrall);
  const arrows = new Map<number, Arrow>();
  const events: GameEvent[] = [];
  const actions = new Set<ThrallSkill>();
  let lastEvent = 0;
  const run = (count: number) => {
    for (let i = 0; i < count; i++) {
      d.step(new Map());
      for (const arrow of d.state.arrows) if (!arrows.has(arrow.id)) arrows.set(arrow.id, { ...arrow });
      for (const e of d.state.events)
        if (e.id > lastEvent) {
          events.push(e);
          lastEvent = e.id;
        }
      if (thrall.action) actions.add(thrall.action.skill);
    }
  };
  return { d, n, foe, thrall, run, shots: () => [...arrows.values()].filter((a) => a.owner === 'n'), events, actions };
}
const incoming = (d: Duel, from: Player, at: { x: number; y: number }): Arrow => ({
  id: 9999,
  owner: from.id,
  team: from.team,
  classId: 'archer',
  x: at.x,
  y: at.y,
  angle: Math.PI,
  life: 1,
});
describe('esclavos que pelean con sus habilidades', () => {
  it('arquero: triple y flecha cargada; si se le acercan pone trampa y salta disparando viento', () => {
    const { d, n, foe, thrall, run, shots, events, actions } = setup('archer');
    Object.assign(foe, { x: 520, y: 270 });
    run(ticks(4));
    expect(shots().some((a) => a.volley !== undefined && !a.wind)).toBe(true);
    expect(shots().some((a) => a.charged && !a.wind)).toBe(true);
    expect(events.some((e) => e.kind === 'hit' && e.team === n.team)).toBe(true);
    Object.assign(foe, { x: thrall.x + 50, y: thrall.y });
    run(ticks(1));
    expect(d.state.traps.some((t) => t.owner === n.id)).toBe(true);
    expect(actions.has('dash')).toBe(true);
    expect(shots().some((a) => a.wind)).toBe(true);
  });
  it('mago: bola de hielo y en seguida la bola de fuego cargada; el escudo mágico absorbe golpes', () => {
    const { d, foe, thrall, run, shots } = setup('mage');
    expect(thrall.shieldHits).toBe(RULES.magicShieldHits);
    d.damageZombie(thrall, foe.team, 1, Math.PI);
    expect(thrall.hp).toBe(CLASSES.mage.hp);
    expect(thrall.shieldHits).toBe(RULES.magicShieldHits - 1);
    Object.assign(foe, { x: 520, y: 270 });
    run(ticks(3));
    const list = shots();
    const ice = list.findIndex((a) => a.ice);
    const big = list.findIndex((a) => a.classId === 'mage' && (a.power ?? 0) >= 1);
    expect(ice).toBeGreaterThanOrEqual(0);
    expect(big).toBeGreaterThan(ice);
  });
  it('nigromante: invoca zombies y un zombie mago sin ocupar el tope del jugador, lanza fuego cargado y resucita', () => {
    const { d, n, foe, thrall, run, shots } = setup('necromancer');
    const mine = () => d.state.zombies.filter((z) => z.summoner === thrall.id);
    run(ticks(1));
    expect(mine().some((z) => z.kind === 'hat')).toBe(true);
    expect(mine().filter((z) => z.kind === 'brute').length).toBeGreaterThanOrEqual(2);
    expect(n.activeExecutions).toBe(0);
    expect(n.hatAlive).toBe(false);
    Object.assign(foe, { x: thrall.x + 180, y: thrall.y });
    run(ticks(3));
    expect(shots().some((a) => a.classId === 'necromancer' && (a.power ?? 0) >= 1)).toBe(true);
    Object.assign(foe, { x: 880, y: 100 });
    d.state.graves.push({ x: thrall.x + 40, y: thrall.y, classId: 'necromancer', name: 'R', team: foe.team, left: 10 });
    run(ticks(1.5 + RULES.raiseCast + RULES.thrallRise) + 2);
    const raised = mine().find((z) => z.kind === 'thrall')!;
    expect(raised).toMatchObject({ classId: 'necromancer', summoner: thrall.id });
    // The raised one belongs to the thrall: the player still has only its own thrall.
    expect(d.state.zombies.filter((z) => z.owner === n.id && z.kind === 'thrall' && !z.summoner)).toHaveLength(1);
    // A thrall raised by another thrall summons, but never raises again.
    d.state.graves.push({ x: raised.x + 30, y: raised.y, classId: 'archer', name: 'A', team: foe.team, left: 10 });
    run(ticks(2));
    expect(d.state.zombies.some((z) => z.summoner === raised.id && z.kind === 'thrall')).toBe(false);
  });
  it('caballero: levanta el escudo ante una flecha y responde con un golpe cargado', () => {
    const { d, foe, thrall, run, events } = setup('guardian');
    Object.assign(foe, { x: thrall.x + 60, y: thrall.y, hp: 99 });
    thrall.angle = 0;
    d.state.arrows.push(incoming(d, foe, { x: thrall.x + 110, y: thrall.y }));
    run(ticks(0.6));
    expect(thrall.hp).toBe(CLASSES.guardian.hp);
    expect(events.some((e) => e.kind === 'block')).toBe(true);
    run(ticks(1));
    expect(events.some((e) => e.kind === 'sword' && (e.power ?? 0) >= 1)).toBe(true);
    expect(foe.hp).toBeLessThan(99);
  });
  it('guerrero: contraataca una flecha, se acerca con dash y lanza el tajo', () => {
    const { d, foe, thrall, run, shots, events, actions } = setup('vanguard');
    Object.assign(foe, { x: thrall.x + 230, y: thrall.y, hp: 99 });
    d.state.arrows.push(incoming(d, foe, { x: thrall.x + 100, y: thrall.y }));
    run(ticks(0.5));
    expect(events.some((e) => e.kind === 'counter')).toBe(true);
    expect(thrall.hp).toBe(CLASSES.vanguard.hp);
    run(ticks(3));
    expect(actions.has('dash')).toBe(true);
    expect(shots().some((a) => a.slash)).toBe(true);
  });
});
