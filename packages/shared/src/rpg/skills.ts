import type { MobFamilyId } from './zones.js';
import type { StatId, Stats } from './progression.js';

/**
 * The world's skills.
 *
 * A skill here is not a button: it has a voice (the flavour line and the incantation it shouts
 * until its affinity reaches silent casting), a colour, a rarity, and its own tree. Using it
 * levels it; its levels open nodes; some nodes are forks you choose once and forever; and its
 * last evolutions change its name. Commons have the longest roads and end the highest — the
 * lesson of I Parry Everything — so bad luck at birth is a slow start, never a sentence.
 *
 * Monsters have trees too, which players never see. The single charge of the impostor's eye,
 * spent on a monster, opens that family's parallel tree and grants its passive.
 *
 * Everything in this file is pure data and pure functions, so it can be tested on its own and
 * shared by the server, the client and the tests.
 */

export type Affinity =
  | 'fuego'
  | 'agua'
  | 'tierra'
  | 'viento'
  | 'rayo'
  | 'sombra'
  | 'luz'
  | 'fuerza'
  | 'destreza'
  | 'sigilo';

export const ARCANE: Affinity[] = ['fuego', 'agua', 'tierra', 'viento', 'rayo', 'sombra', 'luz'];
export const MARTIAL: Affinity[] = ['fuerza', 'destreza', 'sigilo'];
export const AFFINITIES: Affinity[] = [...ARCANE, ...MARTIAL];

/** Who may use a skill: an affinity, the body (everyone), or a monster's stolen tree. */
export type SkillSchool = Affinity | 'cuerpo' | 'monstruo';

export type Rarity = 'comun' | 'rara' | 'epica' | 'legendaria' | 'unica';
export const RARITY_NAMES: Record<Rarity, string> = {
  comun: 'Común',
  rara: 'Rara',
  epica: 'Épica',
  legendaria: 'Legendaria',
  unica: 'Única',
};

export type Element = 'fuego' | 'hielo' | 'viento' | 'rayo' | 'sombra' | 'luz' | 'tierra' | 'fisico';

/** What a skill does, in terms the simulation already knows how to resolve. */
export type SkillEffect =
  | {
      kind: 'bolt';
      element: Element;
      damage: number;
      range: number;
      pierce?: boolean;
      freeze?: number;
      explode?: number;
      /** Share of the damage dealt that comes back as health. */
      drain?: number;
    }
  | { kind: 'nova'; element: Element; damage: number; radius: number; freeze?: number }
  | { kind: 'heal'; amount: number; radius: number }
  | { kind: 'parry'; window: number; reflect: number }
  | { kind: 'dash'; distance: number; invulnerable?: boolean }
  | { kind: 'buff'; damage: number; speed: number; duration: number }
  | { kind: 'devour'; heal: number; radius: number }
  | { kind: 'steal'; range: number };

/** What a node adds on top of the base effect when learned. All optional, all additive. */
export interface NodeGrant {
  damage?: number;
  /** Multiplier on mana cost, e.g. -0.2 for 20 % cheaper. */
  mana?: number;
  /** Multiplier on cooldown, e.g. -0.25. */
  cooldown?: number;
  radius?: number;
  range?: number;
  window?: number;
  reflect?: number;
  freeze?: number;
  heal?: number;
  drain?: number;
  pierce?: boolean;
  duration?: number;
}

export interface SkillNode {
  id: string;
  name: string;
  /** The skill level needed before this node can be learned. */
  level: number;
  /** Skill points spent to learn it. */
  cost: number;
  /** Nodes that must be learned first. */
  requires?: string[];
  /** Nodes sharing a fork id exclude each other: choosing one closes the others for good. */
  fork?: string;
  /** Attributes the character must have reached. */
  attributes?: Partial<Stats>;
  text: string;
  grants: NodeGrant;
}

export interface Evolution {
  level: number;
  name: string;
  /** What the System says when it happens. */
  line: string;
}

export interface WorldSkill {
  id: string;
  name: string;
  school: SkillSchool;
  rarity: Rarity;
  /** Its personality: one line, in its own voice. */
  flavor: string;
  /** Shouted while casting until the affinity reaches silent casting. Martial skills have none. */
  incantation?: string;
  /** Element colour for callouts, frames and notifications. */
  color: string;
  /** Base name of an icon in /assets/skills. */
  icon: string;
  mana: number;
  cooldown: number;
  effect: SkillEffect;
  maxLevel: number;
  /** Uses needed for level 2; each next level asks for 35 % more. */
  firstLevelUses: number;
  evolutions: Evolution[];
  tree: SkillNode[];
}

