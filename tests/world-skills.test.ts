import { describe, it, expect } from 'vitest';
import { RULES, idleInput, type Input } from '@bandera/shared';
import {
  COPY_CHARGES_LIMITED,
  INCANTATION_TIME,
  World,
  newCharacter,
  validCreation,
  worldInput,
  type Creation,
  type Notice,
} from '@bandera/shared/world';
import { SKILLS_WORLD, usesToLevel } from '@bandera/shared/rpg/skills';
import type { ZoneId } from '@bandera/shared/rpg/zones';

const ticks = (seconds: number) => Math.ceil(seconds / RULES.tick);
const run = (world: World, count: number, input: Partial<Input> = {}) => {
  for (let i = 0; i < count; i++) world.step(new Map([['h', { ...idleInput(), ...input }]]));
};
const seen = (world: World, kind: Notice['kind']) => world.notices.filter((n) => n.kind === kind);

function setup(skillId: string, sparks: Creation['sparks'] = {}, weapon: Creation['weapon'] = 'espada', zoneId: ZoneId = 'umbral') {
  const world = new World(zoneId);
  const character = newCharacter('h', 'cuenta', 'Rudeus', 'guardian', { sparks, weapon }, {
    skillId,
    rarity: SKILLS_WORLD[skillId].rarity,
  });
  const p = world.join(character);
  // Nothing here should die of a stray wolf while the test looks at something else.
  p.invuln = 999;
  return { world, character, p, aim: { x: p.x + 200, y: p.y } };
}

describe('creación del personaje', () => {
  it('exige exactamente tres chispas y un arma que exista', () => {
    expect(validCreation({ sparks: { fuego: 3 }, weapon: 'baston' })).toBe(true);
    expect(validCreation({ sparks: { fuego: 1, fuerza: 1, sigilo: 1 }, weapon: 'daga' })).toBe(true);
    expect(validCreation({ sparks: { fuego: 2 }, weapon: 'baston' })).toBe(false);
    expect(validCreation({ sparks: { fuego: 4 }, weapon: 'baston' })).toBe(false);
    expect(validCreation({ sparks: { fuego: 3 }, weapon: 'hacha' })).toBe(false);
    expect(validCreation({ sparks: { oscuridad: 3 }, weapon: 'espada' })).toBe(false);
    expect(validCreation({ sparks: { fuego: -1, agua: 4 }, weapon: 'espada' })).toBe(false);
  });

  it('el arma decide el golpe básico y el destino entreabre la puerta de su afinidad', () => {
    const mago = newCharacter('a', 'c', 'A', 'guardian', { sparks: { fuerza: 3 }, weapon: 'baston' }, { skillId: 'chispa', rarity: 'comun' });
    expect(mago.classId).toBe('mage');
    expect(mago.slots.e).toBe('chispa');
    expect(mago.affinities.fuego?.points).toBe(1);
    expect(mago.affinities.fuerza?.points).toBe(3);
    const impostor = newCharacter('b', 'c', 'B', 'guardian', { sparks: { sigilo: 3 }, weapon: 'daga' }, { skillId: 'ojo_impostor', rarity: 'rara' });
    expect(impostor.copyCharges).toBe(1);
    expect(impostor.classId).toBe('archer');
  });

  it('las habilidades de clase del duelo no existen en el mundo', () => {
    const input = { ...idleInput(), x: 1, fury: true, dash: true, shieldBash: true, volley: true, shot: true };
    const espada = worldInput(input, 'espada');
    expect(espada).toMatchObject({ x: 1, fury: false, dash: false, shieldBash: false, volley: false, shot: true });
    expect(worldInput(input, 'daga')).toMatchObject({ sword: true, shot: false });
    expect(worldInput(input, 'espada', true)).toMatchObject({ x: 0, shot: false, sword: false });
  });
});

