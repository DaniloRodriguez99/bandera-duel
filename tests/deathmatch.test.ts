import { describe, expect, it } from 'vitest';
import { Duel, RULES, validDeathmatchRule, validPvpConfig } from '@bandera/shared';

class SummonMatch extends Duel {
  summon(ownerIndex: number, victimIndex: number) {
    const owner = this.state.players[ownerIndex];
    const victim = this.state.players[victimIndex];
    this.state.zombies.push(this.newZombie(owner, { x: victim.x - 12, y: victim.y }, owner, {
      target: victim.id, role: 'guard', windup: RULES.tick / 2, retarget: 1,
    }));
  }
}

const inputs = new Map();
function match(mode: 'duel' | 'teams' | 'ffa3' = 'duel', rule: { kind: 'kills'; target: 3 | 5 | 10 } | { kind: 'time'; duration: 180 | 300 | 600 } = { kind: 'kills', target: 3 }) {
  const duel = new Duel('courtyard', mode, 'deathmatch', rule);
  for (let i = 0; i < (mode === 'teams' ? 4 : mode === 'ffa3' ? 3 : 2); i++) duel.add(String(i), `Player ${i}`);
  duel.state.phase = 'playing';
  return duel;
}
function kill(duel: Duel, attackerIndex: number, victimIndex: number) {
  const attacker = duel.state.players[attackerIndex];
  const victim = duel.state.players[victimIndex];
  Object.assign(victim, { hp: 1, invuln: 0, dashInvulnerable: false, guarding: false });
  expect(duel.damage(victim, attacker, 0, 99)).toBe(true);
}