const node = (skill: string, n: number, data: Omit<SkillNode, 'id'>): SkillNode => ({
  id: `${skill}:${n}`,
  ...data,
});

export const SKILLS_WORLD: Record<string, WorldSkill> = {
  // ─── The body: open to everyone, the Noor road ─────────────────────────────────────────────
  parada: {
    id: 'parada',
    name: 'Parada',
    school: 'cuerpo',
    rarity: 'comun',
    flavor: 'Lo que viene, vuelve.',
    color: '#e8d7a8',
    icon: 'vanguard-counter',
    mana: 2,
    cooldown: 3,
    effect: { kind: 'parry', window: 0.35, reflect: 1 },
    maxLevel: 12,
    firstLevelUses: 10,
    evolutions: [
      { level: 4, name: 'Parada Fluida', line: 'Ya no esperás el golpe: lo leés antes de que exista.' },
      { level: 8, name: 'Contraparada', line: 'Lo que te tiran ahora vuelve más fuerte de lo que vino.' },
      { level: 12, name: 'Parada Absoluta', line: 'Mil espadas, una sola respuesta. Nadie entiende cómo.' },
    ],
    tree: [
      node('parada', 1, { name: 'Reflejo', level: 2, cost: 1, text: 'La ventana dura un poco más.', grants: { window: 0.1 } }),
      node('parada', 2, {
        name: 'Parada Fluida',
        level: 4,
        cost: 2,
        fork: 'parada-camino',
        requires: ['parada:1'],
        text: 'Devolvés los proyectiles al doble de velocidad y la recarga baja mucho.',
        grants: { cooldown: -0.4, reflect: 0.5 },
      }),
      node('parada', 3, {
        name: 'Parada de Hierro',
        level: 4,
        cost: 2,
        fork: 'parada-camino',
        requires: ['parada:1'],
        attributes: { vigor: 8 },
        text: 'Aguantás golpes de frente y el que te pegó lo siente el doble.',
        grants: { reflect: 1, window: 0.15 },
      }),
      node('parada', 4, {
        name: 'Sin Esfuerzo',
        level: 8,
        cost: 3,
        text: 'Casi no cuesta maná. Ni pensás en parar: parás.',
        grants: { mana: -0.8, cooldown: -0.3 },
      }),
      node('parada', 5, {
        name: 'Mil Espadas',
        level: 12,
        cost: 4,
        requires: ['parada:4'],
        attributes: { agility: 14 },
        text: 'La ventana es enorme y devolvés todo lo que entra en ella.',
        grants: { window: 0.5, reflect: 1 },
      }),
    ],
  },
  refuerzo: {
    id: 'refuerzo',
    name: 'Refuerzo',
    school: 'fuerza',
    rarity: 'comun',
    flavor: 'El cuerpo recuerda lo que la mente olvida.',
    color: '#e0a060',
    icon: 'guardian-fury',
    mana: 6,
    cooldown: 12,
    effect: { kind: 'buff', damage: 0.3, speed: 0.08, duration: 5 },
    maxLevel: 10,
    firstLevelUses: 6,
    evolutions: [
      { level: 4, name: 'Refuerzo Mayor', line: 'Tus músculos aprendieron a no cansarse.' },
      { level: 7, name: 'Cuerpo de Hierro', line: 'Lo que antes dolía, ahora rebota.' },
      { level: 10, name: 'Titán', line: 'El suelo tiembla un poco cuando pisás.' },
    ],
    tree: [
      node('refuerzo', 1, { name: 'Aguante', level: 2, cost: 1, text: 'Dura más.', grants: { duration: 2 } }),
      node('refuerzo', 2, {
        name: 'Furia Contenida',
        level: 5,
        cost: 2,
        fork: 'refuerzo-camino',
        requires: ['refuerzo:1'],
        text: 'Más daño, menos cabeza.',
        grants: { damage: 0.25 },
      }),
      node('refuerzo', 3, {
        name: 'Paso Firme',
        level: 5,
        cost: 2,
        fork: 'refuerzo-camino',
        requires: ['refuerzo:1'],
        text: 'Te movés como si nada pesara.',
        grants: { duration: 3, cooldown: -0.2 },
      }),
    ],
  },
  paso_ligero: {
    id: 'paso_ligero',
    name: 'Paso Ligero',
    school: 'cuerpo',
    rarity: 'comun',
    flavor: 'Un paso antes que el golpe.',
    color: '#bfe9ff',
    icon: 'vanguard-dash',
    mana: 3,
    cooldown: 2.5,
    effect: { kind: 'dash', distance: 130 },
    maxLevel: 10,
    firstLevelUses: 12,
    evolutions: [
      { level: 4, name: 'Paso Pluma', line: 'El pasto ya no se dobla bajo tus pies.' },
      { level: 7, name: 'Paso Sombrío', line: 'Por un instante, no estás en ningún lado.' },
      { level: 10, name: 'Paso de Mil Leguas', line: 'Donde mirás, ya llegaste.' },
    ],
    tree: [
      node('paso_ligero', 1, { name: 'Zancada', level: 2, cost: 1, text: 'Llegás más lejos.', grants: { range: 40 } }),
      node('paso_ligero', 2, {
        name: 'Intocable',
        level: 7,
        cost: 3,
        requires: ['paso_ligero:1'],
        attributes: { agility: 10 },
        text: 'Durante el paso nada te toca.',
        grants: { cooldown: -0.3 },
      }),
    ],
  },

  // ─── Arcane: the Mushoku Tensei road ───────────────────────────────────────────────────────
  chispa: {
    id: 'chispa',
    name: 'Chispa',
    school: 'fuego',
    rarity: 'comun',
    flavor: 'Toda llama empezó así de pequeña.',
    incantation: 'Oh llama que duerme en el fondo de la tierra, despertá en mi mano…',
    color: '#ff7a2f',
    icon: 'mage-fireball',
    mana: 4,
    cooldown: 0.9,
    effect: { kind: 'bolt', element: 'fuego', damage: 1.1, range: 380 },
    maxLevel: 10,
    firstLevelUses: 14,
    evolutions: [
      { level: 3, name: 'Brasa', line: 'La chispa ya no se apaga al tocar algo: se queda ardiendo.' },
      { level: 6, name: 'Lanza de Fuego', line: 'Aprendiste a darle forma a la llama.' },
      { level: 10, name: 'Aliento del Horno', line: 'El aire alrededor tuyo se vuelve irrespirable.' },
    ],
    tree: [
      node('chispa', 1, { name: 'Brasa', level: 3, cost: 1, text: 'Pega más fuerte.', grants: { damage: 0.4 } }),
      node('chispa', 2, {
        name: 'Estallido',
        level: 6,
        cost: 2,
        fork: 'chispa-forma',
        requires: ['chispa:1'],
        attributes: { spirit: 10 },
        text: 'Explota al impactar y quema a los de alrededor.',
        grants: { radius: 45 },
      }),
      node('chispa', 3, {
        name: 'Lanza',
        level: 6,
        cost: 2,
        fork: 'chispa-forma',
        requires: ['chispa:1'],
        attributes: { spirit: 10 },
        text: 'Atraviesa a todos los que estén en la línea.',
        grants: { pierce: true, range: 120 },
      }),
      node('chispa', 4, {
        name: 'Horno',
        level: 10,
        cost: 4,
        attributes: { spirit: 18 },
        text: 'Mucho más daño, mucho menos maná.',
        grants: { damage: 1, mana: -0.3 },
      }),
    ],
  },
  cura_menor: {
    id: 'cura_menor',
    name: 'Cura Menor',
    school: 'agua',
    rarity: 'comun',
    flavor: 'Nadie se levanta solo.',
    incantation: 'Que el agua que corre bajo la piel cierre lo que se abrió…',
    color: '#7dd8ff',
    icon: 'mage-shield',
    mana: 8,
    cooldown: 4,
    effect: { kind: 'heal', amount: 2, radius: 90 },
    maxLevel: 10,
    firstLevelUses: 8,
    evolutions: [
      { level: 3, name: 'Cura', line: 'Ya no solo cerrás heridas: devolvés el aliento.' },
      { level: 6, name: 'Cura en Área', line: 'Tu magia alcanza a todos los que tenés cerca.' },
      { level: 10, name: 'Restauración', line: 'Lo roto vuelve a estar entero.' },
    ],
    tree: [
      node('cura_menor', 1, { name: 'Manantial', level: 3, cost: 1, text: 'Cura más.', grants: { heal: 1.5 } }),
      node('cura_menor', 2, {
        name: 'Oleada',
        level: 6,
        cost: 2,
        requires: ['cura_menor:1'],
        attributes: { spirit: 9 },
        text: 'Alcanza mucho más lejos.',
        grants: { radius: 90 },
      }),
    ],
  },
  escarcha: {
    id: 'escarcha',
    name: 'Escarcha',
    school: 'agua',
    rarity: 'rara',
    flavor: 'El invierno también sabe esperar.',
    incantation: 'Que el frío detenga lo que el miedo no pudo…',
    color: '#9fe8ff',
    icon: 'mage-ice',
    mana: 7,
    cooldown: 3,
    effect: { kind: 'bolt', element: 'hielo', damage: 0.8, range: 360, freeze: 1 },
    maxLevel: 8,
    firstLevelUses: 10,
    evolutions: [
      { level: 4, name: 'Prisión de Hielo', line: 'Lo que tocás deja de moverse un rato largo.' },
      { level: 8, name: 'Invierno Eterno', line: 'Donde pasás, el tiempo se detiene.' },
    ],
    tree: [
      node('escarcha', 1, { name: 'Hielo Profundo', level: 3, cost: 1, text: 'Congela más tiempo.', grants: { freeze: 0.5 } }),
    ],
  },
  rafaga: {
    id: 'rafaga',
    name: 'Ráfaga',
    school: 'viento',
    rarity: 'rara',
    flavor: 'El aire no pide permiso.',
    incantation: 'Viento que viajás sin dueño, prestame tu filo…',
    color: '#d8fbff',
    icon: 'archer-wind',
    mana: 6,
    cooldown: 2.5,
    effect: { kind: 'bolt', element: 'viento', damage: 1.1, range: 460, pierce: true },
    maxLevel: 8,
    firstLevelUses: 10,
    evolutions: [
      { level: 4, name: 'Vendaval', line: 'Ya no cortás el aire: el aire corta por vos.' },
      { level: 8, name: 'Cielo Abierto', line: 'El viento te reconoce. Algún día te va a llevar.' },
    ],
    tree: [
      node('rafaga', 1, { name: 'Filo del Viento', level: 3, cost: 1, text: 'Pega más fuerte.', grants: { damage: 0.5 } }),
    ],
  },
  sismo: {
    id: 'sismo',
    name: 'Sismo',
    school: 'tierra',
    rarity: 'rara',
    flavor: 'La tierra también golpea.',
    incantation: 'Madre de piedra, levantate una vez…',
    color: '#c9a36b',
    icon: 'guardian-bash',
    mana: 10,
    cooldown: 6,
    effect: { kind: 'nova', element: 'tierra', damage: 1, radius: 100, freeze: 0.6 },
    maxLevel: 8,
    firstLevelUses: 8,
    evolutions: [{ level: 5, name: 'Terremoto', line: 'Ahora tiembla todo lo que te rodea.' }],
    tree: [node('sismo', 1, { name: 'Grieta', level: 3, cost: 1, text: 'Más alcance.', grants: { radius: 40 } })],
  },
  sombra_voraz: {
    id: 'sombra_voraz',
    name: 'Sombra Voraz',
    school: 'sombra',
    rarity: 'rara',
    flavor: 'Lo que tomás, te sostiene.',
    incantation: 'Oscuridad que tenés hambre, comé por mí…',
    color: '#a070e0',
    icon: 'necromancer-fire',
    mana: 8,
    cooldown: 3,
    effect: { kind: 'bolt', element: 'sombra', damage: 1, range: 340, drain: 0.5 },
    maxLevel: 8,
    firstLevelUses: 10,
    evolutions: [{ level: 5, name: 'Abismo Hambriento', line: 'La sombra ya no vuelve con las manos vacías.' }],
    tree: [node('sombra_voraz', 1, { name: 'Sed', level: 3, cost: 1, text: 'Roba más vida.', grants: { drain: 0.3 } })],
  },
  emboscada: {
    id: 'emboscada',
    name: 'Emboscada',
    school: 'sigilo',
    rarity: 'rara',
    flavor: 'El primer golpe es el único que importa.',
    color: '#6fbf8a',
    icon: 'vanguard-slash',
    mana: 7,
    cooldown: 8,
    effect: { kind: 'buff', damage: 0.7, speed: 0.25, duration: 2.5 },
    maxLevel: 8,
    firstLevelUses: 8,
    evolutions: [{ level: 5, name: 'Mil Cuchillas', line: 'Nadie te vio llegar. Nadie te va a ver irte.' }],
    tree: [],
  },
  golpe_divino: {
    id: 'golpe_divino',
    name: 'Golpe Divino',
    school: 'luz',
    rarity: 'epica',
    flavor: 'La luz no odia: separa.',
    incantation: 'Por lo que es puro, que lo impuro se aparte…',
    color: '#fff1a8',
    icon: 'guardian-shield',
    mana: 10,
    cooldown: 5,
    effect: { kind: 'bolt', element: 'luz', damage: 1.6, range: 400 },
    maxLevel: 6,
    firstLevelUses: 8,
    evolutions: [{ level: 4, name: 'Juicio', line: 'Lo que no debería estar vivo tiembla al verte.' }],
    tree: [],
  },
  trueno: {
    id: 'trueno',
    name: 'Trueno',
    school: 'rayo',
    rarity: 'epica',
    flavor: 'El cielo decide.',
    incantation: 'Que caiga lo que el cielo guarda…',
    color: '#f4f07a',
    icon: 'archer-volley',
    mana: 14,
    cooldown: 7,
    effect: { kind: 'nova', element: 'rayo', damage: 2, radius: 110 },
    maxLevel: 6,
    firstLevelUses: 6,
    evolutions: [{ level: 4, name: 'Tormenta', line: 'Las nubes te siguen.' }],
    tree: [],
  },
  mil_espadas: {
    id: 'mil_espadas',
    name: 'Mil Espadas',
    school: 'destreza',
    rarity: 'legendaria',
    flavor: 'Mil filos, una sola voluntad.',
    color: '#ffd36b',
    icon: 'guardian-slash',
    mana: 22,
    cooldown: 14,
    effect: { kind: 'nova', element: 'fisico', damage: 3, radius: 140 },
    maxLevel: 4,
    firstLevelUses: 5,
    evolutions: [{ level: 4, name: 'Reino de Espadas', line: 'Donde estás parado, nadie más puede estarlo.' }],
    tree: [],
  },
  ojo_impostor: {
    id: 'ojo_impostor',
    name: 'Ojo del Impostor',
    school: 'sigilo',
    rarity: 'rara',
    flavor: 'Todo lo que ves puede ser tuyo. Una sola vez.',
    color: '#ff6fb0',
    icon: 'necromancer-resurrection',
    mana: 20,
    cooldown: 10,
    effect: { kind: 'steal', range: 120 },
    maxLevel: 1,
    firstLevelUses: 1,
    evolutions: [],
    tree: [],
  },

  // ─── Monster trees: invisible to players until stolen ──────────────────────────────────────
  devorar: {
    id: 'devorar',
    name: 'Devorar',
    school: 'monstruo',
    rarity: 'rara',
    flavor: 'Nada se desperdicia.',
    color: '#9fbf6a',
    icon: 'necromancer-summon',
    mana: 4,
    cooldown: 5,
    effect: { kind: 'devour', heal: 3, radius: 70 },
    maxLevel: 8,
    firstLevelUses: 6,
    evolutions: [{ level: 5, name: 'Festín', line: 'Cada bocado te deja más fuerte que antes.' }],
    tree: [
      node('devorar', 1, { name: 'Hambre', level: 3, cost: 1, text: 'Cura más al devorar.', grants: { heal: 2 } }),
    ],
  },
  garras_ghoul: {
    id: 'garras_ghoul',
    name: 'Garras de Ghoul',
    school: 'monstruo',
    rarity: 'rara',
    flavor: 'Lo que desgarran, ya no se cierra.',
    color: '#7fa05a',
    icon: 'vanguard-sword',
    mana: 3,
    cooldown: 1.2,
    effect: { kind: 'bolt', element: 'sombra', damage: 1.4, range: 90, drain: 0.25 },
    maxLevel: 8,
    firstLevelUses: 12,
    evolutions: [{ level: 6, name: 'Garras de Vampiro', line: 'Tu sed cambió de forma. Ya no sos solo un ghoul.' }],
    tree: [
      node('garras_ghoul', 1, { name: 'Desgarro', level: 3, cost: 1, text: 'Más daño.', grants: { damage: 0.6 } }),
      node('garras_ghoul', 2, {
        name: 'Sangre Menor',
        level: 6,
        cost: 3,
        requires: ['garras_ghoul:1'],
        text: 'El primer paso hacia el vampiro: cada garra te devuelve mucha más vida.',
        grants: { drain: 0.4 },
      }),
    ],
  },
  aullido: {
    id: 'aullido',
    name: 'Aullido de Manada',
    school: 'monstruo',
    rarity: 'rara',
    flavor: 'Nunca cazás solo.',
    color: '#c9c3b4',
    icon: 'archer-volley',
    mana: 6,
    cooldown: 10,
    effect: { kind: 'buff', damage: 0.15, speed: 0.3, duration: 4 },
    maxLevel: 6,
    firstLevelUses: 6,
    evolutions: [{ level: 5, name: 'Llamado del Huargo', line: 'Algo muy grande te responde desde el bosque.' }],
    tree: [],
  },
  telarana: {
    id: 'telarana',
    name: 'Telaraña',
    school: 'monstruo',
    rarity: 'rara',
    flavor: 'Paciencia. Ya van a venir.',
    color: '#e6e6e6',
    icon: 'archer-trap',
    mana: 5,
    cooldown: 5,
    effect: { kind: 'bolt', element: 'fisico', damage: 0.4, range: 300, freeze: 1.4 },
    maxLevel: 6,
    firstLevelUses: 8,
    evolutions: [{ level: 4, name: 'Nido', line: 'Todo lo que se mueve cerca tuyo se enreda.' }],
    tree: [],
  },
  embestida_jabali: {
    id: 'embestida_jabali',
    name: 'Embestida',
    school: 'monstruo',
    rarity: 'rara',
    flavor: 'No hay plan. Hay dirección.',
    color: '#b07a4a',
    icon: 'guardian-bash',
    mana: 5,
    cooldown: 6,
    effect: { kind: 'dash', distance: 170 },
    maxLevel: 6,
    firstLevelUses: 8,
    evolutions: [],
    tree: [],
  },
  golpe_bajo: {
    id: 'golpe_bajo',
    name: 'Golpe Bajo',
    school: 'monstruo',
    rarity: 'rara',
    flavor: 'El honor es para los que pueden pagarlo.',
    color: '#d06a5a',
    icon: 'vanguard-slash',
    mana: 5,
    cooldown: 4,
    effect: { kind: 'bolt', element: 'fisico', damage: 1.6, range: 80 },
    maxLevel: 6,
    firstLevelUses: 8,
    evolutions: [],
    tree: [],
  },
};