describe('lanzar habilidades', () => {
  it('Chispa cuesta maná, se canta, y recién después sale el fuego; la recarga frena el segundo', () => {
    const { world, p, aim } = setup('chispa', { fuego: 3 }, 'baston');
    const mana = p.mana;
    world.cast('h', 'e', aim);
    run(world, 1);
    const grito = seen(world, 'callout').at(-1)!;
    expect(grito).toMatchObject({ title: 'Chispa', slot: 'e' });
    expect(grito.incantation).toMatch(/llama/);
    expect(p.mana).toBeLessThan(mana);
    expect(world.state.arrows.filter((a) => a.owner === 'h')).toHaveLength(0);
    run(world, ticks(INCANTATION_TIME) + 1);
    expect(world.state.arrows.filter((a) => a.owner === 'h')).toHaveLength(1);
    const gritos = seen(world, 'callout').length;
    world.cast('h', 'e', aim);
    run(world, 1);
    expect(seen(world, 'callout')).toHaveLength(gritos);
  });

  it('mientras canta no se puede mover', () => {
    const { world, p, aim } = setup('chispa', { fuego: 3 }, 'baston');
    world.cast('h', 'e', aim);
    run(world, 1);
    const x = p.x;
    run(world, 5, { x: 1 });
    expect(p.x).toBeCloseTo(x);
  });

  it('en rango Avanzado el canto es silencioso y el hechizo sale al instante', () => {
    const { world, character, aim } = setup('chispa', { fuego: 3 }, 'baston');
    character.affinities.fuego!.xp = 700;
    world.cast('h', 'e', aim);
    run(world, 1);
    expect(seen(world, 'callout').at(-1)!.incantation).toBeUndefined();
    expect(world.state.arrows.filter((a) => a.owner === 'h')).toHaveLength(1);
  });

  it('una afinidad cerrada rechaza el hechizo con la voz del Sistema y no cobra nada', () => {
    const { world, character, p, aim } = setup('chispa', { fuerza: 3 });
    delete character.affinities.fuego;
    const mana = p.mana;
    world.cast('h', 'e', aim);
    run(world, 1);
    expect(seen(world, 'denied').at(-1)!.text).toBe('Tu cuerpo no reconoce el flujo del fuego.');
    expect(p.mana).toBeGreaterThanOrEqual(mana);
  });

  it('la ranura X está cerrada hasta el nivel 5', () => {
    const { world, aim } = setup('parada');
    expect(world.setSlot('h', 'x', 'parada')).toBe(false);
    world.cast('h', 'x', aim);
    run(world, 1);
    expect(seen(world, 'denied').at(-1)!.text).toMatch(/nivel 5/);
  });

  it('usar la Parada la sube en silencio hasta que evoluciona en Parada Fluida', () => {
    const { world, character, aim } = setup('parada');
    const progreso = character.skills.parada;
    progreso.level = 3;
    progreso.uses = usesToLevel(SKILLS_WORLD.parada, 3) - 1;
    world.cast('h', 'e', aim);
    run(world, 1);
    expect(progreso.level).toBe(4);
    expect(seen(world, 'evolution').at(-1)!.title).toBe('«Parada» evolucionó en «Parada Fluida»');
  });

  it('la Parada devuelve el golpe de un monstruo y abre la ventana contra proyectiles', () => {
    const { world, p, aim } = setup('parada');
    p.invuln = 0;
    const lobezno = world.state.zombies.find((z) => z.family === 'lobezno')!;
    world.cast('h', 'e', aim);
    run(world, 1);
    expect(p.counterLeft).toBeGreaterThan(0);
    const vida = p.hp;
    const suya = lobezno.hp;
    expect(world.damage(p, lobezno, 0, 1)).toBe(false);
    expect(p.hp).toBe(vida);
    expect(lobezno.hp).toBeLessThan(suya);
  });

  it('Mil Espadas golpea a todos los monstruos alrededor', () => {
    const { world, p, aim } = setup('mil_espadas', { destreza: 3 });
    // Monsters are born on a ring 0.7 × the camp radius from its centre, so stand next to one.
    const vecino = world.state.zombies.find((z) => z.owner === 'wild:umbral:0')!;
    Object.assign(p, { x: vecino.x + 30, y: vecino.y });
    const cerca = world.state.zombies.filter((z) => z.owner === 'wild:umbral:0' && Math.hypot(z.x - p.x, z.y - p.y) <= 140);
    expect(cerca.length).toBeGreaterThan(0);
    const antes = cerca.map((z) => z.hp);
    world.cast('h', 'e', aim);
    run(world, 1);
    expect(cerca.some((z, i) => z.hp < antes[i])).toBe(true);
  });

  it('Cura Menor cura al que la canta', () => {
    const { world, p, aim } = setup('cura_menor', { agua: 3 }, 'baston');
    p.hp = 2;
    world.cast('h', 'e', aim);
    run(world, ticks(INCANTATION_TIME) + 2);
    expect(p.hp).toBeGreaterThan(2);
  });

  it('un chico que se queda sin maná ensancha sus canales para siempre', () => {
    const { world, character, p, aim } = setup('chispa', { fuego: 3 }, 'baston');
    p.mana = SKILLS_WORLD.chispa.mana + 0.5;
    world.cast('h', 'e', aim);
    run(world, 1);
    expect(character.bonusMana).toBe(1);
    expect(seen(world, 'widen')).toHaveLength(1);
  });
});

