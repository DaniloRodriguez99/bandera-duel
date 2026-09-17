import type { Affinity, Element, SkillNode, WorldSkill } from './skills.js';
import type { WeaponId } from './weapons.js';

/**
 * Weapon × affinity: the signature skills.
 *
 * An affinity is not only the spells you cast, it is what happens to your weapon when you pour it
 * in. A dagger with lightning electrifies whoever it cuts; a bow with wind pushes the rows back; a
 * shield with light blesses the blow. Every crossing of the five weapons and ten affinities has
 * one, all built on a single effect — `imbue` — so they are data, not fifty special cases.
 *
 * While imbued, the weapon's blows carry the affinity: extra damage and what the element does
 * (stun, freeze, burn, drain, push, strike from behind), and each imbued blow cultivates the
 * affinity like a spell would. Fate leans towards the combo of the weapon you chose with the
 * affinity you chose most; the other combos open through "Canalizar en el arma" nodes.
 */

/** What an affinity pours into a weapon, before the weapon shapes it. */
interface Pour {
  element: Element;
  color: string;
  damage: number;
  stun?: number;
  freeze?: number;
  /** Damage per second for three seconds. */
  burn?: number;
  /** Share of the imbued damage that heals the wielder. */
  drain?: number;
  /** Pixels the struck target is pushed away. */
  knock?: number;
  /** Extra damage share when the blow lands from behind. */
  backstab?: number;
  /** Extra damage share against the undead. */
  holy?: number;
}

const POUR: Record<Affinity, Pour> = {
  fuego: { element: 'fuego', color: '#ff7a2f', damage: 0.45, burn: 0.35 },
  agua: { element: 'hielo', color: '#7fd3ff', damage: 0.2, freeze: 0.55 },
  tierra: { element: 'tierra', color: '#c49a5a', damage: 0.35, stun: 0.2, knock: 34 },
  viento: { element: 'viento', color: '#9fe8e0', damage: 0.3, knock: 60 },
  rayo: { element: 'rayo', color: '#ffe45c', damage: 0.35, stun: 0.45 },
  sombra: { element: 'sombra', color: '#a070ff', damage: 0.25, drain: 0.35 },
  luz: { element: 'luz', color: '#fff0a0', damage: 0.3, holy: 1 },
  fuerza: { element: 'fisico', color: '#e0a060', damage: 0.55, knock: 26 },
  destreza: { element: 'fisico', color: '#8fe0a0', damage: 0.3, burn: 0.2 },
  sigilo: { element: 'sombra', color: '#9a9ac0', damage: 0.15, backstab: 1 },
};

/** How each weapon shapes what is poured in. */
const SHAPE: Record<WeaponId, { duration: number; damage: number; control: number }> = {
  daga: { duration: 8, damage: 1, control: 1.3 },
  espada: { duration: 7, damage: 1.2, control: 1 },
  arco: { duration: 9, damage: 1, control: 0.9 },
  baston: { duration: 7, damage: 1.1, control: 1 },
  escudo: { duration: 8, damage: 0.9, control: 1.4 },
};