describe('Deathmatch', () => {
  it('valida reglas y mantiene Captura la bandera como objetivo predeterminado', () => {
    expect(validDeathmatchRule({ kind: 'kills', target: 3 })).toBe(true);
    expect(validDeathmatchRule({ kind: 'kills', target: 4 })).toBe(false);
    expect(validDeathmatchRule({ kind: 'time', duration: 600 })).toBe(true);
    expect(validDeathmatchRule({ kind: 'time', duration: 240 })).toBe(false);
    expect(validPvpConfig({ mode: 'pve', objective: 'deathmatch', deathmatch: { kind: 'kills', target: 3 } })).toBe(false);
    const duel = new Duel();
    duel.add('one', 'One');
    expect(duel.state.objective).toBe('ctf');
    expect(duel.state.flags).toHaveLength(1);
  });

  it('suma solo bajas hostiles y termina en la meta, sin reloj ni banderas', () => {
    const duel = match();
    expect(duel.state.flags).toHaveLength(0);
    expect(duel.state.timeLeft).toBe(0);
    const [blue, red] = duel.state.players;
    expect(duel.damage(blue, blue, 0, 99)).toBe(false);
    kill(duel, 0, 1);
    expect(duel.state.score.blue).toBe(1);
    expect(red.respawnLeft).toBe(RULES.respawn);
    red.respawnLeft = 0;
    duel.step(inputs);
    expect(red.hp).toBeGreaterThan(0);
    kill(duel, 0, 1);
    kill(duel, 0, 1);
    duel.step(inputs);
    expect(duel.state).toMatchObject({ phase: 'finished', winner: 'blue', reason: 'bajas', timeLeft: 0 });
    expect(duel.state.score.blue).toBe(3);
  });

  it.each([3, 5, 10] as const)('termina al alcanzar %i bajas', target => {
    const duel = match('duel', { kind: 'kills', target });
    duel.state.score.blue = target - 1;
    kill(duel, 0, 1);
    duel.step(inputs);
    expect(duel.state).toMatchObject({ phase: 'finished', winner: 'blue', reason: 'bajas' });
  });

  it('el primer lado que alcanza la meta gana antes de otros impactos del mismo tick', () => {
    const duel = match('ffa3');
    duel.state.score.blue = 2;
    duel.state.score.green = 2;
    kill(duel, 0, 1);
    expect(duel.state).toMatchObject({ phase: 'finished', winner: 'blue' });
    expect(duel.damage(duel.state.players[0], duel.state.players[2], 0, 99)).toBe(false);
    expect(duel.state.score.green).toBe(2);
  });

  it('suma las bajas del equipo y separa las de cada participante en FFA', () => {
    const teams = match('teams', { kind: 'kills', target: 5 });
    expect(teams.state.players.map(p => p.team)).toEqual(['blue', 'red', 'blue', 'red']);
    kill(teams, 0, 1);
    kill(teams, 2, 3);
    expect(teams.state.score.blue).toBe(2);
    expect(teams.damage(teams.state.players[2], teams.state.players[0], 0, 99)).toBe(false);
    const ffa = match('ffa3');
    kill(ffa, 0, 1);
    kill(ffa, 2, 0);
    expect([ffa.state.score.blue, ffa.state.score.red, ffa.state.score.green]).toEqual([1, 0, 1]);
  });

  it('atribuye bajas de trampas e invocaciones al lado dueño', () => {
    const traps = match();
    const [owner, victim] = traps.state.players;
    Object.assign(victim, { x: 480, y: 270, hp: 0.5, invuln: 0 });
    traps.state.traps.push({ id: 1, owner: owner.id, team: owner.team, x: 480, y: 270, armLeft: 0, life: 10 });
    traps.step(inputs);
    expect(traps.state.score.blue).toBe(1);
    const summons = new SummonMatch('courtyard', 'duel', 'deathmatch', { kind: 'kills', target: 3 });
    const leader = summons.add('leader', 'Leader', 'necromancer');
    const foe = summons.add('foe', 'Foe');
    summons.state.phase = 'playing';
    Object.assign(leader, { x: 440, y: 270 });
    Object.assign(foe, { x: 480, y: 270, hp: 1, invuln: 0 });
    summons.summon(0, 1);
    summons.step(inputs);
    expect(summons.state.score.blue).toBe(1);
  });

  it('resuelve por tiempo, incluidos los empates', () => {
    const duel = match('duel', { kind: 'time', duration: 180 });
    duel.state.timeLeft = 0.01;
    duel.step(inputs, 0.02);
    expect(duel.state).toMatchObject({ phase: 'finished', winner: 'draw', reason: 'tiempo' });
    const second = match('duel', { kind: 'time', duration: 300 });
    kill(second, 1, 0);
    second.state.timeLeft = 0.01;
    second.step(inputs, 0.02);
    expect(second.state).toMatchObject({ phase: 'finished', winner: 'red', reason: 'tiempo' });
  });

  it.each([180, 300, 600] as const)('inicia el reloj en %i segundos y termina al agotarse', duration => {
    const duel = new Duel('courtyard', 'duel', 'deathmatch', { kind: 'time', duration });
    duel.add('one', 'One');
    duel.add('two', 'Two');
    duel.ready('one');
    duel.ready('two');
    expect(duel.state.timeLeft).toBe(duration);
    duel.state.phase = 'playing';
    duel.state.timeLeft = 0.01;
    duel.step(inputs, 0.02);
    expect(duel.state).toMatchObject({ phase: 'finished', winner: 'draw', reason: 'tiempo' });
  });

  it('un abandono termina la partida sin sumar una baja', () => {
    const duel = match();
    duel.abandon(duel.state.players[1].id);
    expect(duel.state).toMatchObject({ phase: 'finished', winner: 'blue', reason: 'abandono' });
    expect(duel.state.score.blue).toBe(0);
  });

  it('reconfigura tras el resultado, limpia marcador y listo y conserva clase y apariencia', () => {
    const duel = match('ffa3');
    const player = duel.state.players[0];
    const originalClass = player.classId;
    const originalSkin = player.skinId;
    duel.finish('blue', 'bajas');
    duel.state.score.blue = 3;
    duel.state.players.forEach(p => p.ready = true);
    expect(duel.configurePvp({ mode: 'duel', objective: 'ctf', deathmatch: { kind: 'kills', target: 3 } })).toBe(false);
    expect(duel.configurePvp({ mode: 'teams', objective: 'ctf', deathmatch: { kind: 'kills', target: 3 } })).toBe(true);
    expect(duel.state).toMatchObject({ phase: 'lobby', winner: null, score: { blue: 0, red: 0, green: 0, violet: 0 } });
    expect(duel.state.flags).toHaveLength(2);
    expect(duel.state.players.every(p => !p.ready)).toBe(true);
    expect(duel.state.players.map(p => p.team)).toEqual(['blue', 'red', 'blue']);
    expect([player.classId, player.skinId]).toEqual([originalClass, originalSkin]);
    duel.state.phase = 'playing';
    expect(duel.configurePvp({ mode: 'ffa3', objective: 'deathmatch', deathmatch: { kind: 'kills', target: 5 } })).toBe(false);
  });
});
