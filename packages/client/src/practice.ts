import { CLASSES, Duel, RULES, defaultCustomization, idleInput, type CharacterCustomization, type ClassId, type Input, type MapId } from '@bandera/shared';

export const PRACTICE_PLAYER = 'practice-player';
export const PRACTICE_DUMMY = 'practice-dummy';

/**
 * What the practice rival does. It never moves from its spot unless it says so, and it comes back
 * where it started every time it falls.
 */
export const SPARRING = {
  still: { label: 'Inmóvil', classId: 'guardian', text: 'No hace nada: para medir alcances y daño.' },
  arrows: { label: 'Dispara flechas', classId: 'archer', text: 'Una flecha cada 1,4 s, para cortarlas o devolverlas.' },
  orbs: { label: 'Lanza orbes cargados', classId: 'mage', text: 'Un orbe de fuego a plena carga cada 2,6 s.' },
  blade: { label: 'Ataca con espada', classId: 'guardian', text: 'Se acerca y encadena cortes.' },
} as const satisfies Record<string, { label: string; classId: ClassId; text: string }>;
export type SparringMode = keyof typeof SPARRING;
export const validSparring = (value: unknown): value is SparringMode =>
  typeof value === 'string' && value in SPARRING;

/** Whole ticks, so a beat never drifts or lands twice. */
const ticks = (seconds: number) => Math.round(seconds / RULES.tick);
const ARROW_EVERY = ticks(1.4);
const ORB_EVERY = ticks(2.6);
/** A charged orb is held this long before it goes. */
const ORB_HOLD = ticks(RULES.overchargeTime + 0.1);
const CUT_EVERY = ticks(0.5);

export class Practice {
  readonly duel: Duel;
  /** Ticks the rival has been sparring, which pace what it does. */
  private clock = 0;
  constructor(
    classId: ClassId,
    name = 'Vos',
    mapId: MapId = 'courtyard',
    customization: CharacterCustomization = defaultCustomization(classId),
    readonly sparring: SparringMode = 'still',
  ) {
    this.duel = new Duel(mapId, 'duel');
    this.duel.add(PRACTICE_PLAYER, name, classId, customization);
    this.duel.add(PRACTICE_DUMMY, 'Rival de práctica', SPARRING[sparring].classId);
    this.duel.state.phase = 'playing';
    this.placeDummy();
  }
  private placeDummy() {
    const dummy = this.duel.state.players[1];
    dummy.x = 760;
    dummy.y = 270;
    dummy.angle = Math.PI;
    // Practice never ends and the target respawns in place.
    dummy.deaths = 0;
    // An orb-throwing rival without its shield: every cut and every counter shows on its health.
    if (this.sparring === 'orbs') dummy.magicShieldHits = 0;
  }
  /** What the rival does this tick: a shot on a beat, or walking in to cut. */
  private dummyInput(): Input {
    const [player, dummy] = this.duel.state.players;
    const input = idleInput(this.duel.state.tick, Math.atan2(player.y - dummy.y, player.x - dummy.x));
    if (dummy.hp <= 0 || player.hp <= 0) return input;
    const click = (state: Partial<Input['slots']['primary']>) => {
      input.slots.primary = { pressed: false, held: false, released: false, ...state };
    };
    if (this.sparring === 'arrows') {
      if (this.clock % ARROW_EVERY === 0) click({ pressed: true, released: true });
    } else if (this.sparring === 'orbs') {
      // Held for the whole charge, then let go.
      const phase = this.clock % ORB_EVERY;
      if (phase < ORB_HOLD) click({ pressed: phase === 0, held: true });
      else if (phase === ORB_HOLD) click({ released: true });
    } else {
      const gap = Math.hypot(player.x - dummy.x, player.y - dummy.y);
      if (gap > 46) {
        // Half pace: it is there to be fought, not to chase anyone down.
        input.x = Math.cos(input.angle) * 0.5;
        input.y = Math.sin(input.angle) * 0.5;
      }
      if (gap < CLASSES.guardian.meleeRange + 10 && this.clock % CUT_EVERY === 0) click({ pressed: true, released: true });
    }
    return input;
  }
  step(input: Input) {
    const dummy = this.duel.state.players[1];
    const wasDead = dummy.hp <= 0;
    this.clock++;
    const inputs = new Map([[PRACTICE_PLAYER, input]]);
    // A still rival gets no input at all: it does not even turn.
    if (this.sparring !== 'still') inputs.set(PRACTICE_DUMMY, this.dummyInput());
    this.duel.step(inputs);
    // The dummy does not walk by itself, but effects such as Singularidad must be able to pull it.
    // Return it to its practice position only when it respawns.
    if (wasDead && dummy.hp > 0) this.placeDummy();
    return structuredClone(this.duel.state);
  }
}
