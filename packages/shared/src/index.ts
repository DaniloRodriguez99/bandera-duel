export {
  MAPS,
  MAP_IDS,
  MODE_INFO,
  GAME_MODES,
  DEFAULT_MAP,
  DEFAULT_MODE,
  validMap,
  validMode,
  pointBush,
} from './maps.js';
export type { MapId, GameMode, MapDefinition, Bush } from './maps.js';
export * from './pve.js';
import {
  MOB_STATS, availableMobs, waveBudget, emptyUpgrades, makeUpgradeChoices,
  type Mob, type MobKind, type MobProjectile, type PveState, type UpgradeOffer, type UpgradeId,
} from './pve.js';
import {
  MAPS,
  DEFAULT_MAP,
  MODE_INFO,
  DEFAULT_MODE,
  pointBush,
  type MapId,
  type GameMode,
  type MapDefinition,
} from './maps.js';
// World monster numbers. `rpg/mobs` only imports a type from `rpg/zones`, and that one only types
// from here, so TypeScript erases both and the runtime graph stays one-way: no cycle.
import { mobStats } from './rpg/mobs.js';

export type Team = 'blue' | 'red' | 'green' | 'violet';
export type Phase = 'lobby' | 'countdown' | 'playing' | 'capture' | 'rewards' | 'finished';
export type ClassId = 'archer' | 'mage' | 'necromancer' | 'guardian' | 'vanguard';
export const CLASS_IDS: ClassId[] = ['archer', 'mage', 'necromancer', 'guardian', 'vanguard'];
export const DEFAULT_CLASS: ClassId = 'guardian';
export function validClass(value: unknown): value is ClassId {
  return typeof value === 'string' && CLASS_IDS.includes(value as ClassId);
}
export const CLASSES = {
  archer: {
    name: 'Arquero',
    label: 'ARCO Y DAGA',
    description: 'Distancia, precisión y una salida rápida.',
    hp: 3,
    speed: 190,
    meleeDamage: 0.5,
    meleeRange: 30,
    meleeArc: Math.PI * 0.6,
    windup: 0.1,
    meleeCooldown: 0.5,
    ranged: true,
    shield: false,
    dash: true,
    melee: true,
    summon: false,
  },
  mage: {
    name: 'Mago',
    label: 'FUEGO Y ESCUDO',
    description: 'Bolas de fuego. Escudo que absorbe dos golpes.',
    hp: 3,
    speed: 180,
    meleeDamage: 0,
    meleeRange: 0,
    meleeArc: 0,
    windup: 0,
    meleeCooldown: 0,
    ranged: true,
    shield: false,
    dash: true,
    melee: false,
    summon: false,
  },
  necromancer: {
    name: 'Nigromante',
    label: 'FUEGO Y NO-MUERTOS',
    description: 'Quemá de lejos. Invocá zombies que cazan solos.',
    hp: 3,
    speed: 170,
    meleeDamage: 0,
    meleeRange: 0,
    meleeArc: 0,
    windup: 0,
    meleeCooldown: 0,
    ranged: true,
    shield: false,
    dash: false,
    melee: false,
    summon: true,
  },
  guardian: {
    name: 'Caballero',
    label: 'ESPADA Y ESCUDO',
    description: 'Guardia continua, embestida, golpe de escudo y furia.',
    hp: 3,
    speed: 180,
    meleeDamage: 1,
    meleeRange: 60,
    meleeArc: Math.PI,
    windup: 0.1,
    meleeCooldown: 0.4,
    ranged: false,
    shield: true,
    dash: true,
    melee: true,
    summon: false,
  },
  vanguard: {
    name: 'Guerrero',
    label: 'ESPADA DE DOS MANOS',
    description: 'Más alcance. Más daño. Acero pesado.',
    hp: 5,
    speed: 145,
    meleeDamage: 2,
    meleeRange: 80,
    meleeArc: (Math.PI * 130) / 180,
    windup: 0.3,
    meleeCooldown: 1,
    ranged: false,
    shield: false,
    dash: true,
    melee: true,
    summon: false,
  },
} as const;
export type ChatRole = 'player' | 'spectator';
export type RoomClosingReason = 'empty' | 'inactive';
export interface ChatMessage {
  id: number;
  senderId: string;
  name: string;
  role: ChatRole;
  text: string;
  sentAt: number;
}
export interface ChatStatus {
  enabled: boolean;
  connectedPlayers: number;
  closing: boolean;
}
export interface ChatHistory extends ChatStatus {
  messages: ChatMessage[];
}
export function sanitizeChatText(value: unknown): string | null {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) return null;
  const text = value.trim().replace(/[ \t]+/g, ' ');
  return text && text.length <= 240 ? text : null;
}
export interface Vec {
  x: number;
  y: number;
}
export interface Rect extends Vec {
  w: number;
  h: number;
}
export const RULES = {
  width: 960,
  height: 540,
  /**
   * How far a charged projectile keeps flying, as a distance rather than a share of the map.
   * Deliberately a fixed number: it must NOT grow with a larger world, or a charged fireball
   * would stay alive for tens of seconds instead of crossing an arena.
   */
  projectileCrossing: 960 * 1.1,
  tick: 1 / 30,
  matchTime: 180,
  target: 3,
  radius: 12,
  carryMultiplier: 0.85,
  trapSetup: 0.5,
  trapArm: 0.5,
  trapCooldown: 8,
  trapLife: 20,
  trapMax: 3,
  trapRadius: 16,
  trapDamage: 0.5,
  trapStun: 1,
  volleyCooldown: 5,
  volleyAngle: (Math.PI * 3) / 180,
  volleyGap: 7,
  volleyChargedPower: 1 / 3,
  chargeTime: 0.8,
  chargeMultiplier: 1.3,
  windScale: 2,
  windVolleyScale: 0.8,
  windGrace: 0.6,
  shotCooldown: 0.9,
  arrowSpeed: 560,
  arrowLife: 1.2,
  archerShotCooldown: 0.7,
  archerArrowSpeed: 720,
  archerArrowRange: 672,
  arrowDamage: 1,
  guardDuration: 1.2,
  magicShieldHits: 2,
  magicShieldCooldown: 5,
  iceCooldown: 0.5,
  freezeDuration: 1,
  guardCooldown: 1,
  guardRecovery: 0.15,
  guardSpeed: 0.45,
  guardArc: (Math.PI * 2) / 3,
  guardianDashDuration: 190 / 650,
  guardianDashSpeed: 650,
  guardianDashCooldown: 3,
  guardianDashDamage: 1,
  shieldBashRange: 48,
  shieldBashArc: Math.PI / 2,
  shieldBashDamage: 0.5,
  shieldBashStun: 1.5,
  shieldBashWindup: 0.12,
  shieldBashCooldown: 6,
  furyDuration: 5,
  furyCooldown: 15,
  furyDamage: 1.4,
  slashCooldown: 5,
  slashSpeed: 420,
  slashLife: 0.65,
  slashDamage: 1.5,
  slashRadius: 24,
  vanguardDash: 0.75,
  counterWindow: 0.45,
  counterMaxHold: 2.5,
  counterChargeTime: 1,
  counterCooldown: 4,
  counterBoost: 2,
  counterSpeed: 0.5,
  attackLock: 0.2,
  dashDuration: 0.15,
  dashCooldown: 1.5,
  dashSpeed: 520,
  mageBlinkRange: 110,
  mageBlinkInvuln: 0.15,
  blackHoleCast: 2,
  blackHoleCooldown: 10,
  blackHoleDuration: 4,
  blackHoleRadius: 200,
  blackHoleBurstRadius: 90,
  blackHoleDamage: 1.5,
  blackHolePull: 90,
  hurtProtection: 0.35,
  respawn: 3,
  spawnProtection: 1,
  flagReturn: 10,
  pickupLock: 0.7,
  countdown: 3,
  capturePause: 2,
  reconnectSeconds: 15,
  chatMaxLength: 240,
  chatHistoryLimit: 50,
  chatRateLimit: 5,
  chatRateWindowSeconds: 10,
  roomInactivitySeconds: 120,
  maxPlayers: 4,
  maxDeaths: 5,
  fireSpeed: 380,
  fireLife: 1.1,
  fireDamage: 1,
  fireCooldown: 1.1,
  fireRadius: 7,
  summonCooldown: 5,
  zombieSpeed: 140,
  zombieRadius: 12,
  zombieHp: 2,
  zombieDamage: 1,
  zombieRange: 24,
  zombieWindup: 0.35,
  zombieCooldown: 1,
  // Zombies stay until they are killed (or the arena resets).
  zombieLife: 9999,
  zombieAggro: 280,
  zombieRetarget: 0.4,
  overchargeTap: 0.22,
  overchargeTime: 1.5,
  raiseCharge: 2.5,
  raiseRange: 200,
  graveLife: 10,
  thrallRise: 0.45,
  raiseCast: 0.5,
  thrallCooldown: 20,
  hatHp: 5,
  hatLife: 9999,
  hatMinionMax: 3,
  swordZombieHp: 3,
  swordZombieDamage: 1.5,
  swordZombieLevelMax: 3,
  fallenMax: 4,
  hatSpawnEvery: 5,
  hatHealEvery: 2,
  hatHeal: 0.5,
  hatCastTime: 0.5,
  hatCastCooldown: 1,
  hatCastRange: 200,
  hatSpread: (Math.PI * 6) / 180,
  spellDamage: 0.5,
  freeze: 1.2,
  explosionRadius: 45,
  iceConeRange: 160,
  iceConeArc: (Math.PI * 60) / 180,
  hatFireSpeed: 260,
  hatFireLife: 1,
  hatFireRadius: 18,
  gustEvery: 0.35,
  gustDamage: 0.25,
  gustRange: 170,
  gustSpeed: 520,
  zombieExecutions: 2,
  zombieAimRadius: 110,
  zombieFlankRadius: 34,
  zombieApproachRadius: 110,
  zombieSpread: 56,
  zombieRise: 0.45,
  zombieMarkPick: 70,
  zombieGuardRadius: 110,
} as const;

export const SKILL_SLOTS = ['primary', 'secondary', 'mobility', 'skill1', 'skill2'] as const;
export type SkillSlot = (typeof SKILL_SLOTS)[number];
export type SkillId =
  | 'archer.arrow' | 'archer.dagger' | 'archer.trap' | 'archer.volley'
  | 'mage.fireball' | 'mage.magicShield' | 'mage.ice' | 'mage.blink' | 'mage.blackHole'
  | 'necromancer.fire' | 'necromancer.summon'
  | 'guardian.sword' | 'guardian.guard' | 'guardian.dash' | 'guardian.shieldBash' | 'guardian.fury'
  | 'vanguard.sword' | 'vanguard.slash' | 'vanguard.counter'
  | 'common.dash';
export type AnimationAction =
  | 'idle' | 'move' | 'dash' | 'attack' | 'castForward' | 'castGround' | 'castChannel'
  | 'charge' | 'hit' | 'crowdControl' | 'death' | 'respawn' | 'victory';
export type SkillBranch = 'archer' | 'mage' | 'necromancer' | 'guardian' | 'vanguard' | 'common';
export interface SkillDefinition {
  id: SkillId;
  name: string;
  branch: SkillBranch;
  description: string;
  icon: string;
  compatibleClasses: readonly ClassId[];
  compatibleSlots: readonly SkillSlot[];
  trigger: 'press' | 'release' | 'hold-release' | 'hold';
  animationAction: AnimationAction;
  cooldown: number;
  damage: string;
  grants?: readonly ('ranged' | 'melee' | 'mobility' | 'shield' | 'summon' | 'companionControl')[];
}
const skill = (definition: SkillDefinition) => definition;
export const SKILLS: Record<SkillId, SkillDefinition> = {
  'archer.arrow': skill({id:'archer.arrow',name:'Flecha del cazador',branch:'archer',description:'Disparo preciso que puede cargarse.',icon:'archer-arrow',compatibleClasses:['archer'],compatibleSlots:['primary'],trigger:'hold-release',animationAction:'attack',cooldown:RULES.shotCooldown,damage:'1–1,3',grants:['ranged']}),
  'archer.dagger': skill({id:'archer.dagger',name:'Daga veloz',branch:'archer',description:'Corte corto para enemigos cercanos.',icon:'guardian-slash',compatibleClasses:['archer'],compatibleSlots:['secondary'],trigger:'press',animationAction:'attack',cooldown:CLASSES.archer.meleeCooldown,damage:'0,5',grants:['melee']}),
  'archer.trap': skill({id:'archer.trap',name:'Cepo del bosque',branch:'archer',description:'Hiere e inmoviliza al rival.',icon:'archer-trap',compatibleClasses:['archer'],compatibleSlots:['skill1','skill2'],trigger:'press',animationAction:'castGround',cooldown:RULES.trapCooldown,damage:'0,5'}),
  'archer.volley': skill({id:'archer.volley',name:'Salva triple',branch:'archer',description:'Libera tres flechas en sucesión.',icon:'archer-volley',compatibleClasses:['archer'],compatibleSlots:['skill1','skill2'],trigger:'press',animationAction:'attack',cooldown:RULES.volleyCooldown,damage:'3 × 1'}),
  'mage.fireball': skill({id:'mage.fireball',name:'Orbe de fuego',branch:'mage',description:'Esfera ígnea que explota al cargarla.',icon:'mage-fireball',compatibleClasses:['mage'],compatibleSlots:['primary'],trigger:'hold-release',animationAction:'castForward',cooldown:RULES.shotCooldown,damage:'1–2,5',grants:['ranged']}),
  'mage.magicShield': skill({id:'mage.magicShield',name:'Égida de dos sellos',branch:'mage',description:'Anula dos impactos.',icon:'mage-shield',compatibleClasses:['mage'],compatibleSlots:['secondary','skill1','skill2'],trigger:'press',animationAction:'castChannel',cooldown:RULES.magicShieldCooldown,damage:'0',grants:['shield']}),
  'mage.ice': skill({id:'mage.ice',name:'Saeta glacial',branch:'mage',description:'Inmoviliza durante un segundo.',icon:'mage-ice',compatibleClasses:['mage'],compatibleSlots:['secondary','skill1','skill2'],trigger:'press',animationAction:'castForward',cooldown:RULES.iceCooldown,damage:'0'}),
  'mage.blink': skill({id:'mage.blink',name:'Parpadeo',branch:'mage',description:'Al soltar, aparecés en el punto válido más cercano al cursor; atravesás muros.',icon:'mage-blink',compatibleClasses:['mage'],compatibleSlots:['mobility'],trigger:'release',animationAction:'dash',cooldown:RULES.dashCooldown,damage:'0',grants:['mobility']}),
  'mage.blackHole': skill({id:'mage.blackHole',name:'Singularidad',branch:'mage',description:'Canalizás 2 s; aparece donde apuntás, atrae enemigos durante 4 s y estalla.',icon:'mage-blackhole',compatibleClasses:['mage'],compatibleSlots:['secondary','skill1','skill2'],trigger:'press',animationAction:'castChannel',cooldown:RULES.blackHoleCooldown,damage:'1,5 en área'}),
  'necromancer.fire': skill({id:'necromancer.fire',name:'Llama de ultratumba',branch:'necromancer',description:'Fuego espectral que puede canalizarse.',icon:'necromancer-fire',compatibleClasses:['mage','necromancer'],compatibleSlots:['primary'],trigger:'hold-release',animationAction:'castForward',cooldown:RULES.fireCooldown,damage:'1–2',grants:['ranged']}),
  'necromancer.summon': skill({id:'necromancer.summon',name:'Alzar a los caídos',branch:'necromancer',description:'Invoca zombies, arcanistas y esclavos.',icon:'necromancer-summon',compatibleClasses:['mage','necromancer'],compatibleSlots:['secondary','skill1','skill2'],trigger:'hold-release',animationAction:'castGround',cooldown:RULES.summonCooldown,damage:'1 por golpe',grants:['summon','companionControl']}),
  'guardian.sword': skill({id:'guardian.sword',name:'Acero juramentado',branch:'guardian',description:'Tajo frontal cargable.',icon:'guardian-slash',compatibleClasses:['guardian'],compatibleSlots:['primary'],trigger:'hold-release',animationAction:'attack',cooldown:CLASSES.guardian.meleeCooldown,damage:'1–2',grants:['melee']}),
  'guardian.guard': skill({id:'guardian.guard',name:'Muralla de acero',branch:'guardian',description:'Bloqueo frontal continuo.',icon:'guardian-shield',compatibleClasses:['guardian'],compatibleSlots:['secondary'],trigger:'hold',animationAction:'castChannel',cooldown:RULES.guardCooldown,damage:'0',grants:['shield']}),
  'guardian.dash': skill({id:'guardian.dash',name:'Carga del bastión',branch:'guardian',description:'Arremetida que daña y empuja.',icon:'guardian-bash',compatibleClasses:['guardian'],compatibleSlots:['mobility'],trigger:'press',animationAction:'dash',cooldown:RULES.guardianDashCooldown,damage:'1',grants:['mobility']}),
  'guardian.shieldBash': skill({id:'guardian.shieldBash',name:'Impacto del baluarte',branch:'guardian',description:'Empuja y aturde al rival.',icon:'guardian-bash',compatibleClasses:['guardian'],compatibleSlots:['skill1','skill2'],trigger:'press',animationAction:'attack',cooldown:RULES.shieldBashCooldown,damage:'0,5'}),
  'guardian.fury': skill({id:'guardian.fury',name:'Furia dorada',branch:'guardian',description:'Aumenta el daño de espada.',icon:'guardian-fury',compatibleClasses:['guardian'],compatibleSlots:['skill1','skill2'],trigger:'press',animationAction:'castChannel',cooldown:RULES.furyCooldown,damage:'+40 %'}),
  'vanguard.sword': skill({id:'vanguard.sword',name:'Mandoble colosal',branch:'vanguard',description:'Barrido pesado de gran alcance.',icon:'vanguard-sword',compatibleClasses:['vanguard'],compatibleSlots:['primary'],trigger:'hold-release',animationAction:'attack',cooldown:CLASSES.vanguard.meleeCooldown,damage:'2–4',grants:['melee']}),
  'vanguard.slash': skill({id:'vanguard.slash',name:'Creciente escarlata',branch:'vanguard',description:'Tajo que atraviesa enemigos.',icon:'vanguard-slash',compatibleClasses:['vanguard'],compatibleSlots:['skill1','skill2'],trigger:'press',animationAction:'attack',cooldown:RULES.slashCooldown,damage:'1,5'}),
  'vanguard.counter': skill({id:'vanguard.counter',name:'Revancha de hierro',branch:'vanguard',description:'Devuelve proyectiles.',icon:'vanguard-counter',compatibleClasses:['vanguard'],compatibleSlots:['skill1','skill2'],trigger:'hold',animationAction:'castChannel',cooldown:RULES.counterCooldown,damage:'×1–×2'}),
  'common.dash': skill({id:'common.dash',name:'Traslación',branch:'common',description:'Desplazamiento cargable.',icon:'mage-dash',compatibleClasses:['archer','vanguard'],compatibleSlots:['mobility'],trigger:'hold-release',animationAction:'dash',cooldown:RULES.dashCooldown,damage:'0',grants:['mobility']}),
};
export type PhysicalBinding = 'MouseLeft' | 'MouseRight' | 'MouseMiddle' | 'Space' | 'Shift' | 'Ctrl' | `Key${'Q'|'E'|'R'|'F'|'C'|'X'|'Z'|'V'|'G'|'T'}`;
export const ALLOWED_BINDINGS:readonly PhysicalBinding[]=['MouseLeft','MouseRight','MouseMiddle','Space','Shift','Ctrl','KeyQ','KeyE','KeyR','KeyF','KeyC','KeyX','KeyZ','KeyV','KeyG','KeyT'];
export const validBinding=(value:unknown):value is PhysicalBinding=>typeof value==='string'&&(ALLOWED_BINDINGS as readonly string[]).includes(value);
export type BindableAction = SkillSlot | 'companionCommand';
export type InputBindings = Record<BindableAction, PhysicalBinding>;
export type CharacterLoadout = Record<SkillSlot, SkillId | null>;
export interface CharacterPreset {
  loadout: CharacterLoadout;
  bindings: InputBindings;
  skillTreeSelection: SkillId[];
}
export interface CharacterCustomization {
  version: 1;
  classId: ClassId;
  selectedSkin: string;
  activePresetId: string;
  presets: Record<string, CharacterPreset>;
}
export interface CharacterSkinDefinition {
  id: string;
  classId: ClassId;
  name: string;
  description: string;
  cloth: string;
  light: string;
  accent: string;
  silhouette: 'classic' | 'hood' | 'crown' | 'armor' | 'turban' | 'horns';
}
export const MAGE_SKINS: CharacterSkinDefinition[] = [
  {id:'mage.arcaneRoyal',classId:'mage',name:'Arcanista Real',description:'La túnica tradicional de la corte.',cloth:'#64897e',light:'#b6cbb0',accent:'#9edcff',silhouette:'classic'},
  {id:'mage.crimsonPyromancer',classId:'mage',name:'Piromante Carmesí',description:'Vestiduras quemadas y un núcleo de fuego.',cloth:'#9d3c2f',light:'#ff9b45',accent:'#ff5a24',silhouette:'hood'},
  {id:'mage.glacialSage',classId:'mage',name:'Sabio Glacial',description:'Capas de hielo y cristal eterno.',cloth:'#3979a5',light:'#b9efff',accent:'#72dfff',silhouette:'crown'},
  {id:'mage.shadowWeaver',classId:'mage',name:'Tejedor de Sombras',description:'Un manto que bebe la luz.',cloth:'#392a57',light:'#9b78d1',accent:'#c66bff',silhouette:'hood'},
  {id:'mage.violetAstronomer',classId:'mage',name:'Astrónomo Violeta',description:'Lee el destino entre constelaciones.',cloth:'#59458c',light:'#d4b7ff',accent:'#eee2ff',silhouette:'crown'},
  {id:'mage.runicBattlemage',classId:'mage',name:'Mago de Batalla Rúnico',description:'Acero encantado para la primera línea.',cloth:'#4c6670',light:'#c5d2cf',accent:'#f0c66f',silhouette:'armor'},
  {id:'mage.desertOracle',classId:'mage',name:'Oráculo del Desierto',description:'Arena, oro y secretos antiguos.',cloth:'#a56c35',light:'#f2d28d',accent:'#78d8c8',silhouette:'turban'},
  {id:'mage.stormCaller',classId:'mage',name:'Invocador de Tormentas',description:'Canaliza relámpagos en su bastón.',cloth:'#315f78',light:'#95cbdf',accent:'#f5ed7d',silhouette:'classic'},
  {id:'mage.bloodWarlock',classId:'mage',name:'Brujo de Sangre',description:'Poder prohibido escrito en carmesí.',cloth:'#671d2c',light:'#d35a64',accent:'#ff334f',silhouette:'horns'},
  {id:'mage.emeraldGuardian',classId:'mage',name:'Guardián Esmeralda',description:'Magia viva de los bosques antiguos.',cloth:'#376b48',light:'#9fd58b',accent:'#77f0a1',silhouette:'crown'},
];
const classSkins = (classId:ClassId, entries:Omit<CharacterSkinDefinition,'classId'>[]):CharacterSkinDefinition[] => entries.map(entry=>({...entry,classId}));
export const CHARACTER_SKINS:Record<ClassId,CharacterSkinDefinition[]> = {
  archer:classSkins('archer',[
    {id:'archer.royalRanger',name:'Guardabosques Real',description:'Cuero verde y plumas de la guardia del rey.',cloth:'#64897e',light:'#b6cbb0',accent:'#eac787',silhouette:'classic'},
    {id:'archer.crimsonStalker',name:'Acechador Carmesí',description:'Cazador de primera línea cubierto de rojo.',cloth:'#8f3b35',light:'#dc7664',accent:'#ffc06d',silhouette:'hood'},
    {id:'archer.winterMarksman',name:'Tirador Invernal',description:'Capas claras para los pasos helados.',cloth:'#477b94',light:'#b9e5ed',accent:'#72dfff',silhouette:'crown'},
    {id:'archer.nightHunter',name:'Cazador Nocturno',description:'Una silueta oscura que desaparece entre sombras.',cloth:'#34304f',light:'#8075aa',accent:'#c274ff',silhouette:'hood'},
    {id:'archer.emeraldScout',name:'Explorador Esmeralda',description:'Camuflaje vivo de los bosques antiguos.',cloth:'#39704c',light:'#91c879',accent:'#d5e57a',silhouette:'classic'},
  ]),
  mage:MAGE_SKINS,
  necromancer:classSkins('necromancer',[
    {id:'necromancer.cryptHerald',name:'Heraldo de la Cripta',description:'Los colores tradicionales de los guardianes del osario.',cloth:'#554067',light:'#9d79b5',accent:'#e58a55',silhouette:'classic'},
    {id:'necromancer.boneLord',name:'Señor Óseo',description:'Una corona de hueso anuncia a los muertos.',cloth:'#676054',light:'#d1c5a5',accent:'#eef0d0',silhouette:'crown'},
    {id:'necromancer.crimsonPlague',name:'Plaga Carmesí',description:'Vestiduras marcadas por una peste prohibida.',cloth:'#6e2932',light:'#c45862',accent:'#ff704d',silhouette:'hood'},
    {id:'necromancer.funeralOracle',name:'Oráculo Funerario',description:'Lee el porvenir en las cenizas de los caídos.',cloth:'#334c59',light:'#7fa5a8',accent:'#7ee6bd',silhouette:'turban'},
    {id:'necromancer.lichKing',name:'Rey Exánime',description:'Armadura ritual para gobernar a los sin nombre.',cloth:'#332648',light:'#76588f',accent:'#b96cff',silhouette:'armor'},
  ]),
  guardian:classSkins('guardian',[
    {id:'guardian.royalBastion',name:'Bastión Real',description:'Acero y oro de la guardia del castillo.',cloth:'#607c73',light:'#c2d2ca',accent:'#eac787',silhouette:'classic'},
    {id:'guardian.crimsonGuard',name:'Guardia Carmesí',description:'Escudo rojo para sostener la primera línea.',cloth:'#873b37',light:'#d77969',accent:'#ffbd68',silhouette:'armor'},
    {id:'guardian.glacialSentinel',name:'Centinela Glacial',description:'Placas azules templadas contra el hielo.',cloth:'#426d89',light:'#a8d8e8',accent:'#70ddff',silhouette:'crown'},
    {id:'guardian.jadeWall',name:'Muro de Jade',description:'Una armadura verde que nunca retrocede.',cloth:'#3e7054',light:'#93c79a',accent:'#7ef0a0',silhouette:'armor'},
    {id:'guardian.solarPaladin',name:'Paladín Solar',description:'La luz del juramento grabada en cada placa.',cloth:'#9a7137',light:'#f0cf82',accent:'#fff09a',silhouette:'crown'},
  ]),
  vanguard:classSkins('vanguard',[
    {id:'vanguard.royalExecutioner',name:'Verdugo Real',description:'El mandoble ceremonial de la corona.',cloth:'#68736f',light:'#c6cfca',accent:'#eac787',silhouette:'classic'},
    {id:'vanguard.crimsonGreatsword',name:'Espadón Carmesí',description:'Armadura roja para una ofensiva sin pausa.',cloth:'#852f32',light:'#ce6262',accent:'#ff9a5d',silhouette:'armor'},
    {id:'vanguard.ironTitan',name:'Titán de Hierro',description:'Placas pesadas hechas para romper formaciones.',cloth:'#4c5660',light:'#aeb9c2',accent:'#d9e1e5',silhouette:'armor'},
    {id:'vanguard.shadowReaper',name:'Segador Umbrío',description:'Acero oscuro y una presencia que apaga la arena.',cloth:'#302c42',light:'#746982',accent:'#bd73ef',silhouette:'horns'},
    {id:'vanguard.goldenChampion',name:'Campeón Dorado',description:'Un veterano cubierto por los colores de la victoria.',cloth:'#9b7138',light:'#efca76',accent:'#fff0a2',silhouette:'crown'},
  ]),
};
export const skinsForClass=(classId:ClassId)=>CHARACTER_SKINS[classId];
const loadout = (primary:SkillId|null,secondary:SkillId|null,mobility:SkillId|null,skill1:SkillId|null,skill2:SkillId|null):CharacterLoadout => ({primary,secondary,mobility,skill1,skill2});
const bindings = (secondary:PhysicalBinding, mobility:PhysicalBinding, skill1:PhysicalBinding, skill2:PhysicalBinding, companionCommand:PhysicalBinding='KeyE'):InputBindings => ({primary:'MouseLeft',secondary,mobility,skill1,skill2,companionCommand});
export const DEFAULT_LOADOUTS: Record<ClassId, CharacterLoadout> = {
  archer:loadout('archer.arrow','archer.dagger','common.dash','archer.trap','archer.volley'),
  mage:loadout('mage.fireball','mage.magicShield','mage.blink','mage.ice','mage.blackHole'),
  necromancer:loadout('necromancer.fire',null,null,'necromancer.summon',null),
  guardian:loadout('guardian.sword','guardian.guard','guardian.dash','guardian.shieldBash','guardian.fury'),
  vanguard:loadout('vanguard.sword',null,'common.dash','vanguard.slash','vanguard.counter'),
};
export const DEFAULT_BINDINGS: Record<ClassId, InputBindings> = {
  archer:bindings('MouseRight','Space','KeyQ','KeyE'), mage:bindings('MouseRight','Space','MouseMiddle','KeyE','KeyR'),
  necromancer:bindings('MouseRight','Space','Space','KeyQ'), guardian:bindings('MouseRight','Space','KeyQ','KeyE'),
  vanguard:bindings('MouseRight','Space','KeyQ','KeyE'),
};
export const defaultSkin = (classId:ClassId) => CHARACTER_SKINS[classId][0].id;
export function defaultCustomization(classId:ClassId):CharacterCustomization {
  const preset={loadout:{...DEFAULT_LOADOUTS[classId]},bindings:{...DEFAULT_BINDINGS[classId]},skillTreeSelection:Object.values(DEFAULT_LOADOUTS[classId]).filter(Boolean) as SkillId[]};
  return {version:1,classId,selectedSkin:defaultSkin(classId),activePresetId:'default',presets:{default:preset}};
}
export const activePreset = (customization:CharacterCustomization) => customization.presets[customization.activePresetId] ?? customization.presets.default;
export const validSkill = (value:unknown):value is SkillId => typeof value === 'string' && value in SKILLS;
export function validLoadout(classId:ClassId,value:unknown):value is CharacterLoadout {
  if(!value||typeof value!=='object')return false;
  const record=value as Record<string,unknown>,seen=new Set<string>();
  return SKILL_SLOTS.every(slot=>{const id=record[slot];if(id===null)return true;if(!validSkill(id)||seen.has(id))return false;seen.add(id);const def=SKILLS[id];return def.compatibleClasses.includes(classId)&&def.compatibleSlots.includes(slot);});
}
export function validCustomization(classId:ClassId,value:unknown):value is CharacterCustomization {
  if(!value||typeof value!=='object')return false;const c=value as CharacterCustomization;
  if(c.version!==1||c.classId!==classId||typeof c.activePresetId!=='string'||!c.presets||typeof c.presets!=='object')return false;
  if(!CHARACTER_SKINS[classId].some(s=>s.id===c.selectedSkin))return false;
  const presets=Object.values(c.presets);if(!presets.length||!c.presets[c.activePresetId])return false;
  return presets.every(preset=>{
    if(!validLoadout(classId,preset.loadout)||!preset.bindings||!Array.isArray(preset.skillTreeSelection)||!preset.skillTreeSelection.every(validSkill))return false;
    const used=new Set<string>();for(const slot of SKILL_SLOTS){if(!preset.loadout[slot])continue;const binding=preset.bindings[slot];if(!validBinding(binding)||used.has(binding))return false;used.add(binding);}
    if(!validBinding(preset.bindings.companionCommand))return false;
    return !Object.values(preset.loadout).includes('necromancer.summon')||!used.has(preset.bindings.companionCommand);
  });
}
export const equippedSkill = (p:{loadout:CharacterLoadout},id:SkillId) => Object.values(p.loadout).includes(id);
export const TEAMS: Team[] = ['blue', 'red', 'green', 'violet'];
export const TEAM_NAMES: Record<Team, string> = {
  blue: 'AZUL',
  red: 'CARMESÍ',
  green: 'JADE',
  violet: 'VIOLETA',
};
export const TEAM_ICONS: Record<Team, string> = { blue: '◆', red: '✚', green: '▲', violet: '●' };
export const emptyScore = (): Record<Team, number> => ({ blue: 0, red: 0, green: 0, violet: 0 });
export const SPAWNS = { blue: { x: 70, y: 270 }, red: { x: 890, y: 270 } } satisfies Record<
  string,
  Vec