describe('árboles y robo', () => {
  it('aprender un nodo gasta puntos, y elegir una rama cierra la otra para siempre', () => {
    const { world, character } = setup('parada');
    character.skills.parada.level = 4;
    character.skillPoints = 5;
    expect(world.learn('h', 'parada', 'parada:1').ok).toBe(true);
    expect(world.learn('h', 'parada', 'parada:2').ok).toBe(true);
    const cerrada = world.learn('h', 'parada', 'parada:3');
    expect(cerrada.ok).toBe(false);
    expect(cerrada.reason).toMatch(/cerrado para siempre/);
    expect(character.skillPoints).toBe(2);
    expect(seen(world, 'learn')).toHaveLength(2);
  });

  it('subir de nivel da un punto de habilidad, lo anuncia y abre la ranura X en el nivel 5', () => {
    const { world, character } = setup('parada');
    world.grantXp('h', 5000);
    expect(character.level).toBeGreaterThanOrEqual(5);
    expect(character.skillPoints).toBe(character.level - 1);
    expect(seen(world, 'level').some((n) => /ranura X/.test(n.text))).toBe(true);
    expect(world.setSlot('h', 'x', 'parada')).toBe(true);
  });

  /** A thief next to the first ghoul of the Ash Fields, with the eye in E. */
  function thief(zoneId: ZoneId = 'ceniza', family = 'ghoul') {
    const world = new World(zoneId);
    const prey = world.state.zombies.find((z) => z.family === family)!;
    const character = newCharacter('h', 'c', 'Rentt', 'guardian', { sparks: { sigilo: 3 }, weapon: 'daga' }, {
      skillId: 'ojo_impostor',
      rarity: 'rara',
    });
    character.x = prey.x + 40;
    character.y = prey.y;
    const p = world.join(character);
    p.invuln = 999;
    return { world, prey, character, p };
  }
  const offers = (world: World) => world.stealOffers;

  it('el Ojo del Impostor abre lo que tiene el objetivo y no gasta la carga hasta elegir', () => {
    const { world, prey, character } = thief();
    world.cast('h', 'e', { x: prey.x, y: prey.y });
    run(world, 1);
    const offer = offers(world).at(-1)!;
    expect(offer.id).toBe('h');
    expect(offer.offer.kind).toBe('monstruo');
    // Everything the ghoul could give: its two hidden skills and the family's passive.
    expect(offer.offer.options.map((o) => o.id).sort()).toEqual(['passive:carne_ghoul', 'skill:devorar', 'skill:garras_ghoul'].sort());
    // Looking costs nothing: the single charge is still there.
    expect(character.copyCharges).toBe(1);
    expect(character.trees).toEqual([]);
  });

  it('elegir una habilidad del monstruo la trae con su árbol; elegir la pasiva, la pasiva', () => {
    const conGarras = thief();
    conGarras.world.cast('h', 'e', { x: conGarras.prey.x, y: conGarras.prey.y });
    run(conGarras.world, 1);
    expect(conGarras.world.chooseSteal('h', 'skill:garras_ghoul')).toBe(true);
    expect(conGarras.character.skills.garras_ghoul.level).toBeGreaterThan(0);
    expect(conGarras.character.trees).toContain('ghoul');
    expect(conGarras.character.passives).toEqual([]);
    // While the world is tested the eye costs nothing; with COPY_CHARGES_LIMITED it would be 0.
    expect(conGarras.character.copyCharges).toBe(COPY_CHARGES_LIMITED ? 0 : 1);
    expect(seen(conGarras.world, 'steal').at(-1)!.title).toBe('Robaste «Garras de Ghoul»');

    const conCarne = thief();
    conCarne.world.cast('h', 'e', { x: conCarne.prey.x, y: conCarne.prey.y });
    run(conCarne.world, 1);
    expect(conCarne.world.chooseSteal('h', 'passive:carne_ghoul')).toBe(true);
    expect(conCarne.character.passives).toContain('carne_ghoul');
    expect(conCarne.character.skills.garras_ghoul).toBeUndefined();
    // The stolen passive works: something no longer entirely alive heals on its own.
    conCarne.p.hp = 1;
    run(conCarne.world, ticks(4));
    expect(conCarne.p.hp).toBeGreaterThan(1);
  });

  it('el ojo mira lo que apuntás, no lo que tenés más cerca', () => {
    const { world, prey, p } = thief();
    const lejos = world.state.zombies.find((z) => z.family && z.family !== prey.family && z.hp > 0)!;
    Object.assign(lejos, { x: p.x + 90, y: p.y });
    world.cast('h', 'e', { x: lejos.x, y: lejos.y });
    run(world, 1);
    expect(offers(world).at(-1)!.offer.target).toContain(lejos.name.split(' ')[0]);
  });

  it('sin elegir a tiempo el ojo se cierra y la carga sigue siendo tuya', () => {
    const { world, prey, character } = thief();
    world.cast('h', 'e', { x: prey.x, y: prey.y });
    run(world, ticks(21));
    expect(character.copyCharges).toBe(1);
    expect(seen(world, 'denied').at(-1)!.text).toMatch(/el ojo se cerró/i);
    expect(world.chooseSteal('h', 'passive:carne_ghoul')).toBe(false);
  });

  it('si el objetivo tiene una sola cosa, el ojo se la lleva sin preguntar', () => {
    const world = new World('bosque');
    const ladron = newCharacter('h', 'c', 'Rentt', 'guardian', { sparks: { sigilo: 3 }, weapon: 'daga' }, { skillId: 'ojo_impostor', rarity: 'rara' });
    const victima = newCharacter('v', 'otra', 'Rudeus', 'guardian', { sparks: { fuego: 3 }, weapon: 'baston' }, { skillId: 'bola_fuego', rarity: 'rara' });
    Object.assign(ladron, { x: 900, y: 1000 });
    Object.assign(victima, { x: 960, y: 1000 });
    const p = world.join(ladron);
    world.join(victima);
    p.invuln = 999;
    world.cast('h', 'e', { x: victima.x, y: victima.y });
    run(world, 1);
    expect(world.stealOffers).toEqual([]);
    expect(ladron.skills.bola_fuego).toBeTruthy();
    expect(ladron.copyCharges).toBe(COPY_CHARGES_LIMITED ? 0 : 1);
  });

  it('sin límite de cargas, el ojo se puede volver a usar sobre otra criatura', () => {
    const { world, prey, character } = thief();
    world.cast('h', 'e', { x: prey.x, y: prey.y });
    run(world, 1);
    expect(world.chooseSteal('h', 'skill:garras_ghoul')).toBe(true);
    run(world, ticks(SKILLS_WORLD.ojo_impostor.cooldown + 0.5));
    world.cast('h', 'e', { x: prey.x, y: prey.y });
    run(world, 1);
    const otra = world.stealOffers.at(-1);
    expect(COPY_CHARGES_LIMITED ? !otra : !!otra).toBe(true);
    if (otra) {
      expect(world.chooseSteal('h', 'passive:carne_ghoul')).toBe(true);
      expect(character.passives).toContain('carne_ghoul');
    }
  });

  it('a otro personaje en zona salvaje le copia una habilidad, dos niveles más floja', () => {
    const world = new World('bosque');
    const ladron = newCharacter('h', 'c', 'Rentt', 'guardian', { sparks: { sigilo: 3 }, weapon: 'daga' }, { skillId: 'ojo_impostor', rarity: 'rara' });
    const victima = newCharacter('v', 'otra', 'Rudeus', 'guardian', { sparks: { fuego: 3 }, weapon: 'baston' }, { skillId: 'bola_fuego', rarity: 'rara' });
    Object.assign(ladron, { x: 900, y: 1000 });
    Object.assign(victima, { x: 960, y: 1000 });
    const p = world.join(ladron);
    world.join(victima);
    p.invuln = 999;
    victima.skills.bola_fuego.level = 5;
    victima.skills.parada = { level: 1, uses: 0, nodes: [] };
    world.cast('h', 'e', { x: victima.x, y: victima.y });
    run(world, 1);
    const offer = offers(world).at(-1)!.offer;
    expect(offer.kind).toBe('personaje');
    expect(offer.target).toBe('Rudeus');
    expect(offer.options.find((o) => o.id === 'skill:bola_fuego')!.level).toBe(3);
    // The eye never copies itself.
    expect(offer.options.some((o) => o.id === 'skill:ojo_impostor')).toBe(false);
    expect(world.chooseSteal('h', 'skill:bola_fuego')).toBe(true);
    expect(ladron.skills.bola_fuego.level).toBe(3);
    // Copying from a door never opened opens it a crack: fire was closed for a stealth thief.
    expect(ladron.affinities.fuego?.points).toBe(1);
  });

  it('un monstruo que mata a un jugador sube de nivel', () => {
    const { world, p } = setup('parada');
    p.invuln = 0;
    p.hp = 0.1;
    const lobezno = world.state.zombies.find((z) => z.family === 'lobezno')!;
    const nivel = lobezno.level;
    world.damage(p, lobezno, 0, 5);
    expect(p.hp).toBe(0);
    expect(lobezno.level).toBe(nivel + 1);
  });
});
