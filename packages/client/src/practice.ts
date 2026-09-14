import { Duel, type ClassId, type Input } from '@bandera/shared';

export const PRACTICE_PLAYER = 'practice-player';
export class Practice {
  readonly duel = new Duel();
  constructor(classId: ClassId, name = 'Vos') {
    this.duel.add(PRACTICE_PLAYER, name, classId);
    this.duel.add('practice-dummy', 'Rival de práctica', 'guardian');
    this.duel.state.phase = 'playing';
    this.placeDummy();
  }
  private placeDummy() {
    const dummy = this.duel.state.players[1];
    dummy.x = 650;
    dummy.y = 270;
    dummy.angle = Math.PI;
  }
  step(input: Input) {
    this.duel.step(new Map([[PRACTICE_PLAYER, input]]));
    // A stationary target: it takes damage and respawns, but never walks or attacks.
    this.placeDummy();
    return structuredClone(this.duel.state);
  }
}