export interface Passive {
  id: string;
  name: string;
  text: string;
  /** Health regenerated per second. */
  regen?: number;
  /** Fraction added to max health. */
  maxHp?: number;
  speed?: number;
  damage?: number;
  /** Fraction added to experience gained. */
  xp?: number;
}

/**
 * The trees players never see. Stealing from a monster of this family opens its skills and
 * grants its passive. A monster that grew stronger gives its tree further along.
 */
export const MONSTER_TREES: Record<MobFamilyId, { passive: Passive; skills: string[] }> = {
  lobezno: {
    passive: { id: 'instinto_manada', name: 'Instinto de Manada', text: 'Te movés un poco más rápido.', speed: 0.08 },
    skills: ['aullido'],
  },
  jabali: {
    passive: { id: 'cuero_grueso', name: 'Cuero Grueso', text: 'Más vida máxima.', maxHp: 0.12 },
    skills: ['embestida_jabali'],
  },
  arana: {
    passive: { id: 'hilo_sedoso', name: 'Hilo Sedoso', text: 'Tus golpes pegan un poco más.', damage: 0.06 },
    skills: ['telarana'],
  },
  saqueador: {
    passive: { id: 'ojo_botin', name: 'Ojo para el Botín', text: 'Ganás más experiencia.', xp: 0.15 },
    skills: ['golpe_bajo'],
  },
  ghoul: {
    passive: {
      id: 'carne_ghoul',
      name: 'Carne de Ghoul',
      text: 'Te regenerás solo, como algo que ya no está del todo vivo.',
      regen: 0.25,
    },
    skills: ['devorar', 'garras_ghoul'],
  },
};