>;
export const HOMES = { blue: { x: 145, y: 270 }, red: { x: 815, y: 270 } } satisfies Record<
  string,
  Vec
>;
export const CORNER_SPAWNS: Record<Team, Vec> = {
  blue: { x: 70, y: 120 },
  red: { x: 890, y: 120 },
  green: { x: 70, y: 420 },
  violet: { x: 890, y: 420 },
};
export const CORNER_HOMES: Record<Team, Vec> = {
  blue: { x: 145, y: 120 },
  red: { x: 815, y: 120 },
  green: { x: 145, y: 420 },
  violet: { x: 815, y: 420 },
};
export interface Base {
  team: Team;
  home: Vec;
  spawn: Vec;
}
export function layout(
  teams: Team[],
  mapId: MapId = DEFAULT_MAP,
  mode: GameMode = teams.length <= 2 ? 'duel' : 'ffa4',
): Base[] {
  const map = MAPS[mapId],
    unique = [...new Set(teams)];
  return unique.map((team) =>
    mode === 'duel' || mode === 'teams'
      ? {
          team,
          home: { ...map.sideHomes[team === 'red' ? 'red' : 'blue'] },
          spawn: { ...map.sideSpawns[team === 'red' ? 'red' : 'blue'][0] },
        }
      : { team, home: { ...map.cornerHomes[team] }, spawn: { ...map.cornerSpawns[team][0] } },
  );
}
export const WALLS: Rect[] = [
  { x: 245, y: 116, w: 52, h: 96 },
  { x: 245, y: 328, w: 52, h: 96 },
  { x: 663, y: 116, w: 52, h: 96 },
  { x: 663, y: 328, w: 52, h: 96 },
  { x: 423, y: 164, w: 114, h: 42 },
  { x: 423, y: 334, w: 114, h: 42 },
];
export interface Input {
  seq: number;
  x: number;
  y: number;
  angle: number;
  sword: boolean;
  shot: boolean;
  charge: boolean;
  dash: boolean;
  blackHole: boolean;
  guard: boolean;
  summon: boolean;
  ice: boolean;
  trap: boolean;
  volley: boolean;
  special: boolean;
  /** Q by the knight: short shield strike. */
  shieldBash: boolean;
  /** E by the knight: five seconds of stronger sword attacks. */
  fury: boolean;
  /** Q by the warrior: travelling slash. */
  slash: boolean;
  /** E held by the warrior: full counter. */
  counter: boolean;
  /** E: toggles automatic zombies (no guard circle, no cursor squad). */
  command: boolean;
  /** ⌘E / Ctrl+E: moves the zombie under the cursor between the guard circle and the cursor. */
  mark: boolean;
  aimX: number;
  aimY: number;
  /** Logical controls sent over the network. Skill ids never cross the input boundary. */
  slots: SlotInputMap;
}
export interface SlotInputState { pressed: boolean; held: boolean; released: boolean }
export type SlotInputMap = Record<SkillSlot, SlotInputState>;
const idleSlot = (): SlotInputState => ({ pressed: false, held: false, released: false });
export const idleSlots = (): SlotInputMap => ({
  primary: idleSlot(), secondary: idleSlot(), mobility: idleSlot(), skill1: idleSlot(), skill2: idleSlot(),
});
/** Guards stay in the red circle around their necromancer; cursor zombies follow the mouse. */
export type ZombieRole = 'guard' | 'cursor';
export const idleInput = (seq = 0, angle = 0): Input => ({
  seq,
  x: 0,
  y: 0,
  angle,
  sword: false,
  shot: false,
  charge: false,
  dash: false,
  blackHole: false,
  guard: false,
  summon: false,
  ice: false,
  trap: false,
  volley: false,
  special: false,
  shieldBash: false,
  fury: false,
  slash: false,
  counter: false,
  command: false,
  mark: false,
  aimX: -1,
  aimY: -1,
  slots: idleSlots(),
});
/** During PvE rewards only movement and facing are authoritative; every combat action is discarded. */
export const movementInput = (input: Input): Input => ({
  ...idleInput(input.seq, input.angle),
  x: input.x,
  y: input.y,
  aimX: input.aimX,
  aimY: input.aimY,
});
/** A world point under the cursor; -1 means the client did not provide one. */
const aimCoordinate = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(max, value) : -1;
export function sanitizeInput(raw: unknown): Input | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    !Number.isSafeInteger(r.seq) ||
    (r.seq as number) < 0 ||
    !['x', 'y', 'angle'].every((k) => typeof r[k] === 'number' && Number.isFinite(r[k]))
  )
    return null;
  if (
    Math.abs(r.x as number) > 1 ||
    Math.abs(r.y as number) > 1 ||
    Math.abs(r.angle as number) > 100
  )
    return null;
  const n = Math.max(1, Math.hypot(r.x as number, r.y as number));
  const rawSlots = r.slots && typeof r.slots === 'object' ? r.slots as Record<string, unknown> : {};
  const slots = idleSlots();
  for (const slot of SKILL_SLOTS) {
    const state = rawSlots[slot];
    if (!state || typeof state !== 'object') continue;
    const value = state as Record<string, unknown>;
    slots[slot] = { pressed: value.pressed === true, held: value.held === true, released: value.released === true };
  }
  return {
    seq: r.seq as number,
    x: (r.x as number) / n,
    y: (r.y as number) / n,
    angle: r.angle as number,
    sword: r.sword === true,
    shot: r.shot === true,
    charge: r.charge === true,
    dash: r.dash === true,
    blackHole: r.blackHole === true,
    guard: r.guard === true,
    summon: r.summon === true,
    ice: r.ice === true,
    trap: r.trap === true,
    volley: r.volley === true,
    special: r.special === true,
    shieldBash: r.shieldBash === true,
    fury: r.fury === true,
    slash: r.slash === true,
    counter: r.counter === true,
    command: r.command === true,
    mark: r.mark === true,
    aimX: aimCoordinate(r.aimX, RULES.width),
    aimY: aimCoordinate(r.aimY, RULES.height),
    slots,
  };
}
export function validName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N} _.-]{1,16}$/u.test(name) ? name : null;
}
export interface Player extends Vec {
  id: string;
  name: string;
  team: Team;
  classId: ClassId;
  /** World only: how the bearer of its weapon looks, whatever engine class simulates it. */
  look?: string;
  /** World only: the colour of the affinity the weapon carries right now, while imbued. */
  imbue?: string;
  skinId: string;
  loadout: CharacterLoadout;
  profileRevision: number;
  maxHp: number;
  hp: number;
  angle: number;
  ready: boolean;
  connected: boolean;
  ack: number;
  swordCd: number;
  shotCd: number;
  shotCharge: number;
  dashCd: number;
  blackHoleCast: number;
  blackHoleCd: number;
  blackHoleX: number;
  blackHoleY: number;
  /** World incantation preview; duel casting uses blackHoleCast and the fixed aim coordinates. */
  blackHoleTelegraph?: { x:number; y:number; left:number; total:number };
  attackLock: number;
  dashLeft: number;
  dashX: number;
  dashY: number;
  dashInvulnerable: boolean;
  guarding: boolean;
  guardLeft: number;
  guardCd: number;
  guardRecovery: number;
  guardHeld: boolean;
  magicShieldHits: number;
  magicShieldCd: number;
  windup: number;
  swingAngle: number;
  invuln: number;
  respawnLeft: number;
  hitFlash: number;
  deaths: number;
  eliminated: boolean;
  summonCd: number;
  iceCd: number;
  trapCd: number;
  trapLeft: number;
  volleyCd: number;
  stunLeft: number;
  /** Floor traps stun through knight guard without lowering the held shield. */
  guardStunExempt: boolean;
  /** Seconds left of a fully charged archer dash: shot or volley released now become the dash combo. */
  windDash: number;
  /** Warrior's travelling slash cooldown (Q). */
  slashCd: number;
  /** Knight's shield strike preparation and cooldown. */
  shieldBashLeft: number;
  shieldBashCd: number;
  shieldBashAngle: number;
  /** Knight's damage aura and its cooldown. */
  furyLeft: number;
  furyCd: number;
  /** Warrior's full counter (E): seconds it stays up, seconds held (charge), cooldown, E still held. */
  counterLeft: number;
  counterCharge: number;
  counterCd: number;
  counterHeld: boolean;
  /** Guard zombies killed in the red circle, waiting to come back as sword zombies. */
  fallenGuards: number;
  activeTraps: number;
  specialCharge: number;
  swingPower: number;
  frozenLeft: number;
  thrall: { classId: ClassId; name: string } | null;
  thrallCd: number;
  hatAlive: boolean;
  thrallAlive: boolean;
  /** Seconds left of the raise cast; the necromancer stays still while it lasts. */
  raiseCast: number;
  raiseX: number;
  raiseY: number;
  activeExecutions: number;
  /** E: every zombie hunts on its own instead of guarding or following the cursor. */
  zombieAuto: boolean;
  aimX: number;
  aimY: number;
  bushId: string | null;
  revealLeft: number;
  pve: import('./pve.js').PlayerUpgradeState;
  pveKills: number;
  pveDamage: number;
  /**
   * The RPG sheet, mirrored from the saved character so the simulation and the other players'
   * views can read it cheaply. A duel player keeps `maxMana` at 0, and that zero is the guard
   * that leaves the duel simulation byte for byte as it was.
   */
  level: number;
  mana: number;
  maxMana: number;
}
export interface Flag extends Vec {
  team: Team;
  status: 'home' | 'carried' | 'dropped';
  carrier: string | null;
  returnLeft: number;
  blockedId: string | null;
  lockLeft: number;
}
export interface Arrow extends Vec {
  skillId?: SkillId;
  ice?: boolean;
  charged?: boolean;
  power?: number;
  damageScale?: number;
  speedScale?: number;
  element?: 'fire' | 'ice';
  /** World only: the affinity it carries, which decides how it looks (a lightning bolt, an ember). */
  worldElement?: string;
  /** Wind arrow: pierces every target once, crosses knight guard and breaks magic shields. */
  wind?: boolean;
  /** Rivals and zombies this arrow already went through. */
  hits?: string[];
  /** Arrows of one volley share this id. */
  volley?: number;
  /** Warrior's travelling slash: a wide crescent that cuts through everyone in its path. */
  slash?: boolean;
  /** Sent back by a warrior's counter: 1 normal, 2 charged (double speed and damage). */
  reflected?: number;
  /** Zombie mage fireball: area fire that passes through everyone in its path. */
  blast?: boolean;
  /** Zombie mage's short wind gust between spells. */
  gust?: boolean;
  id: number;
  owner: string;
  team: Team;
  classId: ClassId;
  angle: number;
  life: number;
}
export interface Trap extends Vec {
  id: number;
  pveScale?: number;
  owner: string;
  team: Team;
  armLeft: number;
  life: number;
}
/** Skills a revived player uses (cooldown keys), plus the combo and riposte windows. */
export type ThrallSkill =
  | 'charged'
  | 'volley'
  | 'trap'
  | 'dash'
  | 'wind'
  | 'ice'
  | 'combo'
  | 'shield'
  | 'summon'
  | 'hat'
  | 'raise'
  | 'guard'
  | 'riposte'
  | 'slash'
  | 'counter';