/** Name and voice of every crossing. */
const NAMES: Record<WeaponId, Record<Affinity, [name: string, flavor: string]>> = {
  daga: {
    fuego: ['Hoja Ardiente', 'Cada corte deja una brasa adentro.'],
    agua: ['Hoja Entumecedora', 'No duele. Después no se mueve.'],
    tierra: ['Daga de Obsidiana', 'Pesa como una piedra y corta como vidrio.'],
    viento: ['Golpe Silencioso', 'El aire se aparta y el golpe te saca de encima.'],
    rayo: ['Daga Electrizante', 'Un corte, un chispazo, y el otro se queda duro.'],
    sombra: ['Colmillo del Vacío', 'Lo que la hoja bebe, lo bebés vos.'],
    luz: ['Daga Consagrada', 'Pequeña, bendita, y lo muerto la teme.'],
    fuerza: ['Puñal Rompehuesos', 'No es rápido. Es definitivo.'],
    destreza: ['Filo Sangrante', 'Muchos cortes chicos, y la sangre hace el resto.'],
    sigilo: ['Apuñalada', 'Nunca te vio. Nunca te va a ver.'],
  },
  espada: {
    fuego: ['Filo de Brasa', 'El acero al rojo no pide permiso.'],
    agua: ['Filo de Escarcha', 'Donde corta, el mundo se detiene.'],
    tierra: ['Golpe Sísmico', 'El suelo responde a cada tajo.'],
    viento: ['Tajo del Céfiro', 'El corte empuja al aire, y el aire empuja.'],
    rayo: ['Estocada Relámpago', 'Llega antes que el trueno.'],
    sombra: ['Filo Sediento', 'La espada tiene sed. Vos, vida.'],
    luz: ['Espada Solar', 'Lo que no debería caminar, arde.'],
    fuerza: ['Tajo Rompeescudos', 'No hay guardia que aguante dos.'],
    destreza: ['Ristra de Filos', 'Uno, dos, tres. El cuarto ya no hace falta.'],
    sigilo: ['Desenvaine Sorpresa', 'La espada aparece recién cuando ya cortó.'],
  },
  arco: {
    fuego: ['Flecha Incendiaria', 'Donde clava, prende.'],
    agua: ['Flecha Helada', 'Congela lo que toca.'],
    tierra: ['Flecha Pesada', 'Una flecha que pesa como una roca.'],
    viento: ['Flecha Penetrante', 'El viento la lleva, y la flecha se lleva todo.'],
    rayo: ['Flecha Instantánea', 'No viaja: impacta.'],
    sombra: ['Flecha del Vacío', 'Nadie la ve venir; vos sentís lo que roba.'],
    luz: ['Flecha Guía', 'La luz sabe dónde está lo muerto.'],
    fuerza: ['Arco Pesado', 'Cada flecha empuja como un puño.'],
    destreza: ['Disparo Veloz', 'Más flechas que respiros.'],
    sigilo: ['Disparo desde la Maleza', 'Si no te vieron, ya perdieron.'],
  },
  baston: {
    fuego: ['Bastón Ígneo', 'El palo arde y el golpe también.'],
    agua: ['Bastón de Marea', 'Pega como una ola fría.'],
    tierra: ['Bastón de Roca', 'Un bastonazo que hace temblar.'],
    viento: ['Bastón del Céfiro', 'Barre el aire y lo que esté en él.'],
    rayo: ['Bastón de Tormenta', 'La punta chisporrotea antes de tocar.'],
    sombra: ['Bastón Umbrío', 'Absorbe lo que golpea.'],
    luz: ['Bastón del Alba', 'Brilla, y lo muerto se aparta.'],
    fuerza: ['Bastón de Guerra', 'Ningún mago pega así.'],
    destreza: ['Bastón Danzante', 'Gira, y cada giro corta.'],
    sigilo: ['Bastón Susurrante', 'El golpe llega por donde no mirabas.'],
  },
  escudo: {
    fuego: ['Escudo al Rojo', 'Tocarlo quema. Recibirlo, más.'],
    agua: ['Maza de Escarcha', 'El que recibe el golpe se queda quieto.'],
    tierra: ['Maza de Piedra', 'Aplasta, y el suelo ayuda.'],
    viento: ['Empujón del Vendaval', 'Te abre espacio a los golpes.'],
    rayo: ['Contragolpe Eléctrico', 'Cada mazazo es una descarga.'],
    sombra: ['Escudo Hambriento', 'Lo que golpea, lo come.'],
    luz: ['Barrera Bendita', 'La maza bendice, y castiga lo impuro.'],
    fuerza: ['Carga Aplastante', 'Pasar por encima también es un arte.'],
    destreza: ['Golpe de Revés', 'Rápido para ser una maza. Demasiado rápido.'],
    sigilo: ['Cobertura Sombría', 'Detrás del escudo no hay nadie. Hasta que hay.'],
  },
};

export const comboId = (weapon: WeaponId, affinity: Affinity) => `combo_${weapon}_${affinity}`;

const round = (n: number) => Math.round(n * 100) / 100;

function combo(weapon: WeaponId, affinity: Affinity): WorldSkill {
  const pour = POUR[affinity];
  const shape = SHAPE[weapon];
  const id = comboId(weapon, affinity);
  const [name, flavor] = NAMES[weapon][affinity];
  const control = (n?: number) => (n === undefined ? undefined : round(n * shape.control));
  const tree: SkillNode[] = [
    { id: `${id}:1`, name: 'Carga Larga', level: 2, cost: 1, text: 'El arma guarda la carga más tiempo.', grants: { duration: 3 } },
    { id: `${id}:2`, name: 'Carga Profunda', level: 4, cost: 2, requires: [`${id}:1`], text: 'Cada golpe cargado pega más.', grants: { damage: 0.2 } },
    { id: `${id}:3`, name: 'Sin Pausa', level: 6, cost: 2, text: 'La carga vuelve antes y cuesta menos.', grants: { cooldown: -0.3, mana: -0.3 } },
  ];
  return {
    id,
    name,
    school: affinity,
    weapon,
    rarity: 'comun',
    flavor,
    color: pour.color,
    icon: `skill-${id}`,
    mana: 7,
    cooldown: 14,
    effect: {
      kind: 'imbue',
      element: pour.element,
      duration: shape.duration,
      damage: round(pour.damage * shape.damage),
      ...(pour.stun ? { stun: control(pour.stun) } : {}),
      ...(pour.freeze ? { freeze: control(pour.freeze) } : {}),
      ...(pour.burn ? { burn: pour.burn } : {}),
      ...(pour.drain ? { drain: pour.drain } : {}),
      ...(pour.knock ? { knock: control(pour.knock) } : {}),
      ...(pour.backstab ? { backstab: control(pour.backstab) } : {}),
      ...(pour.holy ? { holy: pour.holy } : {}),
    },
    maxLevel: 10,
    firstLevelUses: 6,
    evolutions: [],
    tree,
  };
}

const WEAPON_ORDER: WeaponId[] = ['espada', 'baston', 'arco', 'daga', 'escudo'];
const AFFINITY_ORDER: Affinity[] = ['fuego', 'agua', 'tierra', 'viento', 'rayo', 'sombra', 'luz', 'fuerza', 'destreza', 'sigilo'];

/** Every crossing, keyed by id. */
export const COMBO_SKILLS: Record<string, WorldSkill> = Object.fromEntries(
  WEAPON_ORDER.flatMap((w) => AFFINITY_ORDER.map((a) => [comboId(w, a), combo(w, a)])),
);