/** What the dice can hand you at birth, by rarity. The eye and the monster trees stay out. */
export const DESTINY_POOL: Record<Exclude<Rarity, 'unica'>, string[]> = {
  comun: ['parada', 'refuerzo', 'paso_ligero', 'chispa', 'cura_menor'],
  rara: ['escarcha', 'rafaga', 'sismo', 'sombra_voraz', 'emboscada', 'ojo_impostor'],
  epica: ['golpe_divino', 'trueno'],
  legendaria: ['mil_espadas'],
};

/** Common 60 %, rare 27 %, epic 10 %, legendary 3 %. */
export function rollDestiny(random: () => number): { skillId: string; rarity: Rarity } {
  const r = random();
  const rarity: Exclude<Rarity, 'unica'> = r < 0.03 ? 'legendaria' : r < 0.13 ? 'epica' : r < 0.4 ? 'rara' : 'comun';
  const pool = DESTINY_POOL[rarity];
  return { skillId: pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))], rarity };
}

// ─── Growth ──────────────────────────────────────────────────────────────────────────────────

/** Uses needed to go from `level` to the next. */
export function usesToLevel(skill: WorldSkill, level: number) {
  return Math.round(skill.firstLevelUses * Math.pow(1.35, Math.max(0, level - 1)));
}