/** A thrall's skill in progress: a charge, a dash or a raise (with the grave it raises). */
export interface ThrallAction {
  skill: ThrallSkill;
  left: number;
  total: number;
  angle: number;
  x?: number;
  y?: number;
  classId?: ClassId;
  name?: string;
}
export interface Zombie extends Vec {
  id: string;
  owner: string;
  team: Team;
  hp: number;
  angle: number;
  windup: number;
  attackCd: number;
  life: number;
  target: string | null;
  retarget: number;
  kind: 'brute' | 'hat' | 'thrall' | 'sword';
  bonus: boolean;
  maxHp: number;
  cast: number;
  castCd: number;
  healCd: number;
  spawnLeft: number;
  frozenLeft: number;
  classId?: ClassId;
  name?: string;
  role: ZombieRole;
  execution: number | null;
  slot: number;
  rise: number;
  bushId: string | null;
  revealLeft: number;
  /** Sword zombie level, 1 to 3: one level per kill. Also the level of a world monster. */
  level: number;
  /**
   * World monsters. A wild unit has no owning player, so `zombieMode` already falls through to
   * automatic and it hunts whoever comes near; `family` is what makes a wolf cub and a boar
   * fight differently instead of sharing the necromancer's numbers.
   */
  family?: import('./rpg/zones.js').MobFamilyId;
  faction?: 'monster';
  /** Zombie mage: the spell it casts next (alternates ice and fire). */
  spell: 'ice' | 'fire';
  gustCd: number;
  /** Revived player: per-skill cooldowns, the skill in progress and its defensive stances. */
  skillCd: Partial<Record<ThrallSkill, number>>;
  action: ThrallAction | null;
  shieldHits: number;
  guardLeft: number;
  counterLeft: number;
  /** Thrall that summoned or raised this zombie; its own caps count by it. */
  summoner?: string;
  /**
   * World monsters: the skill being wound up, so every client can draw the warning where it will
   * land before it does. Absent in matches.
   */
  skill?: { name: string; kind: string; left: number; total: number; x: number; y: number; radius: number; color: string };
}
export interface GameEvent extends Vec {
  id: number;
  kind:
    | 'sword'
    | 'shot'
    | 'hit'
    | 'death'
    | 'capture'
    | 'return'
    | 'pickup'
    | 'block'
    | 'summon'
    | 'heal'
    | 'freeze'
    | 'raise'
    | 'cast'
    | 'explosion'
    | 'wind'
    | 'mandala'
    | 'slash'
    | 'counter'
    | 'dash'
    | 'blink'
    | 'blackhole'
    | 'bash'
    | 'fury'
    | 'levelup'
    | 'icecone'
    | 'mobSpawn'
    | 'mobAttack'
    | 'wave'
    | 'upgrade'
    | 'imbue';
  team: Team;
  angle?: number;
  classId?: ClassId;
  skillId?: SkillId;
  power?: number;
  /** Blink only: where the teleport lands (the event's x/y stay at the origin). */
  tx?: number;
  ty?: number;
  /** Blink only: which player teleported, so the client can snap its body. */
  playerId?: string;
  /** World only: the colour of the element or skill behind it, so an explosion of lightning is not fire. */
  color?: string;
}
/** Zombies from the charged summon (hat, its minions, thrall) never use the normal cap. */
export const countsTowardLimit = (z: Zombie) => !z.bonus;
/** Sword zombie by level: harder hits, more life and faster swings; level 3 cleaves everyone in reach. */
export function swordZombieStats(level: number) {
  const up = Math.max(0, Math.min(RULES.swordZombieLevelMax, level) - 1);
  return {
    damage: RULES.swordZombieDamage + up * 0.5,
    hp: RULES.swordZombieHp + up,
    cooldown: RULES.zombieCooldown * (1 - 0.15 * up),
    pace: 1 + 0.08 * up,
    cleave: up >= 2,
  };
}
/** Where a rival fell: a necromancer can raise it until it crumbles, even after they respawn. */
export interface Grave extends Vec {
  classId: ClassId;
  name: string;
  team: Team;
  left: number;
  /** World only: who lies here, who killed them, and what they were. Duels never set these. */
  victim?: string;
  killer?: string;
  level?: number;
  maxHp?: number;
}
/** Anything that takes a side in a fight. Duels read only `team`; the world reads the rest. */
export type Allegiant = Pick<Player, 'team'> & {
  id?: string | number;
  owner?: string;
  faction?: 'monster';
  victim?: string;
  x?: number;
  y?: number;
};
export interface Participant {
  id: string;
  name: string;
  team: Team;
  classId: ClassId;
  ready: boolean;
  connected: boolean;
  deaths: number;
}
export interface Snapshot {
  mapId: MapId;
  mode: GameMode;
  maxPlayers: number;
  perspective: Team | null;
  tick: number;
  phase: Phase;
  phaseLeft: number;
  timeLeft: number;
  paused: boolean;
  reconnectLeft: number;
  players: Player[];
  participants: Participant[];
  bases: Base[];
  flags: Flag[];
  arrows: Arrow[];
  blackHoles: BlackHole[];
  zombies: Zombie[];
  mobs: Mob[];
  mobProjectiles: MobProjectile[];
  graves: Grave[];
  traps: Trap[];
  score: Record<Team, number>;
  winner: Team | 'draw' | null;
  reason: string;
  events: GameEvent[];
  pve: PveState | null;
}
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function playerVisibleTo(state: Snapshot, target: Player, viewerTeam: Team): boolean {
  if (
    target.team === viewerTeam ||
    !target.bushId ||
    target.revealLeft > 0 ||
    state.flags.some((f) => f.carrier === target.id)
  )
    return true;
  const map = MAPS[state.mapId];
  return state.players.some(
    (v) =>
      v.team === viewerTeam &&
      v.hp > 0 &&
      v.bushId === target.bushId &&
      distance(v, target) <= 90 &&
      lineClear(v, target, map.walls),
  );
}
export function zombieVisibleTo(state: Snapshot, target: Zombie, viewerTeam: Team): boolean {
  if (target.team === viewerTeam || !target.bushId || target.revealLeft > 0) return true;
  const map = MAPS[state.mapId];
  return state.players.some(
    (v) =>
      v.team === viewerTeam &&
      v.hp > 0 &&
      v.bushId === target.bushId &&
      distance(v, target) <= 90 &&
      lineClear(v, target, map.walls),
  );
}
/** The rectangle an entity may move inside. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
/** Walls plus the area that holds them. A zone carries its own; the arena maps share one. */
export interface Terrain {
  walls: Rect[];
  bounds: Bounds;
  /**
   * World only: deep water. It stops bodies (walking, knockback, paths) but not what flies over it
   * (arrows, sight), which is why it is not a wall. The arenas have none.
   */
  water?: Rect[];
}
export const ARENA_BOUNDS: Bounds = {
  minX: 20,
  minY: 20,
  maxX: RULES.width - 20,
  maxY: RULES.height - 20,
};
/**
 * A bare wall list still means the fixed arena it has always meant, so every existing caller and
 * test keeps its exact behaviour. Memoised per array so the geometry helpers can key caches on the
 * resulting object instead of stringifying the walls on every call.
 */
const legacyTerrain = new WeakMap<Rect[], Terrain>();
export function terrainOf(source: Rect[] | Terrain): Terrain {
  if (!Array.isArray(source)) return source;
  let terrain = legacyTerrain.get(source);
  if (!terrain) {
    terrain = { walls: source, bounds: ARENA_BOUNDS };
    legacyTerrain.set(source, terrain);
  }
  return terrain;
}
export function blocked(
  x: number,
  y: number,
  radius = RULES.radius as number,
  source: Rect[] | Terrain = WALLS,
): boolean {
  const { walls, bounds } = terrainOf(source);
  if (
    x - radius < bounds.minX ||
    y - radius < bounds.minY ||
    x + radius > bounds.maxX ||
    y + radius > bounds.maxY
  )
    return true;
  return walls.some((w) => {
    const dx = x - Math.max(w.x, Math.min(x, w.x + w.w));
    const dy = y - Math.max(w.y, Math.min(y, w.y + w.h));
    return dx * dx + dy * dy < radius * radius;
  });
}
/** Whether a body of this radius would stand in deep water. Always false in the arenas. */
export function wet(x: number, y: number, radius: number, source: Rect[] | Terrain): boolean {
  const water = terrainOf(source).water;
  if (!water) return false;
  return water.some((w) => {
    const dx = x - Math.max(w.x, Math.min(x, w.x + w.w));
    const dy = y - Math.max(w.y, Math.min(y, w.y + w.h));
    return dx * dx + dy * dy < radius * radius;
  });
}
/** Where a body cannot be: inside a wall, outside the bounds, or in deep water. */
export function solid(x: number, y: number, radius: number, source: Rect[] | Terrain): boolean {
  return blocked(x, y, radius, source) || wet(x, y, radius, source);
}
export function translate(p: Vec, dx: number, dy: number, walls: Rect[] | Terrain = WALLS) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 0; i < steps; i++) {
    if (!solid(p.x + dx / steps, p.y, RULES.radius, walls)) p.x += dx / steps;
    if (!solid(p.x, p.y + dy / steps, RULES.radius, walls)) p.y += dy / steps;
  }
}
export interface BlackHole extends Vec {
  id: number;
  owner: string;
  team: Team;
  radius: number;
  burstRadius: number;
  pull: number;
  damage: number;
  left: number;
  total: number;
}
/** Where a blink lands: the far point, or the nearest free spot walking back toward the origin. */
export function blinkTarget(from: Vec, angle: number, range: number, walls: Rect[] | Terrain = WALLS): Vec {
  const tx = from.x + Math.cos(angle) * range;
  const ty = from.y + Math.sin(angle) * range;
  const steps = Math.max(1, Math.ceil(range / 6));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (tx - from.x) * (1 - t);
    const y = from.y + (ty - from.y) * (1 - t);
    if (!solid(x, y, RULES.radius, walls)) return { x, y };
  }
  return { x: from.x, y: from.y };
}
export function lineClear(a: Vec, b: Vec, walls: Rect[] | Terrain = WALLS): boolean {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 5));
  for (let i = 1; i <= steps; i++)
    if (blocked(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, 1, walls))
      return false;
  return true;
}
/** Full-charge multipliers for held abilities; the archer keeps its own 0.8 s charge. */
const OVERCHARGE: Partial<Record<ClassId, { damage: number; radius: number; speed: number }>> = {
  mage: { damage: 2.5, radius: 2, speed: 1.7 },
  necromancer: { damage: 2, radius: 1.8, speed: 1.9 },
};
const MELEE_OVERCHARGE: Partial<Record<ClassId, number>> = { guardian: 2, vanguard: 1.75 };
/** 0 for a tap, rising to 1 once a hold reaches `overchargeTime`. */
export function chargePower(seconds: number) {
  return Math.max(
    0,
    Math.min(1, (seconds - RULES.overchargeTap) / (RULES.overchargeTime - RULES.overchargeTap)),
  );
}
/** Speed and hit radius of a projectile, covering the zombie mage's fireball and gusts and countered shots. */
export function arrowMotion(a: Arrow) {
  const stats = projectileSkillStats(a.skillId, a.classId, a.charged, a.power);
  const speed = a.blast ? RULES.hatFireSpeed : a.gust ? RULES.gustSpeed : stats.speed;
  return {
    stats,
    speed: speed * (a.reflected === 2 ? RULES.counterBoost : 1),
    radius: a.blast ? RULES.hatFireRadius : stats.radius,
  };
}
export function projectileSkillStats(skillId: SkillId | undefined, casterClassId: ClassId, charged = false, power = 0) {
  if (skillId === 'necromancer.fire') return projectileStats('necromancer', charged, power);
  if (skillId === 'mage.fireball') return projectileStats('mage', charged, power);
  if (skillId === 'mage.ice') return projectileStats('mage', false, 0);
  if (skillId === 'vanguard.slash') return projectileStats('vanguard', charged, power);
  if (skillId === 'archer.arrow' || skillId === 'archer.volley') return projectileStats('archer', charged, power);
  return projectileStats(casterClassId, charged, power);
}
export function projectileStats(classId: ClassId, charged = false, power = 0) {
  if (classId === 'vanguard')
    // The warrior's travelling slash: a wide crescent with a short reach.
    return {
      speed: RULES.slashSpeed,
      life: RULES.slashLife,
      damage: RULES.slashDamage,
      radius: RULES.slashRadius,
      cooldown: RULES.slashCooldown,
    };
  if (classId === 'archer') {
    const boost = charged ? RULES.chargeMultiplier : 1 + (RULES.chargeMultiplier - 1) * power;
    const speed = RULES.archerArrowSpeed * boost;
    return {
      speed,
      life: RULES.archerArrowRange / speed,
      damage: RULES.arrowDamage * boost,
      radius: 3,
      cooldown: RULES.archerShotCooldown,
    };
  }
  const base =
    classId === 'necromancer'
      ? {
          speed: RULES.fireSpeed,
          life: RULES.fireLife,
          damage: RULES.fireDamage,
          radius: RULES.fireRadius,
          cooldown: RULES.fireCooldown,
        }
      : {
          speed: RULES.arrowSpeed,
          life: RULES.arrowLife,
          damage: RULES.arrowDamage,
          radius: 3,
          cooldown: RULES.shotCooldown,
        };
  const boost = OVERCHARGE[classId];
  if (!boost || power <= 0) return base;
  const speed = base.speed * (1 + power * (boost.speed - 1));
  // A charged cast keeps flying until it crosses the whole arena.
  const crossing = RULES.projectileCrossing / speed;
  return {
    ...base,
    speed,
    life: base.life + power * Math.max(0, crossing - base.life),
    damage: base.damage * (1 + power * (boost.damage - 1)),
    radius: base.radius * (1 + power * (boost.radius - 1)),
  };
}
export function bodyClear(
  a: Vec,
  b: Vec,
  radius = RULES.zombieRadius - 1,
  walls: Rect[] | Terrain = WALLS,
): boolean {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 5));
  for (let i = 1; i <= steps; i++)
    if (solid(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, radius, walls))
      return false;
  return true;
}
const CELL = 20,
  COLS = RULES.width / CELL,
  ROWS = RULES.height / CELL;
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const cellCenter = (i: number): Vec => ({
  x: (i % COLS) * CELL + CELL / 2,
  y: Math.floor(i / COLS) * CELL + CELL / 2,
});
const cellOf = (p: Vec) =>
  Math.min(ROWS - 1, Math.max(0, Math.floor(p.y / CELL))) * COLS +
  Math.min(COLS - 1, Math.max(0, Math.floor(p.x / CELL)));
