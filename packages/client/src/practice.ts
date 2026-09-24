import { Duel, defaultCustomization, type CharacterCustomization, type ClassId, type Input, type MapId } from '@bandera/shared';

export const PRACTICE_PLAYER = 'practice-player';
export class Practice {
  readonly duel: Duel;
  constructor(classId: ClassId, name = 'Vos', mapId: MapId = 'courtyard', customization:CharacterCustomization=defaultCustomization(classId)) {
    this.duel = new Duel(mapId, 'duel');
    this.duel.add(PRACTICE_PLAYER, name, classId,customization);
    this.duel.add('practice-dummy', 'Rival de práctica', 'guardian');
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
  }
  step(input: Input) {
    const dummy = this.duel.state.players[1];
    const wasDead = dummy.hp <= 0;
    this.duel.step(new Map([[PRACTICE_PLAYER, input]]));
    // The dummy does not walk, but effects such as Singularidad must be able to pull it.
    // Return it to its practice position only when it respawns.
    if (wasDead && dummy.hp > 0) this.placeDummy();
    return structuredClone(this.duel.state);
  }
}