/** The name a skill carries at a given level: its latest evolution reached, or its own. */
export function skillName(skill: WorldSkill, level: number) {
  let name = skill.name;
  for (const e of skill.evolutions) if (level >= e.level) name = e.name;
  return name;
}

/** Mushoku Tensei's seven ranks. */
export const RANKS = ['Principiante', 'Intermedio', 'Avanzado', 'Santo', 'Rey', 'Emperador', 'Dios'] as const;
/** Affinity experience needed to reach each rank, from Intermedio up. */
const RANK_XP = [60, 240, 700, 1800, 4200, 9500];
/** Rank index at which arcane affinities cast without incantation. */
export const SILENT_CAST_RANK = 2;
/** Rank index at which martial affinities wake the battle aura. */
export const TOUKI_RANK = 3;

export function rankOf(xp: number) {
  let rank = 0;
  for (const needed of RANK_XP) if (xp >= needed) rank++;
  return rank;
}

export interface AffinityState {
  points: number;
  xp: number;
  /** The hidden childhood multiplier. Starts at 1; only grows while the character is young. */
  cultivation: number;
}

/**
 * The childhood rule. Using an affinity as a child (levels 1–10) raises its cultivation quickly,
 * up to three times; as a youth (11–20) slowly and with a lower ceiling; afterwards, not at all.
 * Choosing fire and never casting it until level 25 means fire grows at the base rate forever.
 */