const walkableByTerrain = new WeakMap<Terrain, boolean[]>();
/** Breadth-first search on a 20 px grid; ends at the goal or at the closest reachable cell. */
export const pathCells = (points: Vec[]) => new Set(points.map(cellOf));
/** Cells in `avoid` (a sibling's route) are explored last, so a pack spreads across corridors. */
export function findPath(
  from: Vec,
  to: Vec,
  avoid?: ReadonlySet<number>,
  source: Rect[] | Terrain = WALLS,
): Vec[] {
  // Keyed on the terrain object: stringifying the wall list ran on every single path request.
  const terrain = terrainOf(source);
  let open = walkableByTerrain.get(terrain);
  if (!open) {
    open = Array.from({ length: COLS * ROWS }, (_, i) => {
      const c = cellCenter(i);
      return !solid(c.x, c.y, RULES.zombieRadius, terrain);
    });
    walkableByTerrain.set(terrain, open);
  }
  const start = cellOf(from),
    goal = cellOf(to),
    parent = new Int32Array(COLS * ROWS).fill(-1),
    queue = [start],
    detour: number[] = [];
  parent[start] = start;
  let best = start;
  for (let head = 0; head < queue.length || detour.length; head++) {
    if (head >= queue.length) queue.push(detour.shift()!);
    const cell = queue[head];
    if (cell === goal) {
      best = goal;
      break;
    }
    if (distance(cellCenter(cell), to) < distance(cellCenter(best), to)) best = cell;
    const cx = cell % COLS,
      cy = Math.floor(cell / COLS);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx,
        ny = cy + dy,
        next = ny * COLS + nx;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || parent[next] !== -1 || !open[next])
        continue;
      if (dx && dy && (!open[cy * COLS + nx] || !open[ny * COLS + cx])) continue;
      parent[next] = cell;
      (avoid?.has(next) ? detour : queue).push(next);
    }
  }
  const path: Vec[] = [];
  for (let cell = best; cell !== start; cell = parent[cell]) path.unshift(cellCenter(cell));
  if (best === goal) path.push({ x: to.x, y: to.y });
  return path;
}
const ZOMBIE_PACE = [1, 0.92, 0.96, 0.88];
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export function lowerGuard(p: Player) {
  if (!p.guarding) return;
  p.guarding = false;
  p.guardLeft = 0;
  p.guardCd = RULES.guardCooldown;
  p.guardRecovery = RULES.guardRecovery;
}
const hasLogicalInput = (input: Input) => SKILL_SLOTS.some((slot) => {
  const state = input.slots[slot];
  return state.pressed || state.held || state.released;
});
/** Server-side adapter from validated logical slots to the established simulation actions. */
export function resolveSlotInput(p: Player, input: Input): Input {
  if (!hasLogicalInput(input)) return input;
  const resolved: Input = { ...input, sword:false, shot:false, charge:false, dash:false, blackHole:false, guard:false, summon:false,
    ice:false, trap:false, volley:false, special:false, shieldBash:false, fury:false, slash:false, counter:false,
    command:false, mark:false };
  for (const slot of SKILL_SLOTS) {
    const skillId = p.loadout[slot], state = input.slots[slot];
    if (!skillId) continue;
    const pulse = state.pressed || state.released;
    switch (skillId) {
      case 'mage.fireball': case 'necromancer.fire': case 'archer.arrow':
        resolved.charge ||= state.held; resolved.shot ||= state.released; break;
      case 'guardian.sword': case 'vanguard.sword':
        resolved.charge ||= state.held; resolved.sword ||= state.released; break;
      case 'common.dash':
        resolved.special ||= state.held; resolved.dash ||= state.released; break;
      case 'guardian.dash': resolved.dash ||= state.pressed; break;
      case 'mage.blink': resolved.dash ||= state.released; break;
      case 'mage.blackHole': resolved.blackHole ||= state.pressed; break;
      case 'mage.magicShield': resolved.guard ||= state.pressed || state.held; break;
      case 'mage.ice': resolved.ice ||= pulse; break;
      case 'necromancer.summon': resolved.special ||= state.held; resolved.summon ||= state.released; break;
      case 'archer.dagger': resolved.sword ||= state.pressed; break;
      case 'archer.trap': resolved.trap ||= state.pressed; break;
      case 'archer.volley': resolved.volley ||= state.pressed; break;
      case 'guardian.guard': resolved.guard ||= state.held; break;
      case 'guardian.shieldBash': resolved.shieldBash ||= state.pressed; break;
      case 'guardian.fury': resolved.fury ||= state.pressed; break;
      case 'vanguard.slash': resolved.slash ||= state.pressed; break;
      case 'vanguard.counter': resolved.counter ||= state.held; break;
    }
  }
  return resolved;
}
/** Shared fixed-step prediction of timers, defense, attacks and movement. */
export function movePlayer(
  p: Player,
  input: Input,
  carrying: boolean,
  dt = RULES.tick as number,
  walls: Rect[] | Terrain = WALLS,
) {
  const result = {
    skillId: undefined as SkillId | undefined,
    ice: false,
    slash: false,
    swing: false,
    shoot: false,
    summon: false,
    trap: false,
    volley: false,
    charged: false,
    power: 0,
    special: 0,
    volleyPower: 0,
    wind: false,
    angle: 0,
    raised: false,
    bash: false,
    fury: false,
    dashStarted: false,
    dashing: false,
    blackHole: false,
    blink: null as { fromX: number; fromY: number; toX: number; toY: number } | null,
  };
  if (p.hp <= 0) return result;
  const stats = CLASSES[p.classId];
  const beforeX = p.x;
  const beforeY = p.y;
  const wasWinding = p.windup > 0;
  const frozenDt = Math.min(dt, p.frozenLeft);
  p.frozenLeft = Math.max(0, p.frozenLeft - dt);
  p.iceCd = Math.max(0, p.iceCd - dt);
  for (const key of [
    'swordCd',
    'shotCd',
    'dashCd',
    'blackHoleCd',
    'attackLock',
    'invuln',
    'hitFlash',
    'guardCd',
    'guardRecovery',
    'summonCd',
    'trapCd',
    'volleyCd',
    'magicShieldCd',
    'thrallCd',
    'windDash',
    'slashCd',
    'counterCd',
    'shieldBashCd',
    'furyCd',
  ] as const)
    p[key] = Math.max(0, p[key] - dt);
  p.furyLeft = Math.max(0, p.furyLeft - dt);
  if (p.furyLeft <= 1e-8) p.furyLeft = 0;
  if (p.blackHoleCast > 0) {
    p.blackHoleCast = Math.max(0, p.blackHoleCast - dt);
    p.stunLeft = Math.max(0, p.stunLeft - dt);
    p.shotCharge = 0;
    p.specialCharge = 0;
    result.blackHole = p.blackHoleCast <= 1e-8;
    return result;
  }
  if (p.stunLeft > 0) {
    p.stunLeft = Math.max(0, p.stunLeft - dt);
    p.shotCharge = 0;
    p.specialCharge = 0;
    p.trapLeft = 0;
    p.windup = 0;
    p.dashLeft = 0;
    p.dashInvulnerable = false;
    p.shieldBashLeft = 0;
    if (!p.guardStunExempt || !input.guard) lowerGuard(p);
    if (p.stunLeft <= 1e-8) p.guardStunExempt = false;
    return result;
  }
  p.angle = input.angle;
  p.aimX = input.aimX;
  p.aimY = input.aimY;
  if (input.blackHole && equippedSkill(p, 'mage.blackHole') && p.blackHoleCd <= 0) {
    const aimDist=input.aimX>=0&&input.aimY>=0?Math.hypot(input.aimX-p.x,input.aimY-p.y):0;
    const aimAngle=aimDist>1?Math.atan2(input.aimY-p.y,input.aimX-p.x):input.angle;
    const target=blinkTarget(p,aimAngle,aimDist>1?aimDist:150,walls);
    p.blackHoleX=target.x;
    p.blackHoleY=target.y;
    p.blackHoleCast = RULES.blackHoleCast;
    p.blackHoleCd = RULES.blackHoleCooldown;
    p.shotCharge = 0;
    p.specialCharge = 0;
    p.dashLeft = 0;
    return result;
  }
  if (p.raiseCast > 0) {
    // Casting a raise roots the necromancer until the mandala opens.
    p.raiseCast = Math.max(0, p.raiseCast - dt);
    p.shotCharge = 0;
    p.specialCharge = 0;
    if (p.raiseCast <= 1e-8) {
      p.raiseCast = 0;
      result.raised = true;
    }
    return result;
  }
  if (p.trapLeft > 0) {
    p.shotCharge = 0;
    if (p.hitFlash > 0) p.trapLeft = 0;
    else {
      p.trapLeft = Math.max(0, p.trapLeft - dt);
      result.trap = p.trapLeft <= 1e-8;
      if (result.trap) p.trapLeft = 0;
      return result;
    }
  }
  if (
    p.classId === 'archer' &&
    input.trap &&
    p.trapCd <= 0 &&
    !wasWinding &&
    p.attackLock <= 0 &&
    p.dashLeft <= 0 &&
    p.hitFlash <= 0
  ) {
    p.shotCharge = 0;
    p.trapLeft = RULES.trapSetup;
    p.dashInvulnerable = false;
    p.trapCd = RULES.trapCooldown;
    p.invuln = 0;
    return result;
  }
  if (
    p.guarding &&
    (!input.guard ||
      input.sword ||
      input.shieldBash ||
      input.dash ||
      (p.classId !== 'guardian' && p.guardLeft <= 1e-8))
  )
    lowerGuard(p);
  if (
    stats.shield &&
    input.guard &&
    !p.guardHeld &&
    !p.guarding &&
    p.guardCd <= 0 &&
    p.guardRecovery <= 0 &&
    !wasWinding &&
    p.attackLock <= 0
  ) {
    p.guarding = true;
    p.guardLeft = RULES.guardDuration;
  }
  if (
    p.classId === 'mage' && equippedSkill(p, 'mage.magicShield') &&
    input.guard &&
    !p.guardHeld &&
    p.magicShieldHits === 0 &&
    p.magicShieldCd <= 1e-8
  ) {
    p.magicShieldHits = RULES.magicShieldHits + Math.floor((p.pve?.classRanks.mage ?? 0) / 2);
    p.magicShieldCd = 0;
  }
  p.guardHeld = input.guard;
  if (
    p.classId === 'guardian' &&
    input.fury &&
    p.furyCd <= 0 &&
    p.shieldBashLeft <= 0 &&
    p.dashLeft <= 0 &&
    !wasWinding &&
    p.attackLock <= 0
  ) {
    p.furyLeft = RULES.furyDuration;
    p.furyCd = RULES.furyCooldown;
    p.invuln = 0;
    result.fury = true;
  }
  if (p.shieldBashLeft > 0) {
    p.shieldBashLeft = Math.max(0, p.shieldBashLeft - dt);
    if (p.shieldBashLeft <= 1e-8) result.bash = true;
    return result;
  }
  if (
    p.classId === 'guardian' &&
    input.shieldBash &&
    p.shieldBashCd <= 0 &&
    p.dashLeft <= 0 &&
    !wasWinding &&
    p.attackLock <= 0 &&
    !result.fury
  ) {
    lowerGuard(p);
    p.shieldBashLeft = RULES.shieldBashWindup;
    p.shieldBashAngle = p.angle;
    p.shieldBashCd = RULES.shieldBashCooldown;
    p.shotCharge = 0;
    p.invuln = 0;
    return result;
  }
  // Warrior's full counter (E): held it stays up and charges; released it lingers a moment, then cools
  // down. Holding past the maximum ends it too, and E must be released before the next one.
  if (p.classId === 'vanguard') {
    const holding =
      input.counter &&
      p.counterCd <= 0 &&
      p.counterCharge < RULES.counterMaxHold &&
      (p.counterLeft > 0 || !p.counterHeld);
    if (holding) {
      p.counterCharge = Math.min(RULES.counterMaxHold, p.counterCharge + dt);
      p.counterLeft = RULES.counterWindow * (1 + (p.pve?.classRanks.vanguard ?? 0) * .15);
    } else if (p.counterLeft > 0) {
      p.counterLeft = Math.max(0, p.counterLeft - dt);
      if (p.counterLeft <= 1e-8) {
        p.counterLeft = 0;
        p.counterCharge = 0;
        p.counterCd = RULES.counterCooldown;
      }
    }
    p.counterHeld = input.counter;
  }
  // Space charges while held; the release pulse (dash or summon) spends the charge.
  const canDash = equippedSkill(p, 'common.dash') || equippedSkill(p, 'guardian.dash');
  const canSummon = equippedSkill(p, 'necromancer.summon');
  const canBlink = equippedSkill(p, 'mage.blink');
  const specialReady =
    (canDash && p.classId !== 'guardian' && p.dashCd <= 0) || (canSummon && p.summonCd <= 0);
  if (specialReady && input.special && !input.dash && !input.summon)
    p.specialCharge = Math.min(
      canSummon ? RULES.raiseCharge : RULES.overchargeTime,
      p.specialCharge + dt,
    );
  else if (!specialReady || (!input.special && !input.dash && !input.summon)) p.specialCharge = 0;
  if (
    frozenDt === 0 &&
    canBlink &&
    input.dash &&
    p.dashCd <= 0 &&
    !wasWinding &&
    p.attackLock <= 0 &&
    !result.fury
  ) {
    // Land where the cursor is, capped at the blink range; without a cursor, use the movement
    // direction (or the facing angle) for the full range.
    const aimDist =
      input.aimX >= 0 && input.aimY >= 0 ? Math.hypot(input.aimX - p.x, input.aimY - p.y) : 0;
    const hasAim = aimDist > 1;
    const mag = Math.hypot(input.x, input.y);
    const angle = hasAim
      ? Math.atan2(input.aimY - p.y, input.aimX - p.x)
      : mag > 0.05
        ? Math.atan2(input.y, input.x)
        : input.angle;
    const range = hasAim ? aimDist : RULES.mageBlinkRange;
    const to = blinkTarget(p, angle, range, walls);
    result.blink = { fromX: p.x, fromY: p.y, toX: to.x, toY: to.y };
    p.x = to.x;
    p.y = to.y;
    // A short i-frame window through the dash timer, with no residual movement.
    p.dashX = 0;
    p.dashY = 0;
    p.dashLeft = RULES.mageBlinkInvuln;
    p.dashCd = RULES.dashCooldown;
    p.specialCharge = 0;
  }
  if (
    frozenDt === 0 &&
    canDash &&
    input.dash &&
    p.dashCd <= 0 &&
    !wasWinding &&
    p.attackLock <= 0 &&
    !result.fury
  ) {
    if (p.classId === 'guardian') lowerGuard(p);
    const mag = Math.hypot(input.x, input.y);
    p.dashX = mag > 0.05 ? input.x / mag : Math.cos(input.angle);
    p.dashY = mag > 0.05 ? input.y / mag : Math.sin(input.angle);
    // The heavy warrior's dash is shorter.
    p.dashLeft =
      p.classId === 'guardian'
        ? RULES.guardianDashDuration
        : RULES.dashDuration *
          (1 + 0.8 * chargePower(p.specialCharge)) *
          (p.classId === 'vanguard' ? RULES.vanguardDash : 1);
    p.dashCd = p.classId === 'guardian' ? RULES.guardianDashCooldown : RULES.dashCooldown;
    result.dashStarted = true;
    // A deliberate jump opens the archer's air-combo window: either the bow was fully drawn or the
    // jump itself was charged. A plain escape dash opens nothing, so it cannot grant invulnerability
    // and an attack at the same time. Read specialCharge before the reset below.
    p.windDash =
      p.classId === 'archer' &&
      (p.shotCharge >= RULES.chargeTime - 1e-8 || chargePower(p.specialCharge) > 0)
        ? p.dashLeft + RULES.windGrace
        : 0;
    p.specialCharge = 0;
  }
  const dashDt = Math.min(dt, p.dashLeft);
  p.dashInvulnerable = dashDt > 1e-8 && p.classId !== 'guardian';
  result.dashing = dashDt > 1e-8;
  if (dashDt > 0)
    translate(
      p,
      p.dashX * (p.classId === 'guardian' ? RULES.guardianDashSpeed : RULES.dashSpeed) * dashDt,
      p.dashY * (p.classId === 'guardian' ? RULES.guardianDashSpeed : RULES.dashSpeed) * dashDt,
      walls,
    );
  p.dashLeft = Math.max(0, p.dashLeft - dt);
  const speed =
    stats.speed *
    (1 + (p.pve?.speed ?? 0)) *
    (carrying ? RULES.carryMultiplier : 1) *
    (p.guarding ? RULES.guardSpeed + (p.pve?.classRanks.guardian ?? 0) * .04 : 1) *
    (p.counterLeft > 0 ? RULES.counterSpeed : 1);
  translate(
    p,
    input.x * speed * Math.max(0, dt - dashDt - frozenDt),
    input.y * speed * Math.max(0, dt - dashDt - frozenDt),
    walls,
  );
  if (wasWinding) {
    p.windup = Math.max(0, p.windup - dt);
    result.swing = p.windup === 0;
  }
  // Archer combos read the charge held before this tick's release.
  const heldCharge = p.shotCharge;
  // During any dash the archer keeps charging and can release toward the cursor.
  // A full primary charge or any volley released in this window becomes wind.
  const dashCombo = p.classId === 'archer' && p.windDash > 0;
  const movingVolley =
    p.classId === 'archer' && (dashCombo || Math.hypot(p.x - beforeX, p.y - beforeY) > 1e-6);
  const fullArcherCharge = p.classId === 'archer' && heldCharge >= RULES.chargeTime - 1e-8;
  // Only the air-combo window opened above (a fully drawn bow or a charged jump) lets the archer
  // act while the dash keeps it invulnerable. Plain displacement must not open the attack ladder
  // mid-dash, or an escape dash would grant invulnerability and a swing at the same time.
  const dashAttackWindow = dashCombo || p.classId === 'vanguard';
  const canCharge =
    !p.guarding &&
    (!p.dashInvulnerable || dashAttackWindow) &&
    !wasWinding &&
    p.attackLock <= 0 &&
    !result.fury &&
    (stats.ranged ? p.shotCd <= 0 : stats.melee && p.swordCd <= 0);
  if (canCharge && input.charge && !input.shot && !input.sword && !input.volley)
    p.shotCharge = Math.min(
      p.classId === 'archer' ? RULES.chargeTime : RULES.overchargeTime,
      p.shotCharge + dt,
    );
  else if (!canCharge || !(input.shot || input.sword)) p.shotCharge = 0;
  if (
    !p.guarding &&
    p.guardRecovery <= 0 &&
    (!p.dashInvulnerable || dashAttackWindow) &&
    p.attackLock <= 0 &&
    !wasWinding &&
    !result.fury
  ) {
    if (input.volley && p.classId === 'archer' && p.volleyCd <= 0) {
      p.invuln = 0;
      p.volleyCd = RULES.volleyCooldown;
      p.attackLock = RULES.attackLock;
      result.volley = true;
      result.wind = movingVolley;
      // Released mid-charge: three arrows carrying a third of the charged power.
      result.volleyPower = heldCharge >= RULES.overchargeTap ? RULES.volleyChargedPower : 0;
      result.angle = p.angle;
      if (dashCombo) p.windDash = 0;
    } else if (input.slash && p.classId === 'vanguard' && p.slashCd <= 0) {
      p.invuln = 0;
      p.slashCd = RULES.slashCooldown;
      p.attackLock = RULES.attackLock;
      result.slash = true;
      result.angle = p.angle;
    } else if (input.sword && stats.melee && p.swordCd <= 0) {
      p.invuln = 0;
      p.windup = stats.windup;
      p.swingAngle = p.angle;
      p.swingPower = p.classId === 'archer' ? 0 : chargePower(p.shotCharge);
      p.swordCd = stats.meleeCooldown;
      p.attackLock = RULES.attackLock;
    } else if (input.ice && p.classId === 'mage' && equippedSkill(p, 'mage.ice') && p.iceCd <= 0) {
      p.invuln = 0;
      p.iceCd = RULES.iceCooldown;
      p.attackLock = RULES.attackLock;
      result.ice = true;
      result.skillId = 'mage.ice';
      result.angle = p.angle;
    } else if (input.shot && (equippedSkill(p, 'mage.fireball') || equippedSkill(p, 'necromancer.fire') || equippedSkill(p, 'archer.arrow')) && p.shotCd <= 0) {
      p.invuln = 0;
      result.skillId = p.loadout.primary ?? undefined;
      p.shotCd = projectileSkillStats(result.skillId, p.classId).cooldown;
      p.attackLock = RULES.attackLock;
      result.charged = fullArcherCharge;
      result.wind = fullArcherCharge;
      result.angle = p.angle;
      if (dashCombo) p.windDash = 0;
      result.power = result.skillId === 'archer.arrow' ? 0 : chargePower(p.shotCharge);
      p.shotCharge = 0;
      result.shoot = true;
    }
  }
  // Summoning neither waits for nor blocks attacks: fire and summon can go out on the same tick.
  if (
    input.summon &&
    canSummon &&
    p.summonCd <= 0 &&
    // A charged summon (hat zombie or thrall) never takes an execution slot.
    // A fallen guard's sword zombie reuses that guard's slot too.
    (p.activeExecutions < RULES.zombieExecutions + (p.pve?.classRanks.necromancer ?? 0) ||
      p.specialCharge >= RULES.overchargeTap ||
      p.fallenGuards > 0)
  ) {
    p.invuln = 0;
    p.summonCd = RULES.summonCooldown;
    result.summon = true;
    result.skillId = 'necromancer.summon';
    result.special = p.specialCharge;
    p.specialCharge = 0;
  }
  if (input.shot || input.sword || input.volley) p.shotCharge = 0;
  if (p.guarding && p.classId !== 'guardian') p.guardLeft = Math.max(0, p.guardLeft - dt);
  return result;
}
export function newPlayer(
  id: string,
  name: string,
  team: Team,
  classId: ClassId = DEFAULT_CLASS,
  spawn: Vec = team === 'blue' || team === 'red' ? SPAWNS[team] : CORNER_SPAWNS[team],
  customization: CharacterCustomization = defaultCustomization(classId),
): Player {
  const profile = validCustomization(classId, customization) ? customization : defaultCustomization(classId);
  return {
    id,
    name,
    team,
    ...spawn,
    classId,
    skinId: profile.selectedSkin,
    loadout: { ...activePreset(profile).loadout },
    profileRevision: 1,
    hp: CLASSES[classId].hp,
    maxHp: CLASSES[classId].hp,
    angle: spawn.x < RULES.width / 2 ? 0 : Math.PI,
    ready: false,
    connected: true,
    ack: 0,
    swordCd: 0,
    shotCd: 0,
    shotCharge: 0,
    dashCd: 0,
    blackHoleCast: 0,
    blackHoleCd: 0,
    blackHoleX: 0,
    blackHoleY: 0,
    attackLock: 0,
    dashLeft: 0,
    dashX: 0,
    dashY: 0,
    dashInvulnerable: false,
    guarding: false,
    guardLeft: 0,
    guardCd: 0,
    guardRecovery: 0,
    guardHeld: false,
    magicShieldHits: activePreset(profile).loadout.secondary === 'mage.magicShield' || Object.values(activePreset(profile).loadout).includes('mage.magicShield') ? RULES.magicShieldHits : 0,
    magicShieldCd: 0,
    windup: 0,
    swingAngle: 0,
    invuln: 0,
    respawnLeft: 0,
    hitFlash: 0,
    deaths: 0,
    eliminated: false,
    summonCd: 0,
    iceCd: 0,
    trapCd: 0,
    trapLeft: 0,
    volleyCd: 0,
    stunLeft: 0,
    guardStunExempt: false,
    windDash: 0,
    slashCd: 0,
    shieldBashLeft: 0,
    shieldBashCd: 0,
    shieldBashAngle: 0,
    furyLeft: 0,
    furyCd: 0,
    counterLeft: 0,
    counterCharge: 0,
    counterCd: 0,
    counterHeld: false,
    fallenGuards: 0,
    activeTraps: 0,
    specialCharge: 0,
    swingPower: 0,
    frozenLeft: 0,
    thrall: null,
    thrallCd: 0,
    hatAlive: false,
    thrallAlive: false,
    raiseCast: 0,
    raiseX: 0,
    raiseY: 0,
    activeExecutions: 0,
    zombieAuto: false,
    aimX: -1,
    aimY: -1,
    bushId: null,
    revealLeft: 0,
    pve: emptyUpgrades(),
    pveKills: 0,
    pveDamage: 0,
    level: 1,
    mana: 0,
    maxMana: 0,
  };
}
const newFlag = ({ team, home }: Base): Flag => ({
  team,
  ...home,
  status: 'home',
  carrier: null,
  returnLeft: 0,
  blockedId: null,
  lockLeft: 0,
});
export class Duel {
  state: Snapshot = {
    mapId: DEFAULT_MAP,
    mode: DEFAULT_MODE,
    maxPlayers: MODE_INFO[DEFAULT_MODE].maxPlayers,
    perspective: null,
    tick: 0,
    phase: 'lobby',
    phaseLeft: 0,
    timeLeft: RULES.matchTime,
    paused: false,
    reconnectLeft: 0,
    players: [],
    participants: [],
    bases: [],
    flags: [],
    arrows: [],
    blackHoles: [],
    zombies: [],
    mobs: [],
    mobProjectiles: [],
    graves: [],
    traps: [],
    score: emptyScore(),
    winner: null,
    reason: '',
    events: [],
    pve: null,
  };
  protected eventId = 0;
  protected arrowId = 0;
  protected blackHoleId = 0;
  protected trapId = 0;
  protected zombieId = 0;
  private mobId = 0;
  private mobProjectileId = 0;
  private pveSpawnClock = 0;
  private pveOffers = new Map<string, UpgradeOffer>();
  private executionId = 0;
  protected paths = new Map<string, { goal: Vec; points: Vec[] }>();
  protected packBearings = new Map<string, number>();
  protected packSeen = new Set<string>();
  private volleyId = 0;
  /** `${volley}:${target}` → tick a volley arrow first reached that target. */
  private volleyHits = new Map<string, number>();
  /** Necromancers mid-cast and the thrall they are raising. */
  protected raising = new Map<string, { classId: ClassId; name: string }>();
  /** Enemy ids already struck by each knight's current offensive dash. */
  private guardianDashHits = new Map<string, Set<string>>();
  constructor(mapId: MapId = DEFAULT_MAP, mode: GameMode = DEFAULT_MODE) {
    this.state.mapId = mapId;
    this.state.mode = mode;
    this.state.maxPlayers = MODE_INFO[mode].maxPlayers;
  }
  get map(): MapDefinition {
    return MAPS[this.state.mapId];
  }
  /**
   * The single place the simulation asks for geometry. It resolves to the arena's walls, which
   * `terrainOf` pins to ARENA_BOUNDS, so every inherited call behaves exactly as it always has.
   * A subclass with a larger world overrides this to return its own Terrain, and the ~40 callers
   * below pick up the new bounds without a single edit.
   */
  protected get terrain(): Rect[] | Terrain {
    return this.map.walls;
  }
  protected syncParticipants() {
    this.state.participants = this.state.players.map(
      ({ id, name, team, classId, ready, connected, deaths }) => ({
        id,
        name,
        team,
        classId,
        ready,
        connected,
        deaths,
      }),
    );
  }
  /** Executions of guard zombies killed in the red circle, per necromancer, oldest first. */
  protected fallen = new Map<string, number[]>();
  add(id: string, name: string, classId: ClassId = DEFAULT_CLASS, customization = defaultCustomization(classId)) {
    const s = this.state;
    const team =
      s.mode === 'pve'
        ? 'blue'
        : s.mode === 'teams'
        ? (['blue', 'red'] as Team[]).sort(
            (a, b) =>
              s.players.filter((p) => p.team === a).length -
              s.players.filter((p) => p.team === b).length,
          )[0]
        : TEAMS.find((t) => !s.players.some((p) => p.team === t));
    if (!team || s.players.length >= s.maxPlayers) throw Error('Sala llena');
    const spawn = team === 'blue' || team === 'red' ? SPAWNS[team] : CORNER_SPAWNS[team];
    const p = newPlayer(id, name, team, classId, spawn, customization);
    s.players.push(p);
    this.arrange();
    this.syncParticipants();
    return p;
  }
  remove(id: string) {
    const s = this.state;
    s.players = s.players.filter((p) => p.id !== id);
    s.zombies = s.zombies.filter((z) => z.owner !== id);
    s.players.forEach((p) => (p.ready = false));
    if (s.phase === 'lobby') this.arrange();
    this.syncParticipants();
  }
  base(team: Team): Base {
    return (
      this.state.bases.find((b) => b.team === team) ??
      layout([team], this.state.mapId, this.state.mode)[0]
    );
  }
  protected spawnFor(p: Player): Vec {
    const same = this.state.players.filter((q) => q.team === p.team),
      i = Math.max(0, same.indexOf(p));
    if (this.state.mode === 'pve') {
      const slots = [this.map.sideSpawns.blue[0], this.map.sideSpawns.blue[1], {x:90,y:225}, {x:90,y:350}];
      return slots[Math.max(0, same.indexOf(p))] ?? slots[0];
    }
    if (this.state.mode === 'duel')
      return this.map.sideSpawns[p.team === 'red' ? 'red' : 'blue'][0];
    if (this.state.mode === 'teams')
      return this.map.sideSpawns[p.team === 'red' ? 'red' : 'blue'][i] ?? this.base(p.team).spawn;
    return this.map.cornerSpawns[p.team][0];
  }
  protected arrange() {
    const s = this.state;
    if (s.mode === 'pve') {
      s.bases = []; s.flags = [];
      for (const p of s.players) { const spawn=this.spawnFor(p); Object.assign(p,spawn,{angle:0,team:'blue'}); }
      return;
    }
    s.bases = layout(
      s.players.map((p) => p.team),
      s.mapId,
      s.mode,
    );
    s.flags = s.bases.map(newFlag);
    for (const p of s.players) {
      const spawn = this.spawnFor(p);
      Object.assign(p, spawn, { angle: spawn.x < RULES.width / 2 ? 0 : Math.PI });
    }
  }
  protected revive(p: Player, invuln = 0) {
    const customization = defaultCustomization(p.classId);
    customization.selectedSkin = p.skinId;
    customization.presets.default.loadout = { ...p.loadout };
    Object.assign(p, newPlayer(p.id, p.name, p.team, p.classId, this.spawnFor(p), customization), {
      ack: p.ack,
      connected: p.connected,
      deaths: p.deaths,
      eliminated: p.eliminated,
      thrall: p.thrall,
      thrallCd: p.thrallCd,
      fallenGuards: p.fallenGuards,
      profileRevision: p.profileRevision,
      invuln,
      pve: p.pve,
      pveKills: p.pveKills,
      pveDamage: p.pveDamage,
      // Progression must survive death. Anything missing from this list resets in silence.
      level: p.level,
      mana: p.mana,
      maxMana: p.maxMana,
    });
    p.maxHp=CLASSES[p.classId].hp*(1+(p.pve?.maxHpBonus??0));p.hp=p.maxHp;
  }
  setCustomization(id: string, customization: CharacterCustomization): boolean {
    const p = this.state.players.find((player) => player.id === id);
    if (!p || !['lobby', 'finished'].includes(this.state.phase) || !validCustomization(p.classId, customization)) return false;
    p.skinId = customization.selectedSkin;
    p.loadout = { ...activePreset(customization).loadout };
    p.profileRevision++;
    p.magicShieldHits = equippedSkill(p, 'mage.magicShield') ? RULES.magicShieldHits : 0;
    p.magicShieldCd = 0;
    this.state.players.forEach((player) => (player.ready = false));
    this.syncParticipants();
    return true;
  }
  event(
    kind: GameEvent['kind'],
    where: Vec,
    team: Team,
    angle?: number,
    classId?: ClassId,
    power?: number,
    skillId?: SkillId,
  ) {
    this.state.events.push({
      id: ++this.eventId,
      kind,
      x: where.x,
      y: where.y,
      team,
      angle,
      classId,
      power,
      skillId,
    });
    this.state.events = this.state.events.slice(-24);
  }
  ready(id: string) {
    const s = this.state,
      p = s.players.find((p) => p.id === id);
    if (!p || s.paused || !['lobby', 'finished'].includes(s.phase)) return;
    p.ready = !p.ready;
    if (s.mode === 'pve') { this.syncParticipants(); return; }
    if (s.players.length === s.maxPlayers && s.players.every((p) => p.ready && p.connected)) {
      s.score = emptyScore();
      s.timeLeft = RULES.matchTime;
      s.winner = null;
      s.reason = '';
      s.phase = 'countdown';
      s.phaseLeft = RULES.countdown;
      s.players.forEach((p) => Object.assign(p, { deaths: 0, eliminated: false, revealLeft: 0 }));
      this.arrange();
      this.resetArena();
    }
    this.syncParticipants();
  }
  selectClass(id: string, classId: ClassId): boolean {
    const s = this.state,
      p = s.players.find((p) => p.id === id);
    if (
      !p ||
      !validClass(classId) ||
      s.paused ||
      !['lobby', 'finished'].includes(s.phase) ||
      (s.mode === 'pve' && s.phase === 'finished' && s.reason === 'pveVictory')
    )
      return false;
    if (p.classId === classId) return true;
    Object.assign(p, newPlayer(p.id, p.name, p.team, classId, this.spawnFor(p)), {
      ack: p.ack,
      connected: p.connected,
    });
    s.players.forEach((p) => (p.ready = false));
    this.syncParticipants();
    return true;
  }
  selectTeam(id: string, team: Team): boolean {
    const s = this.state,
      p = s.players.find((q) => q.id === id);
    if (
      !p ||
      s.mode !== 'teams' ||
      !['blue', 'red'].includes(team) ||
      !['lobby', 'finished'].includes(s.phase)
    )
      return false;
    if (p.team === team) return true;
    if (s.players.filter((q) => q.team === team).length >= 2) return false;
    p.team = team;
    s.players.forEach((q) => (q.ready = false));
    this.arrange();
    this.syncParticipants();
    return true;
  }
  abandon(id: string) {
    const s = this.state,
      p = s.players.find((q) => q.id === id);
    if (!p) return;
    this.drop(p);
    s.players = s.players.filter((q) => q.id !== id);
    s.zombies = s.zombies.filter((z) => z.owner !== id);
    s.traps = s.traps.filter((t) => t.owner !== id);
    if(s.mode==='pve'){this.syncParticipants();return;}
    if (!s.players.some((q) => q.team === p.team)) {
      s.flags = s.flags.filter((f) => f.team !== p.team);
      s.bases = s.bases.filter((b) => b.team !== p.team);
    }
    const teams = [...new Set(s.players.map((q) => q.team))];
    if (teams.length === 1 && s.phase !== 'finished') this.finish(teams[0], 'abandono');
    this.syncParticipants();
  }
  resetArena() {
    const s = this.state;
    s.arrows = [];
    s.blackHoles = [];
    s.zombies = [];
    s.mobs = [];
    s.mobProjectiles = [];
    s.graves = [];
    this.raising.clear();
    this.fallen.clear();
    for (const p of s.players) {
      p.raiseCast = 0;
      p.blackHoleCast = 0;
      p.fallenGuards = 0;
    }
    s.traps = [];
    this.paths.clear();
    this.guardianDashHits.clear();
    s.flags = s.bases
      .filter((b) => s.players.some((p) => p.team === b.team && !p.eliminated))
      .map(newFlag);
    for (const p of s.players) {
      this.revive(p);
      if (p.eliminated) p.hp = 0;
    }
  }
  finish(winner: Team | 'draw', reason: string) {
    const s = this.state;
    s.phase = 'finished';
    s.winner = winner;
    s.reason = reason;
    s.players.forEach((p) => (p.ready = false));
    s.paused = false;
    s.reconnectLeft = 0;
  }
  returnFlag(f: Flag) {
    Object.assign(f, newFlag(this.base(f.team)));
    this.event('return', f, f.team);
  }
  drop(p: Player) {
    const f = this.state.flags.find((f) => f.carrier === p.id);
    if (f) {
      Object.assign(f, {
        status: 'dropped',
        carrier: null,
        x: p.x,
        y: p.y,
        returnLeft: RULES.flagReturn,
        blockedId: p.id,
        lockLeft: RULES.pickupLock,
      });
    }
  }
  eliminate(p: Player, reason = 'eliminación') {
    const s = this.state;
    if (p.eliminated) return;
    Object.assign(p, {
      eliminated: true,
      hp: 0,
      respawnLeft: 0,
      windup: 0,
      dashLeft: 0,
      dashInvulnerable: false,
    });
    lowerGuard(p);
    this.drop(p);
    s.flags = s.flags.filter((f) => f.team !== p.team);
    s.zombies = s.zombies.filter((z) => z.owner !== p.id);
    s.traps = s.traps.filter((t) => t.owner !== p.id);
    p.trapLeft = 0;
    const alive = s.players.filter((q) => !q.eliminated);
    if (alive.length === 1 && s.phase !== 'lobby' && s.phase !== 'finished')
      this.finish(alive[0].team, reason);
  }
  /** Returns whether the hit landed (not blocked, shielded or ignored by protection). */
  /** `pierce`: breaks shields and wounds without knockback; `ignoreInvuln`: a sibling volley arrow. */
  damage(
    target: Player,
    /** Only the side is read, so a world monster with no owning player can be its own source. */
    source: Pick<Player, 'team'>,
    angle: number,
    amount = 1,
    options: { pierce?: boolean; ignoreInvuln?: boolean; freeze?: boolean } = {},
  ): boolean {
    if (
      !this.hostile(source, target) ||
      target.hp <= 0 ||
      (target.invuln > 0 && !options.ignoreInvuln) ||
      target.dashInvulnerable
    )
      return false;
    if ((target.classId === 'mage' || equippedSkill(target, 'mage.magicShield')) && target.magicShieldHits > 0 && (amount > 0 || options.freeze)) {
      target.magicShieldHits = options.pierce ? 0 : target.magicShieldHits - 1;
      if (target.magicShieldHits === 0) target.magicShieldCd = RULES.magicShieldCooldown;
      this.event('block', target, target.team, angle, target.classId);
      if (!options.pierce) return false;
    }
    // Incoming direction is the reverse of projectile/swing travel, not the
    // attacker's current position (arrows can arrive after their owner moves).
    const relative = angle + Math.PI - target.angle;
    const difference = Math.atan2(Math.sin(relative), Math.cos(relative));
    if (target.guarding && Math.abs(difference) <= RULES.guardArc / 2 + 1e-8) {
      this.event('block', target, target.team, target.angle, target.classId);
      if (!options.pierce) return false;
      // Wind can pierce the knight's shield, but never tears down the held guard.
      if (target.classId !== 'guardian') lowerGuard(target);
    }
    target.revealLeft = 1.5;
    if (options.freeze) {
      target.frozenLeft = RULES.freezeDuration;
      target.dashLeft = 0;
      target.dashInvulnerable = false;
      return true;
    }
    target.shotCharge = 0;
    target.specialCharge = 0;
    target.trapLeft = 0;
    target.hp = Math.max(0, target.hp - amount);
    target.invuln = RULES.hurtProtection;
    target.hitFlash = 0.18;
    this.drop(target);
    this.event('hit', target, source.team);
    if (target.hp === 0) {
      this.state.graves.push({
        x: target.x,
        y: target.y,
        classId: target.classId,
        name: target.name,
        team: target.team,
        left: RULES.graveLife,
      });
      target.respawnLeft = RULES.respawn;
      target.raiseCast = 0;
      target.blackHoleCast = 0;
      target.furyLeft = 0;
      target.shieldBashLeft = 0;
      this.raising.delete(target.id);
      target.windup = 0;
      target.dashLeft = 0;
      target.dashInvulnerable = false;
      lowerGuard(target);
      target.deaths++;
      this.event('death', target, target.team);
    } else if (!options.pierce && target.blackHoleCast <= 0)
      translate(target, Math.cos(angle) * 24, Math.sin(angle) * 24, this.terrainFor(target));
    return true;
  }
  /** How far a monster notices someone, as a share of its aggro. The world lets stealth shrink it. */
  protected noticeScale(_id: string) {
    return 1;
  }
  /** Reach, arc and damage of a player's swing. The world lets a weapon shape them; a match uses the class. */
  protected meleeStats(p: Player): { meleeRange: number; meleeArc: number; meleeDamage: number; windup: number } {
    return CLASSES[p.classId];
  }
  protected freeze(p: Player) {
    if (
      p.hp <= 0 ||
      (p.classId === 'guardian' && p.guarding) ||
      (p.classId === 'vanguard' && p.counterLeft > 0)
    )
      return;
    p.stunLeft = Math.max(p.stunLeft, RULES.freeze);
    p.guardStunExempt = false;
    p.frozenLeft = RULES.freeze;
    p.windup = 0;
    p.shotCharge = 0;
    p.specialCharge = 0;
    p.dashLeft = 0;
    p.trapLeft = 0;
    lowerGuard(p);
    this.event('freeze', p, p.team);
  }
  /** A charged fireball bursts on impact, splashing half its damage around. */
  protected explode(a: Arrow, owner: Player, amount: number, skip?: string) {
    if ((a.skillId ? a.skillId !== 'mage.fireball' : a.classId !== 'mage') || !a.power) return;
    const s = this.state,
      radius = RULES.explosionRadius * (0.6 + 0.4 * a.power) * (1+(owner.pve?.classRanks.mage??0)*.12);
    for (const q of s.players)
      if (q.id !== skip && this.hostile(a, q) && q.hp > 0 && distance(q, a) <= radius)
        this.damage(q, owner, Math.atan2(q.y - a.y, q.x - a.x), amount * 0.5);
    for (const z of s.zombies)
      if (z.id !== skip && this.hostile(a, z) && z.hp > 0 && distance(z, a) <= radius)
        this.damageZombie(z, a.team, amount * 0.5, undefined, owner.id);
    for (const mob of s.mobs)
      if (mob.id !== skip && mob.hp > 0 && mob.spawnLeft <= 0 && distance(mob, a) <= radius + MOB_STATS[mob.kind].radius)
        this.damageMob(mob, owner, amount * 0.5);
    this.event('explosion', a, a.team, a.angle, a.classId, a.power);
  }
  /**
   * Whether `a` may hurt `b`. In a match that is simply being on different teams; the world
   * overrides it with sanctuaries, wild zones and monsters. Must stay pure: it is asked everywhere.
   */
  protected hostile(a: Allegiant, b: Allegiant): boolean {
    return a.team !== b.team;
  }
  protected spawnBlackHole(owner: Player, x: number, y: number, options: Partial<Pick<BlackHole, 'radius' | 'burstRadius' | 'pull' | 'damage' | 'total'>> = {}) {
    const hole: BlackHole = {
      id: ++this.blackHoleId, owner: owner.id, team: owner.team, x, y,
      radius: options.radius ?? RULES.blackHoleRadius,
      burstRadius: options.burstRadius ?? RULES.blackHoleBurstRadius,
      pull: options.pull ?? RULES.blackHolePull,
      damage: options.damage ?? RULES.blackHoleDamage,
      left: options.total ?? RULES.blackHoleDuration,
      total: options.total ?? RULES.blackHoleDuration,
    };
    this.state.blackHoles.push(hole);
    this.event('blackhole', hole, owner.team, undefined, owner.classId, 1, 'mage.blackHole');
    return hole;
  }
  protected stepBlackHoles(dt: number) {
    for (const hole of this.state.blackHoles) {
      const owner = this.state.players.find((p) => p.id === hole.owner);
      const source: Allegiant = owner ?? { id: hole.owner, team: hole.team, x: hole.x, y: hole.y };
      const pull = (target: Vec, terrain: Rect[] | Terrain) => {
        const gap = distance(target, hole);
        if (gap <= 1 || gap > hole.radius) return;
        const stride = Math.min(gap, hole.pull * dt);
        translate(target, (hole.x - target.x) / gap * stride, (hole.y - target.y) / gap * stride, terrain);
      };
      for (const p of this.state.players)
        if (p.id !== hole.owner && p.hp > 0 && this.hostile(source, p)) pull(p, this.terrainFor(p));
      for (const z of this.state.zombies)
        if (z.hp > 0 && this.hostile(source, z)) pull(z, this.terrain);
      for (const mob of this.state.mobs)
        if (mob.hp > 0 && mob.spawnLeft <= 0) pull(mob, this.terrain);
      hole.left = Math.max(0, hole.left - dt);
      if (hole.left > 0) continue;
      for (const p of this.state.players)
        if (p.id !== hole.owner && p.hp > 0 && this.hostile(source, p) && distance(p, hole) <= hole.burstRadius)
          this.damage(p, owner ?? { team: hole.team }, Math.atan2(p.y - hole.y, p.x - hole.x), hole.damage);
      for (const z of this.state.zombies)
        if (z.hp > 0 && this.hostile(source, z) && distance(z, hole) <= hole.burstRadius)
          this.damageZombie(z, hole.team, hole.damage, Math.atan2(z.y - hole.y, z.x - hole.x), hole.owner);
      if (owner) for (const mob of this.state.mobs)
        if (mob.hp > 0 && mob.spawnLeft <= 0 && distance(mob, hole) <= hole.burstRadius)
          this.damageMob(mob, owner, hole.damage);
      this.event('explosion', hole, hole.team, undefined, owner?.classId, 1, 'mage.blackHole');
    }
    this.state.blackHoles = this.state.blackHoles.filter((hole) => hole.left > 0);
  }
  /** The ground a player's body moves on. The world lets some characters cross water. */
  protected terrainFor(_p: Player): Rect[] | Terrain {
    return this.terrain;
  }
  /** Whether this grave is one `raiser` may raise. */
  protected canRaise(raiser: Pick<Player, 'team' | 'id'>, g: Grave): boolean {
    return g.team !== raiser.team;
  }
  /** `by` names the striking entity (a player or a zombie id); matches ignore it, the world credits kills with it. */
  damageZombie(z: Zombie, team: Team, amount = 1, angle?: number, _by?: string) {
    // A revived mage's magic shield absorbs hits; a revived knight's raised guard blocks from the front.
    if (z.shieldHits > 0 && amount > 0) {
      z.shieldHits--;
      if (z.shieldHits === 0) z.skillCd.shield = RULES.magicShieldCooldown;
      this.event('block', z, z.team, angle, z.classId);
      return;
    }
    if (z.guardLeft > 0 && angle !== undefined) {
      const relative = angle + Math.PI - z.angle;
      if (
        Math.abs(Math.atan2(Math.sin(relative), Math.cos(relative))) <=
        RULES.guardArc / 2 + 1e-8
      ) {
        z.skillCd.riposte = 0.8;
        this.event('block', z, z.team, z.angle, z.classId);
        return;
      }
    }
    z.hp = Math.max(0, z.hp - amount);
    this.event('hit', z, team);
    if (z.hp === 0) this.event('death', z, z.team);
  }
  /** Only id, team and angle are read, so a wild monster can be born without an owning player. */
  protected newZombie(
    owner: Pick<Player, 'id' | 'team' | 'angle'>,
    at: Vec,
    fallback: Vec,
    extra: Partial<Zombie> = {},
  ): Zombie {
    const id = ++this.zombieId;
    return {
      id: `z${id}`,
      owner: owner.id,
      team: owner.team,
      ...(blocked(at.x, at.y, RULES.zombieRadius, this.terrain)
        ? { x: fallback.x, y: fallback.y }
        : { x: at.x, y: at.y }),
      hp: RULES.zombieHp,
      maxHp: RULES.zombieHp,
      angle: owner.angle,
      windup: 0,
      attackCd: 0,
      life: RULES.zombieLife,
      target: null,
      // Staggered so a crowd of zombies does not re-plan on the same tick.
      retarget: (id % 4) * RULES.tick,
      kind: 'brute',
      bonus: false,
      cast: 0,
      castCd: 0,
      healCd: RULES.hatHealEvery,
      spawnLeft: RULES.hatSpawnEvery,
      frozenLeft: 0,
      execution: null,
      slot: id % 4,
      rise: 0,
      bushId: null,
      revealLeft: 0,
      role: 'guard',
      level: 1,
      spell: 'ice',
      gustCd: 0,
      skillCd: {},
      action: null,
      shieldHits: 0,
      guardLeft: 0,
      counterLeft: 0,
      ...extra,
    };
  }
  /** Tap: two zombies. Held: one hat zombie. Full aura: raise or recall the thrall. */
  protected summon(p: Player, charge = 0) {
    const s = this.state;
    const ahead = { x: p.x + Math.cos(p.angle) * 26, y: p.y + Math.sin(p.angle) * 26 };
    if (charge >= RULES.overchargeTap) {
      if (charge >= RULES.raiseCharge - 1e-9 && this.raise(p, ahead)) return;
      if (s.zombies.some((z) => z.owner === p.id && z.kind === 'hat' && !z.summoner)) {
        p.summonCd = 0;
        return;
      }
      s.zombies.push(
        this.newZombie(p, ahead, p, {
          kind: 'hat',
          bonus: true,
          role: 'cursor',
          hp: RULES.hatHp,
          maxHp: RULES.hatHp,
          life: RULES.hatLife,
        }),
      );
      p.hatAlive = true;
      this.event('summon', p, p.team, p.angle, p.classId, 1);
      return;
    }
    // A guard that fell in the red circle comes back as a sword zombie, in its execution's place.
    const fallen = this.fallen.get(p.id);
    if (fallen?.length) {
      const execution = fallen.shift()!;
      p.fallenGuards = fallen.length;
      const taken = new Set(s.zombies.filter((z) => z.owner === p.id).map((z) => z.slot));
      const hp = swordZombieStats(1).hp;
      s.zombies.push(
        this.newZombie(p, ahead, p, {
          kind: 'sword',
          execution,
          hp,
          maxHp: hp,
          slot: [0, 1, 2, 3].find((slot) => !taken.has(slot)) ?? 0,
          rise: RULES.zombieRise,
        }),
      );
      p.activeExecutions = this.activeExecutions(p.id);
      this.event('summon', p, p.team, p.angle, p.classId);
      return;
    }
    if (this.activeExecutions(p.id) >= RULES.zombieExecutions) return;
    const execution = ++this.executionId;
    const taken = new Set(s.zombies.filter((z) => z.owner === p.id).map((z) => z.slot));
    const free = [0, 1, 2, 3].filter((slot) => !taken.has(slot));
    [-1, 1].forEach((side, i) => {
      const angle = p.angle + side * 0.75 * Math.PI;
      const at = {
        x: p.x + Math.cos(angle) * RULES.zombieFlankRadius,
        y: p.y + Math.sin(angle) * RULES.zombieFlankRadius,
      };
      s.zombies.push(
        this.newZombie(p, at, p, {
          execution,
          slot: free[i] ?? (execution * 2 + i) % 4,
          // Each body claws out of the ground a moment after the previous one.
          rise: RULES.zombieRise + i * 0.15,
          bushId: null,
          revealLeft: 0,
        }),
      );
    });
    p.activeExecutions = this.activeExecutions(p.id);
    this.event('summon', p, p.team, p.angle, p.classId);
  }
  protected raise(p: Player, ahead: Vec) {
    const s = this.state;
    // One thrall at a time; the necromancer's other zombies may stay alive.
    if (
      this.raising.has(p.id) ||
      s.zombies.some((z) => z.owner === p.id && z.kind === 'thrall' && !z.summoner)
    )
      return false;
    // The raising mandala opens under the cursor, kept inside the white raise circle.
    const aim = p.aimX >= 0 ? { x: p.aimX, y: p.aimY } : ahead;
    const angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    const spot = (r: number) => ({ x: p.x + Math.cos(angle) * r, y: p.y + Math.sin(angle) * r });
    let reach = Math.min(RULES.raiseRange, distance(p, aim));
    while (reach > 0 && blocked(spot(reach).x, spot(reach).y, RULES.zombieRadius, this.terrain))
      reach -= 8;
    const at = spot(Math.max(0, reach));
    // The fallen rival whose grave is closest to the mandala rises there.
    const corpse = s.graves
      .filter((g) => this.canRaise(p, g) && distance(p, g) <= RULES.raiseRange)
      .sort((a, b) => distance(at, a) - distance(at, b))[0];
    if (corpse) {
      p.thrall = { classId: corpse.classId, name: corpse.name };
      s.graves = s.graves.filter((g) => g !== corpse);
    } else if (!p.thrall || p.thrallCd > 0) return false;
    // Half a second of casting, rooted, before the mandala opens and the thrall rises there.
    this.raising.set(p.id, p.thrall!);
    p.raiseCast = RULES.raiseCast;
    p.raiseX = at.x;
    p.raiseY = at.y;
    this.event('mandala', at, p.team, p.angle, p.thrall!.classId);
    return true;
  }
  protected finishRaise(p: Player) {
    const s = this.state;
    const bound = this.raising.get(p.id);
    this.raising.delete(p.id);
    if (!bound || p.hp <= 0) return;
    const at = { x: p.raiseX, y: p.raiseY };
    const hp = CLASSES[bound.classId].hp;
    s.zombies.push(
      this.newZombie(p, at, p, {
        kind: 'thrall',
        bonus: true,
        hp,
        maxHp: hp,
        life: 9999,
        classId: bound.classId,
        name: bound.name,
        role: 'cursor',
        shieldHits: bound.classId === 'mage' ? RULES.magicShieldHits : 0,
        // Claws out of the mandala before it can move or strike.
        rise: RULES.thrallRise,
        bushId: null,
        revealLeft: 0,
      }),
    );
    p.thrallAlive = true;
    this.event('raise', at, p.team, p.angle, bound.classId);
  }
  /** A projectile fired by a zombie and credited to its necromancer; `side` spreads a volley. */
  private zombieShot(
    z: Zombie,
    owner: Player,
    shot: Partial<Arrow> & { classId: ClassId },
    angle = z.angle,
    side = 0,
  ) {
    this.state.arrows.push({
      id: ++this.arrowId,
      owner: owner.id,
      team: z.team,
      x: z.x - Math.sin(angle) * side * RULES.volleyGap,
      y: z.y + Math.cos(angle) * side * RULES.volleyGap,
      angle: angle + side * RULES.volleyAngle,
      life: projectileSkillStats(shot.skillId,shot.classId, shot.charged, shot.power).life,
      ...shot,
    });
  }
  /** Zombie mage's icy breeze: a cone that damages and freezes everyone inside it at once. */
  private iceCone(z: Zombie, owner: Player) {
    const s = this.state;
    const inside = (q: Vec, body: number) => {
      const d = distance(z, q);
      if (d > RULES.iceConeRange + body) return false;
      const diff = Math.atan2(q.y - z.y, q.x - z.x) - z.angle;
      return (
        (d <= body ||
          Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff))) <= RULES.iceConeArc / 2) &&
        lineClear(z, q, this.terrain)
      );
    };
    for (const p of s.players)
      if (
        this.hostile(z, p) &&
        p.hp > 0 &&
        inside(p, RULES.radius) &&
        this.damage(p, owner, z.angle, RULES.spellDamage)
      )
        this.freeze(p);
    for (const q of s.zombies)
      if (this.hostile(z, q) && q.hp > 0 && inside(q, RULES.zombieRadius)) {
        this.damageZombie(q, z.team, RULES.spellDamage, z.angle, z.id);
        q.frozenLeft = RULES.freeze;
        this.event('freeze', q, q.team);
      }
    for (const mob of s.mobs)
      if (mob.hp > 0 && mob.spawnLeft <= 0 && inside(mob, MOB_STATS[mob.kind].radius)) {
        this.damageMob(mob, owner, RULES.spellDamage, RULES.freeze);
        this.event('freeze', mob, 'red');
      }
  }
  /** A rival projectile about to reach this zombie: within 120 px and flying straight at it. */
  private incomingShot(z: Zombie) {
    return this.state.arrows.find((a) => {
      if (!this.hostile(a, z) || a.hits?.includes(z.id)) return false;
      const dx = z.x - a.x,
        dy = z.y - a.y;
      if (Math.hypot(dx, dy) > 120) return false;
      const along = dx * Math.cos(a.angle) + dy * Math.sin(a.angle);
      const aside = Math.abs(-dx * Math.sin(a.angle) + dy * Math.cos(a.angle));
      return along > 0 && aside < RULES.zombieRadius + 8;
    });
  }
  /**
   * A revived player fights with its class skills and chains them into combos. Returns true while a
   * skill keeps it busy this tick, so it neither walks nor makes a basic attack.
   */
  protected thrallSkills(
    z: Zombie,
    target: Vec | undefined,
    owner: Player,
    minions: Zombie[],
    dt: number,
  ) {
    for (const key of Object.keys(z.skillCd) as ThrallSkill[])
      z.skillCd[key] = Math.max(0, (z.skillCd[key] ?? 0) - dt);
    z.guardLeft = Math.max(0, z.guardLeft - dt);
    z.counterLeft = Math.max(0, z.counterLeft - dt);
    const ready = (skill: ThrallSkill) => !z.skillCd[skill];
    const classId = z.classId ?? 'guardian';
    if (classId === 'mage' && z.shieldHits === 0 && ready('shield'))
      z.shieldHits = RULES.magicShieldHits;
    if (classId === 'necromancer' && !z.action) this.thrallSummons(z, owner, minions);
    if (z.action) return this.stepThrallAction(z, target, owner, minions, dt);
    // Defensive reactions first: a knight raises its guard, a warrior counters an incoming shot.
    const incoming =
      classId === 'guardian' || classId === 'vanguard' ? this.incomingShot(z) : undefined;
    if (incoming && classId === 'guardian' && ready('guard')) {
      z.skillCd.guard = RULES.guardCooldown + RULES.guardDuration;
      z.guardLeft = RULES.guardDuration;
      z.angle = incoming.angle + Math.PI;
      return true;
    }
    if (incoming && classId === 'vanguard' && ready('counter')) {
      z.skillCd.counter = RULES.counterCooldown;
      z.counterLeft = RULES.counterWindow * 2;
    }
    if (!target) return false;
    const gap = distance(z, target);
    const clear = lineClear(z, target, this.terrain);
    const aim = Math.atan2(target.y - z.y, target.x - z.x);
    const melee = CLASSES[classId].meleeRange;
    const start = (skill: ThrallSkill, left: number, angle = aim) => {
      z.action = { skill, left, total: left, angle };
      z.angle = angle;
      z.revealLeft = 1.5;
      return true;
    };
    switch (classId) {
      case 'archer':
        if (gap < 90 && ready('trap')) {
          z.skillCd.trap = RULES.trapCooldown;
          this.placeTrap(owner, z);
        }
        // Too close: a charged dash away, loosing a wind arrow mid-jump.
        if (gap < 70 && ready('dash')) {
          z.skillCd.dash = RULES.dashCooldown;
          return start('dash', RULES.dashDuration * 1.8, aim + Math.PI);
        }
        if (!clear || gap > 300) return false;
        if (ready('volley')) {
          z.skillCd.volley = RULES.volleyCooldown;
          z.angle = aim;
          this.thrallVolley(z, owner, aim, false);
          return true;
        }
        if (ready('charged') && gap > 120) {
          z.skillCd.charged = 3;
          return start('charged', RULES.chargeTime);
        }
        return false;
      case 'mage':
        if (gap < 70 && ready('dash')) {
          z.skillCd.dash = RULES.dashCooldown;
          return start('dash', RULES.dashDuration * 1.5, aim + Math.PI);
        }
        if (!clear || gap > 300) return false;
        if (ready('ice')) {
          z.skillCd.ice = RULES.iceCooldown * 4;
          z.skillCd.combo = 1.2;
          z.angle = aim;
          this.zombieShot(z, owner, { classId: 'mage', ice: true }, aim);
          this.event('shot', z, z.team, aim, 'mage');
          return true;
        }
        // Combo: right after the ice bolt the big fireball charges for the frozen target.
        if (ready('charged') && (z.skillCd.combo ?? 0) > 0) {
          z.skillCd.charged = 4;
          return start('charged', RULES.overchargeTime * 0.7);
        }
        return false;
      case 'necromancer':
        if (clear && gap <= 300 && gap > 80 && ready('charged')) {
          z.skillCd.charged = 4;
          return start('charged', RULES.overchargeTime * 0.7);
        }
        return false;
      case 'guardian':
        // Combo: a block is answered with a quick charged swing; otherwise a charged swing now and then.
        if (clear && gap <= melee * 1.3 && (z.skillCd.riposte ?? 0) > 0) {
          z.skillCd.riposte = 0;
          z.skillCd.charged = 2.5;
          return start('charged', 0.35);
        }
        if (clear && gap <= melee && ready('charged')) {
          z.skillCd.charged = 3.5;
          return start('charged', RULES.overchargeTime * 0.55);
        }
        return false;
      default:
        // Warrior: dash in to close the gap, travelling slash from mid range, charged heavy swing up close.
        if (clear && gap > 150 && gap < 320 && ready('dash')) {
          z.skillCd.dash = RULES.dashCooldown * 1.5;
          return start('dash', RULES.dashDuration * RULES.vanguardDash * 1.6);
        }
        if (clear && gap >= 90 && gap <= 270 && ready('slash')) {
          z.skillCd.slash = RULES.slashCooldown;
          z.angle = aim;
          this.zombieShot(z, owner, { classId: 'vanguard', slash: true, hits: [] }, aim);
          this.event('slash', z, z.team, aim, 'vanguard');
          return true;
        }
        if (clear && gap <= melee && ready('charged')) {
          z.skillCd.charged = 4;
          return start('charged', RULES.overchargeTime * 0.55);
        }
        return false;
    }
  }
  /** Advances a thrall's charge, dash or raise; the skill goes off when it completes. */
  private stepThrallAction(
    z: Zombie,
    target: Vec | undefined,
    owner: Player,
    minions: Zombie[],
    dt: number,
  ) {
    const action = z.action!;
    action.left = Math.max(0, action.left - dt);
    if (action.skill === 'dash') {
      translate(
        z,
        Math.cos(action.angle) * RULES.dashSpeed * dt,
        Math.sin(action.angle) * RULES.dashSpeed * dt,
        this.terrain,
      );
      // Archer combo: mid-jump it looses a wind arrow at its rival (a wind volley at point blank).
      if (
        z.classId === 'archer' &&
        target &&
        !z.skillCd.wind &&
        action.left <= action.total / 2 &&
        lineClear(z, target, this.terrain)
      ) {
        const aim = Math.atan2(target.y - z.y, target.x - z.x);
        z.skillCd.wind = 6;
        if (distance(z, target) < 90) this.thrallVolley(z, owner, aim, true);
        else {
          const speed = projectileStats('archer', true).speed;
          this.zombieShot(
            z,
            owner,
            {
              classId: 'archer',
              charged: true,
              wind: true,
              hits: [],
              damageScale: RULES.windScale,
              life: RULES.projectileCrossing / speed,
            },
            aim,
          );
          this.event('wind', z, z.team, aim, 'archer');
        }
      }
      if (action.left <= 1e-8) z.action = null;
      return true;
    }
    if (action.skill === 'raise') {
      if (action.left > 1e-8) return true;
      z.action = null;
      const classId = action.classId ?? 'guardian';
      const hp = CLASSES[classId].hp;
      const at = { x: action.x ?? z.x, y: action.y ?? z.y };
      minions.push(
        this.newZombie(owner, at, z, {
          kind: 'thrall',
          bonus: true,
          hp,
          maxHp: hp,
          life: 9999,
          classId,
          name: action.name,
          role: z.role,
          rise: RULES.thrallRise,
          summoner: z.id,
          shieldHits: classId === 'mage' ? RULES.magicShieldHits : 0,
        }),
      );
      this.event('raise', at, z.team, z.angle, classId);
      return true;
    }
    if (target) action.angle = z.angle = Math.atan2(target.y - z.y, target.x - z.x);
    if (action.left > 1e-8) return true;
    z.action = null;
    const classId = z.classId ?? 'guardian';
    if (CLASSES[classId].ranged) {
      this.zombieShot(
        z,
        owner,
        classId === 'archer' ? { classId, charged: true } : { classId, power: 1 },
        action.angle,
      );
      this.event('shot', z, z.team, action.angle, classId, classId === 'archer' ? 0 : 1);
    } else this.thrallSwing(z, owner, action.angle, MELEE_OVERCHARGE[classId] ?? 1.5);
    return true;
  }
  /** A revived melee player's charged swing: wider and harder than its basic hit. */
  private thrallSwing(z: Zombie, owner: Player, angle: number, scale: number) {
    const s = this.state,
      stats = CLASSES[z.classId ?? 'guardian'];
    const range = stats.meleeRange * 1.3,
      arc = stats.meleeArc * 1.2,
      amount = stats.meleeDamage * scale;
    const within = (q: Vec) => {
      const diff = Math.atan2(q.y - z.y, q.x - z.x) - angle;
      return (
        distance(z, q) <= range &&
        Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff))) <= arc / 2 &&
        lineClear(z, q, this.terrain)
      );
    };
    for (const p of s.players)
      if (this.hostile(z, p) && p.hp > 0 && within(p)) this.damage(p, owner, angle, amount);
    for (const q of s.zombies)
      if (this.hostile(z, q) && q.hp > 0 && within(q)) this.damageZombie(q, z.team, amount, angle, z.id);
    for (const mob of s.mobs)
      if (mob.hp > 0 && mob.spawnLeft <= 0 && within(mob)) this.damageMob(mob, owner, amount);
    this.event('sword', z, z.team, angle, z.classId, 1);
  }
  /** A revived archer's triple shot; with `wind`, the three wind arrows of its jump combo. */
  private thrallVolley(z: Zombie, owner: Player, angle: number, wind: boolean) {
    const volley = ++this.volleyId;
    for (const side of [-1, 0, 1])
      this.zombieShot(
        z,
        owner,
        {
          classId: 'archer',
          volley,
          hits: [],
          ...(wind ? { charged: true, wind: true, damageScale: RULES.windVolleyScale } : {}),
        },
        angle,
        side,
      );
    this.event(wind ? 'wind' : 'shot', z, z.team, angle, 'archer');
  }
  /** A trap laid by a revived archer, owned by its necromancer (same cap as the player's own traps). */
  private placeTrap(owner: Player, at: Vec) {
    const s = this.state;
    const owned = s.traps.filter((t) => t.owner === owner.id);
    if (owned.length >= RULES.trapMax) s.traps = s.traps.filter((t) => t.id !== owned[0].id);
    s.traps.push({
      id: ++this.trapId,
      owner: owner.id,
      team: owner.team,
      x: at.x,
      y: at.y,
      armLeft: RULES.trapArm,
      life: RULES.trapLife,
    });
  }
  /**
   * A revived necromancer does what a necromancer does: raises a nearby grave (unless it was raised by
   * another thrall), keeps a zombie mage, and summons brutes every 5 s — with its own caps.
   */
  private thrallSummons(z: Zombie, owner: Player, minions: Zombie[]) {
    const s = this.state;
    const mine = [...s.zombies, ...minions].filter((q) => q.summoner === z.id && q.hp > 0);
    if (!z.summoner && !z.skillCd.raise && !mine.some((q) => q.kind === 'thrall')) {
      const grave = s.graves
        .filter((g) => g.team !== z.team && distance(z, g) <= RULES.raiseRange)
        .sort((a, b) => distance(z, a) - distance(z, b))[0];
      if (grave) {
        s.graves = s.graves.filter((g) => g !== grave);
        z.skillCd.raise = RULES.thrallCooldown;
        const angle = Math.atan2(grave.y - z.y, grave.x - z.x);
        z.action = {
          skill: 'raise',
          left: RULES.raiseCast,
          total: RULES.raiseCast,
          angle,
          x: grave.x,
          y: grave.y,
          classId: grave.classId,
          name: grave.name,
        };
        this.event('mandala', grave, z.team, angle, grave.classId);
        return;
      }
    }
    const ahead = { x: z.x + Math.cos(z.angle) * 26, y: z.y + Math.sin(z.angle) * 26 };
    if (!z.skillCd.hat && !mine.some((q) => q.kind === 'hat')) {
      z.skillCd.hat = RULES.summonCooldown;
      minions.push(
        this.newZombie(owner, ahead, z, {
          kind: 'hat',
          bonus: true,
          role: z.role,
          hp: RULES.hatHp,
          maxHp: RULES.hatHp,
          life: RULES.hatLife,
          summoner: z.id,
        }),
      );
      this.event('summon', z, z.team, z.angle, 'necromancer', 1);
      return;
    }
    const executions = new Set(mine.filter((q) => q.kind === 'brute').map((q) => q.execution)).size;
    if (!z.skillCd.summon && executions < RULES.zombieExecutions) {
      z.skillCd.summon = RULES.summonCooldown;
      const execution = ++this.executionId;
      [-1, 1].forEach((side, i) => {
        const angle = z.angle + side * 0.75 * Math.PI;
        const at = {
          x: z.x + Math.cos(angle) * RULES.zombieFlankRadius,
          y: z.y + Math.sin(angle) * RULES.zombieFlankRadius,
        };
        minions.push(
          this.newZombie(owner, at, z, {
            execution,
            bonus: true,
            role: z.role,
            summoner: z.id,
            rise: RULES.zombieRise + i * 0.15,
          }),
        );
      });
      this.event('summon', z, z.team, z.angle, 'necromancer');
    }
  }
  /** A sword zombie that kills levels up (up to 3): more damage and life, faster swings, then cleave. */
  protected levelUp(z: Zombie) {
    if (z.level >= RULES.swordZombieLevelMax) return;
    z.level++;
    z.maxHp = swordZombieStats(z.level).hp;
    z.hp = z.maxHp;
    this.event('levelup', z, z.team, z.angle, undefined, z.level);
  }
  /** A plain volley arrow flies past a target its sibling already struck, on to the next rival in line. */
  private volleyPasses(a: Arrow, id: string) {
    if (a.volley === undefined || a.wind || !this.volleyHits.has(`${a.volley}:${id}`)) return false;
    a.hits!.push(id);
    return true;
  }
  private markVolley(a: Arrow, id: string) {
    const key = `${a.volley}:${id}`;
    if (a.volley !== undefined && !this.volleyHits.has(key))
      this.volleyHits.set(key, this.state.tick);
  }
  /** Zombie mage: the icy breeze or the fireball, then the other one next time. Thrall: its class shot. */
  protected castSpell(z: Zombie, owner: Player) {
    if (z.kind === 'hat') {
      if (z.spell === 'ice') {
        this.iceCone(z, owner);
        this.event('icecone', z, z.team, z.angle, 'necromancer', 0);
      } else {
        this.zombieShot(z, owner, {
          classId: 'necromancer',
          element: 'fire',
          blast: true,
          hits: [],
          damageScale: RULES.spellDamage,
          life: RULES.hatFireLife,
        });
        this.event('shot', z, z.team, z.angle, 'necromancer', 1);
      }
      z.spell = z.spell === 'ice' ? 'fire' : 'ice';
      z.castCd = RULES.hatCastCooldown;
      return;
    }
    const classId = z.classId ?? 'archer';
    this.zombieShot(z, owner, { classId });
    z.castCd = projectileStats(classId).cooldown;
    this.event('shot', z, z.team, z.angle, classId);
  }
  /** Distinct live summon executions; zombies without an execution never use a slot. */
  activeExecutions(owner: string) {
    return new Set(
      this.state.zombies
        .filter((z) => z.owner === owner && z.hp > 0 && z.execution !== null && !z.summoner)
        .map((z) => z.execution),
    ).size;
  }
  /** Normal zombies guard the red circle around the necromancer; the hat zombie, its minions and the thrall follow the mouse. */
  protected zombieMode(z: Zombie, owner = this.state.players.find((p) => p.id === z.owner)) {
    if (!owner || owner.hp <= 0 || owner.zombieAuto) return 'auto' as const;
    return z.role === 'cursor' && owner.aimX >= 0 ? ('cursor' as const) : ('guard' as const);
  }
  /** ⌘E moves the zombie nearest the cursor between the guard circle and the cursor; E toggles automatic. */
  private commandZombies(p: Player, input: Input) {
    const own = this.state.zombies.filter((z) => z.owner === p.id && z.hp > 0);
    if (input.mark && input.aimX >= 0) {
      const aim = { x: input.aimX, y: input.aimY };
      const pick = own
        .filter((z) => distance(z, aim) <= RULES.zombieMarkPick)
        .sort((a, b) => distance(a, aim) - distance(b, aim))[0];
      if (pick) pick.role = pick.role === 'guard' ? 'cursor' : 'guard';
    }
    if (input.command) p.zombieAuto = !p.zombieAuto;
    // Orders apply at once instead of on the next staggered re-plan.
    for (const z of own) z.retarget = 0;
  }
  /** The rival nearest to the owner's cursor, if the cursor is close enough to one. */
  private markedTarget(owner: string, candidates: { id: string; at: Vec }[]) {
    const p = this.state.players.find((q) => q.id === owner);
    if (!p || p.aimX < 0 || p.aimY < 0) return null;
    const aim = { x: p.aimX, y: p.aimY };
    let marked: string | null = null,
      gap: number = RULES.zombieAimRadius;
    for (const c of candidates) {
      const d = distance(aim, c.at);
      if (d <= gap) {
        marked = c.id;
        gap = d;
      }
    }
    return marked;
  }
  /**
   * Where `z` should stand around `center`. Zombies of the same owner chasing the same goal
   * spread over it (a pincer for two, a ring for more), each keeping the side it is already on,
   * so the pack closes in from several directions instead of queueing behind each other.
   */
  protected formation(z: Zombie, center: Vec, near: number, far = near): Vec {
    // Idle zombies group by what they do: guards around the necromancer apart from the cursor squad.
    const mode = this.zombieMode(z);
    const pack = this.state.zombies.filter(
      (q) =>
        q.hp > 0 &&
        q.owner === z.owner &&
        q.target === z.target &&
        (z.target !== null || this.zombieMode(q) === mode),
    );
    const bearing = (q: Vec) => Math.atan2(q.y - center.y, q.x - center.x);
    const key = `${z.owner}:${z.target ?? mode}`;
    this.packSeen.add(key);
    let sx = 0,
      sy = 0;
    for (const q of pack) {
      sx += Math.cos(bearing(q));
      sy += Math.sin(bearing(q));
    }
    // Once the pack already surrounds the goal the mean bearing is meaningless: keep the last one.
    const stored = this.packBearings.get(key);
    const base =
      stored === undefined || Math.hypot(sx, sy) > pack.length * 0.35 ? Math.atan2(sy, sx) : stored;
    this.packBearings.set(key, base);
    const order = pack
      .map((q) => ({ q, side: wrapAngle(bearing(q) - base) }))
      .sort((a, b) => a.side - b.side || a.q.slot - b.q.slot);
    const i = order.findIndex((o) => o.q === z),
      n = pack.length;
    const offset =
      n <= 1 ? 0 : n === 2 ? (i === 0 ? -1.15 : 1.15) : -Math.PI + ((i + 0.5) * 2 * Math.PI) / n;
    const angle = base + offset;
    // Still on the wrong side: stay wide and walk around the goal instead of through it.
    const detour = Math.abs(wrapAngle(bearing(z) - angle)) / (Math.PI / 2);
    const reach = Math.min(far, Math.max(near, distance(z, center) * 0.6, near + 45 * detour));
    for (let r = reach; r > 8; r -= 12) {
      const point = { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
      if (!blocked(point.x, point.y, RULES.zombieRadius, this.terrain)) return point;
    }
    return center;
  }
  protected siblingCells(z: Zombie) {
    const cells = new Set<number>();
    for (const q of this.state.zombies)
      if (q !== z && q.owner === z.owner && q.target === z.target)
        for (const cell of pathCells(this.paths.get(q.id)?.points ?? [])) cells.add(cell);
    return cells;
  }
  protected chooseTarget(z: Zombie) {
    const s = this.state;
    const candidates = [
      ...s.players
        .filter((p) => this.hostile(z, p) && p.hp > 0 && playerVisibleTo(s, p, z.team))
        .map((p) => ({
          id: p.id,
          at: p as Vec,
          carrying: s.flags.some((f) => f.carrier === p.id),
        })),
      ...s.zombies
        .filter((q) => this.hostile(z, q) && q.hp > 0 && zombieVisibleTo(s, q, z.team))
        .map((q) => ({ id: q.id, at: q as Vec, carrying: false })),
      ...s.mobs.filter(m=>m.hp>0&&m.spawnLeft<=0).map(m=>({id:m.id,at:m as Vec,carrying:false})),
    ];
    // Cursor zombies only attack the rival under the cursor, guards only whoever steps into the
    // red circle around their necromancer, and automatic ones hunt anyone nearby.
    const owner = s.players.find((p) => p.id === z.owner);
    const mode = this.zombieMode(z, owner);
    const marked = mode === 'cursor' ? this.markedTarget(z.owner, candidates) : undefined;
    const near = candidates.filter((c) =>
      mode === 'cursor'
        ? c.id === marked
        : mode === 'guard'
          ? distance(owner!, c.at) <= RULES.zombieGuardRadius
          : distance(z, c.at) <= (z.family ? mobStats(z.family, z.level).aggro : RULES.zombieAggro) * (c.id === z.target ? 1 : this.noticeScale(c.id)),
    );
    // Siblings already chasing a target make it less attractive, so a pack splits up.
    const score = (c: (typeof candidates)[number]) =>
      distance(z, c.at) +
      (lineClear(z, c.at, this.terrain) ? 0 : 120) -
      (c.carrying ? 100 : 0) +
      70 * s.zombies.filter((q) => q !== z && q.owner === z.owner && q.target === c.id).length;
    let best = near.find((c) => c.id === z.target);
    let bestScore = best ? score(best) - 40 : Infinity;
    for (const c of near) {
      const value = score(c);
      if (value < bestScore) {
        best = c;
        bestScore = value;
      }
    }
    if (best?.id !== z.target) this.paths.delete(z.id);
    z.target = best?.id ?? null;
  }
  protected walkZombie(z: Zombie, goal: Vec, dt: number, pace = 1) {
    let aim = goal;
    if (bodyClear(z, goal, RULES.zombieRadius - 1, this.terrain)) this.paths.delete(z.id);
    else {
      let route = this.paths.get(z.id);
      if (!route?.points.length || distance(route.goal, goal) > 40) {
        route = {
          goal: { x: goal.x, y: goal.y },
          points: findPath(z, goal, this.siblingCells(z), this.terrain),
        };
        this.paths.set(z.id, route);
      }
      const points = route.points;
      while (points.length > 1 && bodyClear(z, points[1], RULES.zombieRadius - 1, this.terrain))
        points.shift();
      if (points.length && distance(z, points[0]) < 4) points.shift();
      aim = points[0] ?? goal;
    }
    const gap = distance(z, aim);
    if (gap < 1e-6) return;
    z.angle = Math.atan2(aim.y - z.y, aim.x - z.x);
    const stride = Math.min(
      gap,
      (z.family ? mobStats(z.family, z.level).speed : RULES.zombieSpeed) *
        pace *
        ZOMBIE_PACE[z.slot % ZOMBIE_PACE.length] *
        dt,
    );
    translate(z, Math.cos(z.angle) * stride, Math.sin(z.angle) * stride, this.terrain);
  }
  protected stepZombies(dt: number) {
    const s = this.state;
    s.graves = s.graves.filter((g) => (g.left -= dt) > 0);
    const minions: Zombie[] = [];
    for (const z of s.zombies) {
      if (z.hp <= 0) continue;
      z.life -= dt;
      const walkDt = Math.max(0, dt - (z.frozenLeft ?? 0));
      z.attackCd = Math.max(0, z.attackCd - dt);
      z.castCd = Math.max(0, z.castCd - dt);
      z.gustCd = Math.max(0, z.gustCd - dt);
      z.retarget -= dt;
      z.revealLeft = Math.max(0, z.revealLeft - dt);
      z.bushId = pointBush(this.map, z);
      if (z.retarget <= 1e-9) {
        z.retarget = RULES.zombieRetarget;
        this.chooseTarget(z);
      }
      const player = s.players.find(
        (p) => p.id === z.target && p.hp > 0 && playerVisibleTo(s, p, z.team),
      );
      const zombie = s.zombies.find(
        (q) => q.id === z.target && q.hp > 0 && zombieVisibleTo(s, q, z.team),
      );
      const mob=s.mobs.find(m=>m.id===z.target&&m.hp>0&&m.spawnLeft<=0);
      const target: Vec | undefined = player ?? zombie ?? mob;
      if (!target) z.target = null;
      const owner = s.players.find((p) => p.id === z.owner);
      const pace =
        z.kind === 'thrall' ? 1.1 : z.kind === 'sword' ? swordZombieStats(z.level).pace : 1;
      const mode = this.zombieMode(z, owner);
      if (z.rise > 0) {
        z.rise = Math.max(0, z.rise - dt);
        continue;
      }
      if (z.kind === 'hat') {
        z.healCd -= dt;
        if (z.healCd <= 0) {
          z.healCd = RULES.hatHealEvery;
          if (z.hp < z.maxHp) {
            z.hp = Math.min(z.maxHp, z.hp + RULES.hatHeal);
            this.event('heal', z, z.team);
          }
        }
        z.spawnLeft -= dt;
        if (z.spawnLeft <= 0 && owner) {
          z.spawnLeft = RULES.hatSpawnEvery;
          const behind = { x: z.x - Math.cos(z.angle) * 24, y: z.y - Math.sin(z.angle) * 24 };
          // The hat zombie's minions skip the summon limit and are the ones that follow the cursor.
          // Zombies no longer expire, so a hat keeps only a few minions alive at once.
          const alive =
            minions.length +
            s.zombies.filter(
              (q) => q.owner === z.owner && q.hp > 0 && q.bonus && q.kind === 'brute',
            ).length;
          if (alive < RULES.hatMinionMax) {
            minions.push(this.newZombie(owner, behind, z, { bonus: true, role: 'cursor' }));
            this.event('summon', z, z.team, z.angle, 'necromancer');
          }
        }
      }
      if (z.frozenLeft > 0) {
        z.frozenLeft = Math.max(0, z.frozenLeft - dt);
        z.windup = 0;
        z.cast = 0;
        continue;
      }
      if (z.kind === 'thrall' && owner && this.thrallSkills(z, target, owner, minions, dt))
        continue;
      const ranged =
        z.kind === 'hat' || (z.kind === 'thrall' && !!z.classId && CLASSES[z.classId].ranged);
      if (ranged) {
        if (z.cast > 0) {
          z.cast = Math.max(0, z.cast - dt);
          if (z.cast <= 0 && owner) this.castSpell(z, owner);
          continue;
        }
        const gap = target ? distance(z, target) : Infinity;
        // The icy breeze is a close-range cone; the fireball and a revived player's shots reach farther.
        const range =
          z.kind === 'hat'
            ? z.spell === 'ice'
              ? RULES.iceConeRange * 0.85
              : RULES.hatCastRange
            : 260;
        if (
          target &&
          gap >= (z.kind === 'hat' ? 0 : 50) &&
          gap <= range &&
          z.castCd <= 0 &&
          lineClear(z, target, this.terrain)
        ) {
          z.angle = Math.atan2(target.y - z.y, target.x - z.x);
          z.cast = z.kind === 'hat' ? RULES.hatCastTime : 0.25;
          z.revealLeft = 1.5;
          this.event(
            'cast',
            z,
            z.team,
            z.angle,
            z.classId ?? 'necromancer',
            z.kind === 'hat' && z.spell === 'fire' ? 1 : 0,
          );
          continue;
        }
        if (
          z.kind === 'hat' &&
          owner &&
          target &&
          gap <= RULES.gustRange &&
          z.gustCd <= 0 &&
          lineClear(z, target, this.terrain)
        ) {
          // Between spells the mage keeps up the pressure with short wind gusts.
          z.angle = Math.atan2(target.y - z.y, target.x - z.x);
          z.gustCd = RULES.gustEvery;
          this.zombieShot(z, owner, {
            classId: 'necromancer',
            gust: true,
            damageScale: RULES.gustDamage / RULES.fireDamage,
            life: RULES.gustRange / RULES.gustSpeed,
          });
        }
        const leader = owner && owner.hp > 0 ? owner : undefined;
        const goal = target
          ? gap > range * 0.7
            ? target
            : undefined
          : leader && mode === 'cursor'
            ? this.formation(z, { x: leader.aimX, y: leader.aimY }, RULES.zombieSpread)
            : leader && (mode === 'guard' || distance(z, leader) > 70)
              ? this.formation(z, leader, RULES.zombieSpread)
              : undefined;
        if (goal) this.walkZombie(z, goal, dt, pace);
        continue;
      }
      const melee = z.kind === 'thrall' && z.classId ? CLASSES[z.classId] : undefined;
      const sword = z.kind === 'sword' ? swordZombieStats(z.level) : undefined;
      // A world monster brings its family's numbers, the same way a thrall brings its class's.
      const wild = z.family ? mobStats(z.family, z.level) : undefined;
      const reach = melee
        ? melee.meleeRange
        : sword
          ? RULES.zombieRange + 6
          : wild
            ? wild.range
            : RULES.zombieRange;
      if (z.windup > 0) {
        z.windup = Math.max(0, z.windup - dt);
        if (z.windup > 0) continue;
        z.attackCd = melee
          ? melee.meleeCooldown
          : sword
            ? sword.cooldown
            : wild
              ? wild.cooldown
              : RULES.zombieCooldown;
        if (target && distance(z, target) <= reach + 8 && lineClear(z, target, this.terrain)) {
          const angle = Math.atan2(target.y - z.y, target.x - z.x);
          const amount = melee
            ? melee.meleeDamage
            : sword
              ? sword.damage
              : wild
                ? wild.damage
                : RULES.zombieDamage;
          // A level 3 sword zombie cleaves every rival within reach; the rest strike only their target.
          const inReach = (q: Vec & Allegiant & { hp: number }) =>
            this.hostile(z, q) &&
            q.hp > 0 &&
            distance(z, q) <= reach + 8 &&
            lineClear(z, q, this.terrain);
          const players = sword?.cleave ? s.players.filter(inReach) : player ? [player] : [];
          const zombies = sword?.cleave ? s.zombies.filter(inReach) : zombie ? [zombie] : [];
          const mobs=sword?.cleave?s.mobs.filter(q=>q.hp>0&&distance(z,q)<=reach+8&&lineClear(z,q,this.terrain)):mob?[mob]:[];
          let kills = 0;
          // A wild monster answers to nobody, so it strikes in its own name; without this the
          // world's monsters could chase and surround a player but never hurt one.
          const striker = owner ?? (z.faction === 'monster' ? z : undefined);
          if (striker)
            for (const q of players)
              if (this.damage(q, striker, Math.atan2(q.y - z.y, q.x - z.x), amount) && q.hp <= 0)
                kills++;
          for (const q of zombies) {
            this.damageZombie(q, z.team, amount, Math.atan2(q.y - z.y, q.x - z.x), z.id);
            if (q.hp <= 0) kills++;
          }
          if(owner)for(const q of mobs){this.damageMob(q,owner,amount);if(q.hp<=0)kills++;}
          if (melee || sword) this.event('sword', z, z.team, angle, z.classId ?? 'guardian');
          if (sword) for (let i = 0; i < kills; i++) this.levelUp(z);
        }
        continue;
      }
      if (target && distance(z, target) <= reach && lineClear(z, target, this.terrain)) {
        z.angle = Math.atan2(target.y - z.y, target.x - z.x);
        if (z.attackCd <= 0) {
          z.windup = melee
            ? Math.max(melee.windup, 0.2)
            : wild
              ? wild.windup
              : RULES.zombieWindup;
          z.revealLeft = 1.5;
        }
        continue;
      }
      const leader = owner && owner.hp > 0 ? owner : undefined;
      const aim = leader && mode === 'cursor' ? { x: leader.aimX, y: leader.aimY } : undefined;
      // Far away the pack fans out wide; the ring tightens as each zombie closes in, and
      // only from its own spot does it lunge at the target.
      const spot =
        target && this.formation(z, target, RULES.zombieFlankRadius, RULES.zombieApproachRadius);
      const goal =
        target && spot
          ? distance(z, spot) < 12 || distance(z, target) <= RULES.zombieFlankRadius
            ? target
            : spot
          : aim
            ? this.formation(z, aim, RULES.zombieSpread)
            : leader
              ? mode === 'guard' || distance(z, leader) > 70
                ? this.formation(z, leader, RULES.zombieSpread)
                : undefined
              : s.flags
                  .filter((f) => f.team !== z.team)
                  .sort((a, b) => distance(z, a) - distance(z, b))[0];
      if (goal && walkDt > 0) this.walkZombie(z, goal, walkDt, pace);
    }
    s.zombies.push(...minions);
    const list = s.zombies;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i],
          b = list[j],
          gap = distance(a, b);
        if (gap >= 20) continue;
        // Pushed a little sideways so two zombies meeting head-on slide past instead of locking.
        const angle = (gap > 1e-6 ? Math.atan2(b.y - a.y, b.x - a.x) : i + j) + 0.5;
        if (!a.frozenLeft)
          translate(
            a,
            (-Math.cos(angle) * (20 - gap)) / 2,
            (-Math.sin(angle) * (20 - gap)) / 2,
            this.terrain,
          );
        if (!b.frozenLeft)
          translate(
            b,
            (Math.cos(angle) * (20 - gap)) / 2,
            (Math.sin(angle) * (20 - gap)) / 2,
            this.terrain,
          );
      }
    for (const z of s.zombies)
      if (z.kind === 'thrall' && z.hp <= 0 && !z.summoner) {
        const owner = s.players.find((p) => p.id === z.owner);
        if (owner) owner.thrallCd = RULES.thrallCooldown;
      }
    for (const z of s.zombies) {
      if (z.hp > 0 || z.role !== 'guard' || z.execution === null || z.summoner) continue;
      if (z.kind !== 'brute' && z.kind !== 'sword') continue;
      const owner = s.players.find((p) => p.id === z.owner);
      if (!owner) continue;
      const queue = this.fallen.get(owner.id) ?? [];
      if (queue.length < RULES.fallenMax) queue.push(z.execution);
      this.fallen.set(owner.id, queue);
      owner.fallenGuards = queue.length;
    }
    s.zombies = s.zombies.filter((z) => z.hp > 0 && z.life > 0);
    for (const id of this.paths.keys())
      if (!s.zombies.some((z) => z.id === id)) this.paths.delete(id);
    for (const p of s.players) {
      p.hatAlive = s.zombies.some((z) => z.owner === p.id && z.kind === 'hat' && !z.summoner);
      p.thrallAlive = s.zombies.some((z) => z.owner === p.id && z.kind === 'thrall' && !z.summoner);
    }
    for (const key of this.packBearings.keys())
      if (!this.packSeen.has(key)) this.packBearings.delete(key);
    this.packSeen.clear();
    for (const p of s.players) p.activeExecutions = this.activeExecutions(p.id);
  }
  private pveDamage(source: Player, amount: number) {
    return amount * (1 + (source.pve?.damage ?? 0)) * (1 + (source.pve?.classRanks[source.classId] ?? 0) * .06);
  }
  damageMob(mob: Mob, source: Player, amount = 1, freeze = 0) {
    if (mob.hp <= 0 || mob.spawnLeft > 0) return false;
    const dealt = Math.min(mob.hp, this.pveDamage(source, amount));
    mob.hp = Math.max(0, mob.hp - dealt);
    mob.revealLeft = 1.5;
    if (freeze > 0) mob.frozenLeft = Math.max(mob.frozenLeft, freeze);
    source.pveDamage += dealt;
    if (this.state.pve) this.state.pve.damage[source.id] = (this.state.pve.damage[source.id] ?? 0) + dealt;
    this.event('hit', mob, source.team);
    if (mob.hp <= 0) {
      source.pveKills++;
      if (this.state.pve) this.state.pve.kills[source.id] = (this.state.pve.kills[source.id] ?? 0) + 1;
      this.event('death', mob, source.team);
    }
    return true;
  }
  private mobCanSee(mob: Mob, target: Player) {
    if (!target.bushId || target.revealLeft > 0) return true;
    return mob.bushId === target.bushId && distance(mob, target) <= 90 && lineClear(mob, target, this.terrain);
  }
  private hitPlayerFromMob(target: Player, mob: Mob, angle: number, raw: number) {
    if (target.hp <= 0 || target.invuln > 0 || target.dashInvulnerable) return false;
    if (target.counterLeft > 0) {
      const boost = target.counterCharge >= RULES.counterChargeTime - 1e-8 ? RULES.counterBoost : 1;
      this.damageMob(mob, target, raw * boost);
      this.event('counter', target, target.team, target.angle, target.classId, boost > 1 ? 1 : 0);
      return false;
    }
    if (target.classId === 'mage' && target.magicShieldHits > 0) {
      target.magicShieldHits--;
      if (!target.magicShieldHits) target.magicShieldCd = RULES.magicShieldCooldown;
      this.event('block', target, target.team, target.angle, target.classId);
      return false;
    }
    const relative=angle+Math.PI-target.angle;
    if (target.guarding && Math.abs(wrapAngle(relative)) <= RULES.guardArc/2) {
      this.event('block',target,target.team,target.angle,target.classId); return false;
    }
    const amount=raw*(1-(target.pve?.resistance??0));
    target.hp=Math.max(0,target.hp-amount);
    target.invuln=RULES.hurtProtection; target.hitFlash=.18; target.revealLeft=1.5;
    target.shotCharge=0; target.specialCharge=0; target.trapLeft=0;
    this.event('hit',target,'red');
    if (target.hp<=0) {
      target.deaths++; target.windup=0; target.dashLeft=0; target.dashInvulnerable=false;
      target.furyLeft=0; target.raiseCast=0; lowerGuard(target);
      if (target.pve.selfRevives>0) { target.pve.selfRevives--; target.respawnLeft=2; target.eliminated=false; }
      else { target.respawnLeft=0; target.eliminated=true; }
      this.event('death',target,target.team);
    } else translate(target,Math.cos(angle)*16,Math.sin(angle)*16,this.terrain);
    return true;
  }
  private pveOfferRewards() {
    const s=this.state,pve=s.pve;if(!pve)return;
    s.phase='rewards'; pve.rewardLeft=10; pve.chosen=[]; this.pveOffers.clear();
    for (const p of s.players) {
      p.windup = 0; p.dashLeft = 0; p.dashInvulnerable = false; p.shotCharge = 0;
      p.specialCharge = 0; p.trapLeft = 0; p.raiseCast = 0; p.counterLeft = 0;
      lowerGuard(p);
    }
    const alive=s.players.filter(p=>p.hp>0&&!p.eliminated), dead=s.players.filter(p=>p.eliminated);
    const forced=dead.length&&alive.length?alive[Math.floor(Math.random()*alive.length)]?.id:undefined;
    const targets=dead.map(p=>({id:p.id,name:p.name}));
    for(const p of alive){
      const offer:UpgradeOffer={id:`${pve.wave}:${p.id}:${s.tick}`,wave:pve.wave,deadline:Date.now()+10000,choices:makeUpgradeChoices(p.classId,p.pve,pve.wave,Math.random,targets,p.id===forced)};
      this.pveOffers.set(p.id,offer);
    }
  }
  getUpgradeOffer(id:string){return this.pveOffers.get(id);}
  selectUpgrade(id:string,offerId:unknown,key:unknown,targetId?:unknown){
    const s=this.state,p=s.players.find(q=>q.id===id),offer=this.pveOffers.get(id);
    if(!p||!offer||s.phase!=='rewards'||offer.id!==offerId||typeof key!=='string')return false;
    const choice=offer.choices.find(c=>c.key===key);if(!choice)return false;
    const u=p.pve,stack=(u.stacks[choice.id]??0)+1;
    if(choice.id==='reviveAlly'){
      if(typeof targetId!=='string'||!choice.reviveTargets?.some(t=>t.id===targetId))return false;
      const target=s.players.find(q=>q.id===targetId&&q.eliminated);if(!target)return false;
      target.eliminated=false;this.revive(target,RULES.spawnProtection);target.hp=target.maxHp*.5;
    } else if(choice.id==='power')u.damage=Math.min(1,u.damage+choice.value);
    else if(choice.id==='vitality'){
      const old=p.maxHp;u.maxHpBonus=Math.min(.75,u.maxHpBonus+choice.value);p.maxHp=CLASSES[p.classId].hp*(1+u.maxHpBonus);p.hp=Math.min(p.maxHp,p.hp+p.maxHp-old);
    } else if(choice.id==='haste')u.cooldownReduction=Math.min(.4,u.cooldownReduction+choice.value);
    else if(choice.id==='speed')u.speed=Math.min(.25,u.speed+choice.value);
    else if(choice.id==='resistance')u.resistance=Math.min(.35,u.resistance+choice.value);
    else if(choice.id==='regeneration'){u.regenRank=Math.min(3,u.regenRank+1);u.regenLeft=0;}
    else if(choice.id==='secondChance')u.selfRevives=1;
    else u.classRanks[p.classId]=Math.min(3,(u.classRanks[p.classId]??0)+1);
    u.stacks[choice.id]=stack;this.pveOffers.delete(id);s.pve!.chosen.push(id);this.event('upgrade',p,p.team);return true;
  }
  startPve() {
    const s=this.state;if(s.mode!=='pve'||!['lobby','finished'].includes(s.phase)||!s.players.length||!s.players.every(p=>p.ready&&p.connected))return false;
    s.pve={objective:'elimination',wave:0,initialPartySize:s.players.length,pendingBudget:0,spawnedAll:false,enemiesRemaining:0,rewardLeft:0,chosen:[],completed:false,endless:false,bossActive:false,kills:{},damage:{}};
    s.winner=null;s.reason='';s.timeLeft=0;s.phase='countdown';s.phaseLeft=RULES.countdown;s.flags=[];s.bases=[];s.arrows=[];s.zombies=[];s.mobs=[];s.mobProjectiles=[];this.pveOffers.clear();
    for(const p of s.players){p.pve=emptyUpgrades();p.pveKills=0;p.pveDamage=0;p.deaths=0;p.eliminated=false;p.ready=false;this.revive(p);}
    this.syncParticipants();return true;
  }
  continuePve(){const s=this.state;if(s.mode!=='pve'||s.phase!=='finished'||!s.pve?.completed)return false;s.winner=null;s.reason='';s.pve.endless=true;this.pveOfferRewards();return true;}
  private beginPveWave(wave:number){
    const s=this.state,pve=s.pve;if(!pve)return;s.phase='playing';pve.wave=wave;pve.rewardLeft=0;pve.chosen=[];pve.spawnedAll=false;pve.bossActive=wave>=10&&wave%5===0;pve.pendingBudget=pve.bossActive?Math.round(waveBudget(wave,pve.initialPartySize)*.35):waveBudget(wave,pve.initialPartySize);s.mobs=[];s.mobProjectiles=[];this.pveSpawnClock=0;this.pveOffers.clear();
    if(pve.bossActive)this.spawnPveMob('cryptGuardian');this.event('wave',{x:RULES.width/2,y:RULES.height/2},'blue',undefined,undefined,wave);
  }
  private spawnPveMob(kind:MobKind){
    const s=this.state,pve=s.pve;if(!pve)return;const stats=MOB_STATS[kind],scale=1+.1*Math.max(0,pve.wave-1),elite=kind!=='cryptGuardian'&&pve.wave>=5&&Math.random()<.15;
    const living=s.players.filter(p=>p.hp>0);const spots=kind==='cryptGuardian'?[this.map.pveBossSpawn]:this.map.pveSpawns;const available=spots.filter(at=>living.every(p=>distance(at,p)>=180)&&!blocked(at.x,at.y,kind==='cryptGuardian'?22:12,this.terrain));const at=(available.length?available:spots).reduce((best,point)=>Math.min(...living.map(p=>distance(point,p)),Infinity)>Math.min(...living.map(p=>distance(best,p)),Infinity)?point:best,spots[0]);
    const bossScale=kind==='cryptGuardian'?(1+.65*(pve.initialPartySize-1)):1,maxHp=stats.hp*scale*bossScale*(elite?1.6:1);
    s.mobs.push({id:`m${++this.mobId}`,kind,x:at.x,y:at.y,hp:maxHp,maxHp,angle:0,speed:stats.speed*(1+Math.min(.15,.015*Math.max(0,pve.wave-1))),damage:stats.damage*scale,attackCd:.5,specialCd:kind==='wolf'?2:kind==='cryptGuardian'?4:0,windup:0,spawnLeft:.8,frozenLeft:0,target:null,elite,boss:kind==='cryptGuardian',bushId:null,revealLeft:0});
  }
  private choosePveKind(){
    const pve=this.state.pve!,list=availableMobs(pve.wave).filter(k=>MOB_STATS[k].cost<=pve.pendingBudget+.01);if(!list.length)return null;return list[Math.floor(Math.random()*list.length)];
  }
  private walkPveMob(mob:Mob,goal:Vec,dt:number){
    const radius=mob.boss?22:mob.kind==='brute'?16:12;let aim=goal;
    if(bodyClear(mob,goal,radius-1,this.terrain))this.paths.delete(mob.id);
    else{let route=this.paths.get(mob.id);if(!route?.points.length||distance(route.goal,goal)>40)route={goal:{x:goal.x,y:goal.y},points:findPath(mob,goal,new Set(),this.terrain)},this.paths.set(mob.id,route);while(route.points.length>1&&bodyClear(mob,route.points[1],radius-1,this.terrain))route.points.shift();if(route.points.length&&distance(mob,route.points[0])<4)route.points.shift();aim=route.points[0]??goal;}
    const gap=distance(mob,aim);if(gap<1e-6)return;const angle=Math.atan2(aim.y-mob.y,aim.x-mob.x);mob.angle=angle;const stride=Math.min(gap,mob.speed*dt);translate(mob,Math.cos(angle)*stride,Math.sin(angle)*stride,this.terrain);
  }
  private stepPveWorld(dt:number){
    const s=this.state,pve=s.pve;if(!pve)return;
    this.pveSpawnClock-=dt;
    if(pve.pendingBudget>0&&s.mobs.filter(m=>m.hp>0).length<24&&this.pveSpawnClock<=0){const kind=this.choosePveKind();if(kind){this.spawnPveMob(kind);pve.pendingBudget=Math.max(0,pve.pendingBudget-MOB_STATS[kind].cost);this.pveSpawnClock=.65;}else pve.pendingBudget=0;}
    pve.spawnedAll=pve.pendingBudget<=.01;
    for(const mob of s.mobs){
      if(mob.hp<=0)continue;mob.spawnLeft=Math.max(0,mob.spawnLeft-dt);mob.attackCd=Math.max(0,mob.attackCd-dt);mob.specialCd=Math.max(0,mob.specialCd-dt);mob.revealLeft=Math.max(0,mob.revealLeft-dt);mob.bushId=pointBush(this.map,mob);if(mob.spawnLeft>0)continue;
      if(mob.frozenLeft>0){mob.frozenLeft=Math.max(0,mob.frozenLeft-dt);continue;}
      const players=s.players.filter(p=>p.hp>0&&this.mobCanSee(mob,p));const allies=s.zombies.filter(z=>z.hp>0);const candidates=[...players.map(entity=>({entity,player:true})),...allies.map(entity=>({entity,player:false}))];const chosen=candidates.sort((a,b)=>distance(mob,a.entity)-distance(mob,b.entity))[0];if(!chosen){mob.target=null;continue;}const target=chosen.entity;mob.target=target.id;const gap=distance(mob,target);mob.angle=Math.atan2(target.y-mob.y,target.x-mob.x);
      if(mob.kind==='skeleton'){
        if(gap<=280&&lineClear(mob,target,this.terrain)&&mob.attackCd<=0){mob.attackCd=MOB_STATS.skeleton.cooldown;s.mobProjectiles.push({id:++this.mobProjectileId,owner:mob.id,x:mob.x,y:mob.y,angle:mob.angle,speed:280,damage:mob.damage,life:1.5,radius:5});this.event('mobAttack',mob,'red',mob.angle);}
        const dir=gap<170?-1:gap>245?1:0;if(dir>0)this.walkPveMob(mob,target,dt);else if(dir<0)translate(mob,-Math.cos(mob.angle)*mob.speed*dt,-Math.sin(mob.angle)*mob.speed*dt,this.terrain);continue;
      }
      if(mob.kind==='cryptGuardian'&&mob.specialCd<=0){mob.specialCd=5;if(s.mobs.filter(m=>m.hp>0).length<22){this.spawnPveMob('zombie');this.spawnPveMob(pve.wave>=10?'skeleton':'wolf');}for(const p of players)if(distance(mob,p)<=115)this.hitPlayerFromMob(p,mob,Math.atan2(p.y-mob.y,p.x-mob.x),mob.damage);for(const z of allies)if(distance(mob,z)<=115)this.damageZombie(z,'red',mob.damage);this.event('mobAttack',mob,'red',mob.angle,undefined,2);}
      if(mob.kind==='wolf'&&mob.specialCd<=0&&gap<180&&gap>45){mob.specialCd=3;translate(mob,Math.cos(mob.angle)*Math.min(120,gap-18),Math.sin(mob.angle)*Math.min(120,gap-18),this.terrain);}
      const reach=MOB_STATS[mob.kind].range;
      if(mob.windup>0){mob.windup=Math.max(0,mob.windup-dt);if(mob.windup<=0){const area=mob.kind==='brute'||mob.kind==='cryptGuardian';if(area){for(const q of players)if(distance(mob,q)<=reach+12&&lineClear(mob,q,this.terrain))this.hitPlayerFromMob(q,mob,Math.atan2(q.y-mob.y,q.x-mob.x),mob.damage);for(const q of allies)if(distance(mob,q)<=reach+12&&lineClear(mob,q,this.terrain))this.damageZombie(q,'red',mob.damage,Math.atan2(q.y-mob.y,q.x-mob.x));}else if(distance(mob,target)<=reach+12&&lineClear(mob,target,this.terrain)){if(chosen.player)this.hitPlayerFromMob(target as Player,mob,mob.angle,mob.damage);else this.damageZombie(target as Zombie,'red',mob.damage,mob.angle);}mob.attackCd=MOB_STATS[mob.kind].cooldown;this.event('mobAttack',mob,'red',mob.angle);}continue;}
      if(gap<=reach&&mob.attackCd<=0){mob.windup=mob.kind==='brute'?.55:mob.kind==='cryptGuardian'?.4:.2;continue;}
      if(gap>reach*.8)this.walkPveMob(mob,target,dt);
    }
    s.mobProjectiles=s.mobProjectiles.filter(a=>{a.life-=dt;if(a.life<=0)return false;const steps=Math.max(1,Math.ceil(a.speed*dt/5));for(let i=0;i<steps;i++){a.x+=Math.cos(a.angle)*a.speed*dt/steps;a.y+=Math.sin(a.angle)*a.speed*dt/steps;if(blocked(a.x,a.y,a.radius,this.terrain))return false;const mob=s.mobs.find(m=>m.id===a.owner);if(!mob)return false;const p=s.players.find(q=>q.hp>0&&distance(q,a)<RULES.radius+a.radius);if(p){this.hitPlayerFromMob(p,mob,a.angle,a.damage);return false;}const z=s.zombies.find(q=>q.hp>0&&distance(q,a)<RULES.zombieRadius+a.radius);if(z){this.damageZombie(z,'red',a.damage,a.angle);return false;}}return true;});
    s.mobs=s.mobs.filter(m=>m.hp>0);for(const id of this.paths.keys())if(id.startsWith('m')&&!s.mobs.some(m=>m.id===id))this.paths.delete(id);pve.enemiesRemaining=s.mobs.length+Math.ceil(pve.pendingBudget);
    const survivors=s.players.some(p=>p.hp>0||(!p.eliminated&&p.respawnLeft>0));if(!survivors){this.finish('draw','pveDefeat');return;}
    if(pve.spawnedAll&&!s.mobs.length){s.mobProjectiles=[];if(pve.wave===10&&!pve.endless){pve.completed=true;this.finish('blue','pveVictory');}else this.pveOfferRewards();}
  }
  step(inputs: Map<string, Input>, dt = RULES.tick as number) {
    const s = this.state;
    s.tick++;
    if (s.paused || s.phase === 'lobby' || s.phase === 'finished') return;
    if (s.phase === 'rewards') {
      for (const p of s.players) {
        if (p.hp <= 0 || p.eliminated || !p.connected) continue;
        const input = movementInput(inputs.get(p.id) ?? idleInput(p.ack, p.angle));
        p.ack = Math.max(p.ack, input.seq);
        p.revealLeft = Math.max(0, p.revealLeft - dt);
        movePlayer(p, input, false, dt, this.terrainFor(p));
        p.bushId = pointBush(this.map, p);
      }
      if(s.pve){s.pve.rewardLeft=Math.max(0,s.pve.rewardLeft-dt);if(s.pve.rewardLeft<=1e-8)this.beginPveWave(s.pve.wave+1);}
      this.syncParticipants();
      return;
    }
    if (s.phase === 'countdown' || s.phase === 'capture') {
      s.phaseLeft = Math.max(0, s.phaseLeft - dt);
      if (s.phaseLeft <= 0) { if(s.mode==='pve')this.beginPveWave(1); else s.phase = 'playing'; }
      return;
    }
    if(s.mode!=='pve') s.timeLeft = Math.max(0, s.timeLeft - dt);
    if (s.mode!=='pve' && s.timeLeft <= 0) {
      const teams = [...new Set(s.players.filter((p) => !p.eliminated).map((p) => p.team))];
      const best = Math.max(...teams.map((t) => s.score[t]));
      const leaders = teams.filter((t) => s.score[t] === best);
      this.finish(leaders.length === 1 ? leaders[0] : 'draw', 'tiempo');
      return;
    }
    const placements = this.stepPlayers(inputs, dt);
    if (s.winner) {
      this.syncParticipants();
      return;
    }
    this.stepArrows(dt);
    this.stepZombies(dt);
    this.stepBlackHoles(dt);
    this.stepTraps(placements, dt);
    if (s.winner) {
      this.syncParticipants();
      return;
    }
    for (const p of s.players) p.activeTraps = s.traps.filter((t) => t.owner === p.id).length;
    if(s.mode==='pve'){this.stepPveWorld(dt);this.syncParticipants();return;}
    // Own-flag returns precede enemy pickups and scoring, independent of player iteration order.
    for (const f of s.flags) {
      f.lockLeft = Math.max(0, f.lockLeft - dt);
      if (f.status === 'dropped') {
        f.returnLeft -= dt;
        if (
          f.returnLeft <= 0 ||
          s.players.some((p) => p.team === f.team && p.hp > 0 && distance(p, f) < 25)
        )
          this.returnFlag(f);
      }
    }
    for (const f of s.flags) {
      if (f.status !== 'carried') {
        const p = s.players.find(
          (p) =>
            p.team !== f.team &&
            p.hp > 0 &&
            !s.flags.some((other) => other.carrier === p.id) &&
            distance(p, f) < 25 &&
            !(f.blockedId === p.id && f.lockLeft > 0),
        );
        if (p) {
          f.status = 'carried';
          f.carrier = p.id;
          p.invuln = 0;
          this.event('pickup', p, p.team);
        }
      }
      const carrier = s.players.find((p) => p.id === f.carrier);
      if (carrier) {
        f.x = carrier.x;
        f.y = carrier.y;
      }
    }
    for (const p of s.players) {
      if (
        p.hp > 0 &&
        s.flags.some((f) => f.carrier === p.id) &&
        s.flags.find((f) => f.team === p.team)?.status === 'home' &&
        distance(p, this.base(p.team).home) < 38
      ) {
        s.score[p.team]++;
        this.event('capture', p, p.team);
        this.resetArena();
        if (s.score[p.team] >= RULES.target) this.finish(p.team, 'capturas');
        else {
          s.phase = 'capture';
          s.phaseLeft = RULES.capturePause;
        }
        break;
      }
    }
    this.syncParticipants();
  }
  /** Defenses, movement and attack preparation, then the impacts they produce. Returns the
   *  players who placed a trap this tick, which `stepTraps` needs further down the step. */
  protected stepPlayers(inputs: Map<string, Input>, dt: number): Player[] {
    const s = this.state;
    const swings: Player[] = [];
    const placements: Player[] = [];
    const bashers: Player[] = [];
    const guardianDashers: Player[] = [];
    // First advance every player's defenses, movement and attack preparation.
    // Only then resolve impacts, so the order of joining never defeats a guard.
    for (const p of s.players) {
      const input = inputs.get(p.id) || idleInput(p.ack, p.angle);
      p.ack = Math.max(p.ack, input.seq);
      p.revealLeft = Math.max(0, p.revealLeft - dt);
      p.bushId = pointBush(this.map, p);
      if (p.hp <= 0) {
        if (s.mode==='pve') { if(!p.eliminated&&p.respawnLeft>0){p.respawnLeft-=dt;if(p.respawnLeft<=0){this.revive(p,RULES.spawnProtection);p.hp=p.maxHp*.4;}} continue; }
        if (p.eliminated) continue;
        p.respawnLeft -= dt;
        if (p.respawnLeft <= 0) this.revive(p, RULES.spawnProtection);
        continue;
      }
      if (equippedSkill(p, 'necromancer.summon') && (input.command || input.mark)) this.commandZombies(p, input);
      const resolvedInput = resolveSlotInput(p, input);
      const action = movePlayer(
        p,
        resolvedInput,
        s.flags.some((f) => f.carrier === p.id),
        dt,
        this.terrainFor(p),
      );
      p.bushId = pointBush(this.map, p);
      if (
        (input.sword && p.windup > 0) ||
        action.swing ||
        action.shoot ||
        action.volley ||
        action.ice ||
        action.summon ||
        action.raised ||
        action.bash ||
        action.fury ||
        action.dashStarted ||
        action.blink
        || action.blackHole
      )
        p.revealLeft = 1.5;
      if (action.fury) this.event('fury', p, p.team, p.angle, p.classId);
      if (action.dashStarted && p.classId === 'guardian') {
        this.guardianDashHits.set(p.id, new Set());
        this.event('dash', p, p.team, p.angle, p.classId);
      }
      if (action.blink) {
        this.event(
          'blink',
          { x: action.blink.fromX, y: action.blink.fromY },
          p.team,
          Math.atan2(action.blink.toY - action.blink.fromY, action.blink.toX - action.blink.fromX),
          p.classId,
          1,
        );
        const ev = this.state.events.at(-1)!;
        ev.tx = action.blink.toX;
        ev.ty = action.blink.toY;
        ev.playerId = p.id;
      }
      if (action.blackHole) this.spawnBlackHole(p, p.blackHoleX, p.blackHoleY);
      if (action.dashing && p.classId === 'guardian') guardianDashers.push(p);
      else if (p.classId === 'guardian' && p.dashLeft <= 0) this.guardianDashHits.delete(p.id);
      if (action.bash) bashers.push(p);
      if (action.swing) swings.push(p);
      if (action.trap) placements.push(p);
      if (action.shoot || action.volley || action.ice || action.slash) {
        const volley = action.volley ? ++this.volleyId : undefined;
        const charged = action.wind || (action.shoot && action.charged);
        const power = action.volley ? action.volleyPower : action.power;
        const skillId = action.ice ? 'mage.ice' : action.slash ? 'vanguard.slash' : action.volley ? 'archer.volley' : action.skillId;
        const stats = projectileSkillStats(skillId, p.classId, charged, power);
        const aim = action.angle;
        // Volley arrows leave side by side and open up slowly: point blank (the archer's risky jump into
        // a rival's face) all three land, farther away they spread across a line of rivals.
        for (const side of action.volley ? [-1, 0, 1] : [0]) {
          const gap = side * RULES.volleyGap;
          s.arrows.push({
            id: ++this.arrowId,
            owner: p.id,
            team: p.team,
            classId: p.classId,
            skillId,
            ice: action.ice,
            x: p.x - Math.sin(aim) * gap,
            y: p.y + Math.cos(aim) * gap,
            angle: aim + side * RULES.volleyAngle,
            charged,
            power,
            // A wind arrow crosses the whole arena.
            life: action.wind ? RULES.projectileCrossing / stats.speed : stats.life,
            ...(volley !== undefined || action.wind ? { hits: [], volley } : {}),
            ...(action.wind
              ? { wind: true, damageScale: action.volley ? RULES.windVolleyScale : RULES.windScale }
              : {}),
            ...(action.slash ? { slash: true, hits: [] } : {}),
          });
        }
        this.event(
          action.wind ? 'wind' : action.slash ? 'slash' : 'shot',
          p,
          p.team,
          aim,
          p.classId,
          action.power,
          skillId,
        );
      }
      if (action.raised) this.finishRaise(p);
      if (action.summon) this.summon(p, action.special);
    }
    for (const p of guardianDashers) {
      const struck = this.guardianDashHits.get(p.id) ?? new Set<string>();
      this.guardianDashHits.set(p.id, struck);
      for (const q of s.players) {
        if (
          !this.hostile(p, q) ||
          q.hp <= 0 ||
          struck.has(q.id) ||
          distance(p, q) > RULES.radius * 2 + 4
        )
          continue;
        struck.add(q.id);
        if (this.damage(q, p, Math.atan2(q.y - p.y, q.x - p.x), RULES.guardianDashDamage))
          this.event('dash', q, p.team, p.angle, p.classId, 1);
      }
      for (const z of s.zombies) {
        if (
          !this.hostile(p, z) ||
          z.hp <= 0 ||
          struck.has(z.id) ||
          distance(p, z) > RULES.radius + RULES.zombieRadius + 4
        )
          continue;
        struck.add(z.id);
        this.damageZombie(z, p.team, RULES.guardianDashDamage, undefined, p.id);
        this.event('dash', z, p.team, p.angle, p.classId, 1);
      }
      for (const mob of s.mobs) {
        if (
          mob.hp <= 0 ||
          mob.spawnLeft > 0 ||
          struck.has(mob.id) ||
          distance(p, mob) > RULES.radius + MOB_STATS[mob.kind].radius + 4
        ) continue;
        struck.add(mob.id);
        this.damageMob(mob, p, RULES.guardianDashDamage);
        this.event('dash', mob, p.team, p.angle, p.classId, 1);
      }
    }
    for (const p of bashers) {
      this.event('bash', p, p.team, p.shieldBashAngle, p.classId);
      const candidates = [
        ...s.players
          .filter((q) => this.hostile(p, q) && q.hp > 0)
          .map((q) => ({ kind: 'player' as const, entity: q, radius: 0 })),
        ...s.zombies
          .filter((z) => this.hostile(p, z) && z.hp > 0)
          .map((z) => ({ kind: 'zombie' as const, entity: z, radius: 0 })),
        ...s.mobs
          .filter((mob) => mob.hp > 0 && mob.spawnLeft <= 0)
          .map((mob) => ({ kind: 'mob' as const, entity: mob, radius: MOB_STATS[mob.kind].radius })),
      ]
        .filter(({ entity, radius }) => {
          const angle = Math.atan2(entity.y - p.y, entity.x - p.x);
          const diff = wrapAngle(angle - p.shieldBashAngle);
          return (
            distance(p, entity) <= RULES.shieldBashRange + radius &&
            Math.abs(diff) <= RULES.shieldBashArc / 2 &&
            lineClear(p, entity, this.terrain)
          );
        })
        .sort((a, b) => distance(p, a.entity) - distance(p, b.entity));
      const hit = candidates[0];
      if (!hit) continue;
      const angle = Math.atan2(hit.entity.y - p.y, hit.entity.x - p.x);
      if (hit.kind === 'player') {
        if (this.damage(hit.entity, p, angle, RULES.shieldBashDamage)) {
          if (
            (hit.entity.classId === 'guardian' && hit.entity.guarding) ||
            (hit.entity.classId === 'vanguard' && hit.entity.counterLeft > 0)
          )
            continue;
          hit.entity.stunLeft = RULES.shieldBashStun;
          hit.entity.guardStunExempt = false;
          hit.entity.windup = 0;
          hit.entity.shotCharge = 0;
          hit.entity.specialCharge = 0;
          hit.entity.dashLeft = 0;
          hit.entity.dashInvulnerable = false;
          lowerGuard(hit.entity);
        }
      } else if (hit.kind === 'zombie') {
        this.damageZombie(hit.entity, p.team, RULES.shieldBashDamage, undefined, p.id);
        hit.entity.frozenLeft = Math.max(hit.entity.frozenLeft, RULES.shieldBashStun);
      } else {
        this.damageMob(hit.entity, p, RULES.shieldBashDamage, RULES.shieldBashStun);
      }
    }
    const hits: { target: Player; source: Player; angle: number; amount: number }[] = [];
    for (const p of swings) {
      const stats = this.meleeStats(p);
      const power = p.swingPower,
        range = stats.meleeRange * (1 + 0.3 * power),
        arc = stats.meleeArc * (1 + 0.2 * power),
        amount =
          stats.meleeDamage *
          (1 + power * ((MELEE_OVERCHARGE[p.classId] ?? 1) - 1)) *
          (p.classId === 'guardian' && p.furyLeft > 0 ? RULES.furyDamage : 1);
      p.swingPower = 0;
      this.event('sword', p, p.team, p.swingAngle, p.classId, power);
      for (const q of s.players) {
        const angle = Math.atan2(q.y - p.y, q.x - p.x);
        const diff = Math.atan2(Math.sin(angle - p.swingAngle), Math.cos(angle - p.swingAngle));
        if (
          this.hostile(p, q) &&
          q.hp > 0 &&
          distance(p, q) <= range &&
          Math.abs(diff) <= arc / 2 &&
          lineClear(p, q, this.terrain)
        )
          hits.push({ target: q, source: p, angle, amount });
      }
      for (const z of s.zombies) {
        const angle = Math.atan2(z.y - p.y, z.x - p.x);
        const diff = Math.atan2(Math.sin(angle - p.swingAngle), Math.cos(angle - p.swingAngle));
        if (
          this.hostile(p, z) &&
          z.hp > 0 &&
          distance(p, z) <= range &&
          Math.abs(diff) <= arc / 2 &&
          lineClear(p, z, this.terrain)
        )
          this.damageZombie(z, p.team, amount, undefined, p.id);
      }
      for (const mob of s.mobs) {
        const angle = Math.atan2(mob.y - p.y, mob.x - p.x);
        const diff = Math.atan2(Math.sin(angle - p.swingAngle), Math.cos(angle - p.swingAngle));
        if (
          mob.hp > 0 &&
          mob.spawnLeft <= 0 &&
          distance(p, mob) <= range + MOB_STATS[mob.kind].radius &&
          Math.abs(diff) <= arc / 2 &&
          lineClear(p, mob, this.terrain)
        ) this.damageMob(mob, p, amount);
      }
    }
    for (const hit of hits) this.damage(hit.target, hit.source, hit.angle, hit.amount);
    return placements;
  }
  /** Projectile flight and everything they hit. */
  protected stepArrows(dt: number) {
    const s = this.state;
    s.arrows = s.arrows.filter((a) => {
      const travelTime = Math.min(dt, a.life);
      if (travelTime <= 1e-8) return false;
      a.life = Math.max(0, a.life - dt);
      let owner = s.players.find((p) => p.id === a.owner);
      if (!owner) return false;
      const { stats, speed, radius } = arrowMotion(a);
      let amount = stats.damage * (a.damageScale ?? 1);
      const steps = Math.max(1, Math.ceil((speed * travelTime) / 5));
      for (let i = 0; i < steps; i++) {
        a.x += (Math.cos(a.angle) * speed * travelTime) / steps;
        a.y += (Math.sin(a.angle) * speed * travelTime) / steps;
        if (blocked(a.x, a.y, 3, this.terrain)) {
          this.explode(a, owner, amount);
          return false;
        }
        const target = s.players.find(
          (p) =>
            this.hostile(a, p) &&
            p.hp > 0 &&
            distance(p, a) < RULES.radius + radius &&
            !a.hits?.includes(p.id),
        );
        if (target && target.counterLeft > 0) {
          // Full counter: the projectile flies back as the warrior's; charged, twice as fast and hard.
          const boosted = target.counterCharge >= RULES.counterChargeTime - 1e-8;
          owner = target;
          a.owner = target.id;
          a.team = target.team;
          a.angle += Math.PI;
          a.reflected = boosted ? 2 : 1;
          if (boosted) {
            a.damageScale = (a.damageScale ?? 1) * RULES.counterBoost;
            amount *= RULES.counterBoost;
          }
          a.life = stats.life;
          if (a.hits) a.hits = [];
          a.volley = undefined;
          this.event('counter', target, target.team, a.angle, target.classId, boosted ? 1 : 0);
          continue;
        }
        if (target && (a.slash || a.blast)) {
          // The travelling slash and the zombie mage's fireball go through every rival in their path, once each.
          a.hits!.push(target.id);
          this.damage(target, owner, a.angle, amount);
          continue;
        }
        if (target && this.volleyPasses(a, target.id)) continue;
        if (target && a.wind) {
          // Wind pierces and breaks shields; the arrows of a wind volley all land on the same rival.
          const sibling = this.volleyHits.has(`${a.volley}:${target.id}`);
          a.hits!.push(target.id);
          this.markVolley(a, target.id);
          this.damage(target, owner, a.angle, amount, { pierce: true, ignoreInvuln: sibling });
          continue;
        }
        if (target) {
          this.markVolley(a, target.id);
          if (
            this.damage(target, owner, a.angle, a.ice ? 0 : amount, { freeze: a.ice }) &&
            a.element === 'ice'
          )
            this.freeze(target);
          this.explode(a, owner, amount, target.id);
          return false;
        }
        const zombie = s.zombies.find(
          (z) =>
            this.hostile(a, z) &&
            z.hp > 0 &&
            distance(z, a) < RULES.zombieRadius + radius &&
            !a.hits?.includes(z.id),
        );
        if (zombie && zombie.counterLeft > 0) {
          // A revived warrior's counter sends the shot back as its necromancer's.
          const master = s.players.find((p) => p.id === zombie.owner);
          if (master) {
            owner = master;
            a.owner = master.id;
            a.team = zombie.team;
            a.angle += Math.PI;
            a.reflected = 1;
            a.life = stats.life;
            if (a.hits) a.hits = [];
            a.volley = undefined;
            this.event('counter', zombie, zombie.team, a.angle, zombie.classId, 0);
            continue;
          }
        }
        if (zombie && this.volleyPasses(a, zombie.id)) continue;
        if (zombie) {
          this.markVolley(a, zombie.id);
          if (a.ice) zombie.frozenLeft = RULES.freezeDuration;
          else this.damageZombie(zombie, a.team, amount, a.angle, owner.id);
          if (a.wind || a.slash || a.blast) {
            a.hits!.push(zombie.id);
            continue;
          }
          if (a.element === 'ice') {
            zombie.frozenLeft = RULES.freeze;
            this.event('freeze', zombie, zombie.team);
          }
          this.explode(a, owner, amount, zombie.id);
          return false;
        }
        const mob = s.mobs.find(
          (candidate) =>
            candidate.hp > 0 &&
            candidate.spawnLeft <= 0 &&
            distance(candidate, a) < MOB_STATS[candidate.kind].radius + radius &&
            !a.hits?.includes(candidate.id),
        );
        if (mob && this.volleyPasses(a, mob.id)) continue;
        if (mob) {
          this.markVolley(a, mob.id);
          const freeze = a.ice ? RULES.freezeDuration : a.element === 'ice' ? RULES.freeze : 0;
          this.damageMob(mob, owner, a.ice ? 0 : amount, freeze);
          if (freeze > 0) this.event('freeze', mob, 'red');
          if (a.wind || a.slash || a.blast) {
            a.hits!.push(mob.id);
            continue;
          }
          this.explode(a, owner, amount, mob.id);
          return false;
        }
      }
      return true;
    });
    for (const [key, tick] of this.volleyHits) if (s.tick - tick > 60) this.volleyHits.delete(key);
  }
  /** Traps placed this tick, then the arming and triggering of every live trap. */
  protected stepTraps(placements: Player[], dt: number) {
    const s = this.state;
    for (const p of placements) {
      if (p.hp <= 0 || p.hitFlash > 0 || s.winner) continue;
      const owned = s.traps.filter((t) => t.owner === p.id);
      if (owned.length >= RULES.trapMax) s.traps = s.traps.filter((t) => t.id !== owned[0].id);
      s.traps.push({
        id: ++this.trapId,
        pveScale: 1 + (p.pve?.classRanks.archer ?? 0) * .12,
        owner: p.id,
        team: p.team,
        x: p.x,
        y: p.y,
        armLeft: RULES.trapArm,
        life: RULES.trapLife,
      });
    }
    s.traps = s.traps.filter((t) => {
      t.life -= dt;
      t.armLeft = Math.max(0, t.armLeft - dt);
      const owner = s.players.find((p) => p.id === t.owner && !p.eliminated);
      if (t.life <= 0 || !owner) return false;
      if (t.armLeft > 1e-8) return true;
      const target = s.players.find(
        (p) =>
          this.hostile(t, p) &&
          p.hp > 0 &&
          distance(p, t) < RULES.trapRadius + RULES.radius &&
          lineClear(p, t, this.terrain),
      );
      const mob = s.mode === 'pve'
        ? s.mobs.find((candidate) => candidate.hp > 0 && candidate.spawnLeft <= 0 && distance(candidate, t) < RULES.trapRadius + MOB_STATS[candidate.kind].radius && lineClear(candidate, t, this.terrain))
        : undefined;
      if (!target && !mob) return true;
      if (mob) {
        this.damageMob(mob, owner, RULES.trapDamage * (t.pveScale ?? 1), RULES.trapStun);
        this.event('freeze', mob, 'red');
        return false;
      }
      if (!target || target.invuln > 0 || target.dashInvulnerable) return true;
      // A floor trap strikes beneath the shield, while normal damage protection still applies.
      this.damage(target, owner, target.angle, RULES.trapDamage);
      if (target.hp > 0) {
        const controlImmune =
          (target.classId === 'guardian' && target.guarding) ||
          (target.classId === 'vanguard' && target.counterLeft > 0);
        if (controlImmune) return false;
        target.stunLeft = RULES.trapStun;
        target.guardStunExempt = target.classId === 'guardian';
        target.windup = 0;
        target.shotCharge = 0;
        target.trapLeft = 0;
        target.dashLeft = 0;
        if (target.classId !== 'guardian') lowerGuard(target);
      }
      return false;
    });
  }
}
