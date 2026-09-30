export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
// E, SE, S, SW, W, NW, N, NE. Body facing is independent of weapon aim.
export function facingFor(dx: number, dy: number): Facing {
  return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8) as Facing;
}
export class Locomotion {
  facing: Facing = 2;
  phase = 0;
  moving = false;
  private x?: number;
  private y = 0;
  private stoppedFor = 0;
  update(x: number, y: number, delta: number, frozen = false, reset = false) {
    const dx = x - (this.x ?? x), dy = y - this.y;
    const distance = Math.hypot(dx, dy);
    if (this.x === undefined || reset || distance > 48 || delta > 250) {
      this.phase = 0; this.moving = false; this.x = x; this.y = y; this.stoppedFor = 0;
      return;
    }
    if (frozen) { this.moving = false; this.x = x; this.y = y; return; }
    if (distance > 0.65) {
      this.facing = facingFor(dx, dy);
      this.phase = (this.phase + distance / 5) % 6;
      this.moving = true; this.stoppedFor = 0;
      this.x = x; this.y = y;
    } else {
      this.stoppedFor += delta;
      if (this.stoppedFor > 90) { this.moving = false; this.phase = 0; this.x = x; this.y = y; }
    }
  }
  frame(time: number, frozen = false) {
    return this.facing * 8 + (this.moving ? 2 + Math.floor(this.phase) : frozen ? 0 : Math.floor(time / 700) % 2);
  }
}