export function cultivate(state: AffinityState, characterLevel: number) {
  if (characterLevel <= 10) state.cultivation = Math.min(3, state.cultivation + 0.02);
  else if (characterLevel <= 20) state.cultivation = Math.min(Math.max(state.cultivation, 1.8), state.cultivation + 0.004);
}

/** Affinity experience earned by one use, multiplied by how well it was cultivated. */
export function affinityGain(state: AffinityState, base = 1) {
  return base * state.cultivation;
}

// ─── Trees ───────────────────────────────────────────────────────────────────────────────────

export interface LearnCheck {
  ok: boolean;
  /** In the System's voice, ready to show the player when it is not ok. */
  reason?: string;
}

export interface SkillProgress {
  level: number;
  uses: number;
  nodes: string[];
}

export function canLearn(
  skill: WorldSkill,
  progress: SkillProgress,
  nodeId: string,
  points: number,
  stats: Stats,
): LearnCheck {
  const target = skill.tree.find((n) => n.id === nodeId);
  if (!target) return { ok: false, reason: 'Ese nodo no existe en este árbol.' };
  if (progress.nodes.includes(nodeId)) return { ok: false, reason: 'Ya lo aprendiste.' };
  if (progress.level < target.level)
    return { ok: false, reason: `«${skill.name}» tiene que llegar a nivel ${target.level}.` };
  if (points < target.cost) return { ok: false, reason: `Te faltan puntos de habilidad (${target.cost}).` };
  for (const required of target.requires ?? [])
    if (!progress.nodes.includes(required)) {
      const name = skill.tree.find((n) => n.id === required)?.name ?? required;
      return { ok: false, reason: `Primero necesitás «${name}».` };
    }
  if (target.fork) {
    const taken = skill.tree.find((n) => n.fork === target.fork && progress.nodes.includes(n.id));
    if (taken) return { ok: false, reason: `Ya elegiste «${taken.name}». Ese camino quedó cerrado para siempre.` };
  }
  for (const [stat, needed] of Object.entries(target.attributes ?? {}) as [StatId, number][])
    if (stats[stat] < needed) return { ok: false, reason: `Te falta atributo: ${STAT_NAMES[stat]} ${needed}.` };
  return { ok: true };
}

export const STAT_NAMES: Record<StatId, string> = {
  might: 'Fuerza',
  agility: 'Agilidad',
  perception: 'Percepción',
  spirit: 'Espíritu',
  vigor: 'Vigor',
};

/**
 * The effect a character's version of a skill actually has: the base effect, grown by level and
 * by every learned node. Mana and cooldown shrink with level so a trained skill costs less.
 */
export function effectiveSkill(skill: WorldSkill, progress: SkillProgress) {
  const grants = skill.tree.filter((n) => progress.nodes.includes(n.id)).map((n) => n.grants);
  const sum = (key: keyof NodeGrant) => grants.reduce((total, g) => total + ((g[key] as number | undefined) ?? 0), 0);
  const levelUp = Math.max(0, progress.level - 1);
  const effect = { ...skill.effect } as SkillEffect & Record<string, unknown>;
  const scale = 1 + 0.08 * levelUp;
  if ('damage' in effect && typeof effect.damage === 'number') effect.damage = (effect.damage + sum('damage')) * scale;
  if ('radius' in effect && typeof effect.radius === 'number') effect.radius += sum('radius');
  // A bolt has no radius of its own: a radius node makes it burst on impact instead of being lost.
  if (effect.kind === 'bolt' && sum('radius') > 0) effect.explode = ((effect.explode as number | undefined) ?? 0) + sum('radius');
  if ('range' in effect && typeof effect.range === 'number') effect.range += sum('range');
  if ('distance' in effect && typeof effect.distance === 'number') effect.distance += sum('range');
  if ('window' in effect && typeof effect.window === 'number') effect.window += sum('window');
  if ('reflect' in effect && typeof effect.reflect === 'number') effect.reflect += sum('reflect');
  if ('freeze' in effect) effect.freeze = ((effect.freeze as number | undefined) ?? 0) + sum('freeze');
  if ('amount' in effect && typeof effect.amount === 'number') effect.amount = (effect.amount + sum('heal')) * scale;
  if ('heal' in effect && typeof effect.heal === 'number') effect.heal = (effect.heal + sum('heal')) * scale;
  if ('drain' in effect || grants.some((g) => g.drain)) effect.drain = ((effect.drain as number | undefined) ?? 0) + sum('drain');
  if ('duration' in effect && typeof effect.duration === 'number') effect.duration += sum('duration');
  if (grants.some((g) => g.pierce)) (effect as { pierce?: boolean }).pierce = true;
  return {
    effect: effect as SkillEffect,
    mana: Math.max(0, skill.mana * (1 + sum('mana')) * (1 - 0.04 * levelUp)),
    cooldown: Math.max(0.2, skill.cooldown * (1 + sum('cooldown')) * (1 - 0.03 * levelUp)),
    name: skillName(skill, progress.level),
  };
}

/** A skill a character may cast: its school must be open to them. */
export function schoolOpen(
  skill: WorldSkill,
  affinities: Partial<Record<Affinity, AffinityState>>,
  trees: string[],
) {
  if (skill.school === 'cuerpo') return true;
  if (skill.school === 'monstruo')
    return Object.entries(MONSTER_TREES).some(([family, tree]) => trees.includes(family) && tree.skills.includes(skill.id));
  return (affinities[skill.school]?.points ?? 0) > 0;
}

export const AFFINITY_NAMES: Record<Affinity, string> = {
  fuego: 'Fuego',
  agua: 'Agua',
  tierra: 'Tierra',
  viento: 'Viento',
  rayo: 'Rayo',
  sombra: 'Sombra',
  luz: 'Luz',
  fuerza: 'Fuerza',
  destreza: 'Destreza',
  sigilo: 'Sigilo',
};

/** What the System says when a closed school refuses a cast. */
export function refusalFor(school: SkillSchool) {
  if (school === 'monstruo') return 'Ese poder pertenece a otra criatura.';
  if (school === 'cuerpo') return '';
  const element = AFFINITY_NAMES[school].toLowerCase();
  return ARCANE.includes(school)
    ? `Tu cuerpo no reconoce el flujo del ${element}.`
    : `Tu cuerpo todavía no sabe moverse así (${element}).`;
}
