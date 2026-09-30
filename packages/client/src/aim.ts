import type { Bounds, Vec } from '@bandera/shared';

/** Where the aim came from. Skills never ask: they read the direction and the point. */
export type AimSource = 'pointer' | 'stick' | 'keys' | 'pad';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/** How far along one axis a ray can travel before it leaves [min, max]. */
const room = (from: number, step: number, min: number, max: number) =>
  step > 1e-9 ? (max - from) / step : step < -1e-9 ? (min - from) / step : Infinity;

/**
 * One aim for every device. A mouse points at a place on the screen; a stick, the arrow keys or a
 * gamepad give a direction. The game reads the same two things either way: the direction from the
 * character (`angle`, the aimDirection) and the point it lands on (`x`, `y`).
 *
 * Movement never writes here, so walking cannot turn the aim, and a stick that is let go keeps the
 * last direction it gave.
 */
export class Aim {
  angle = 0;
  /** The aim point in the world; -1 until the first `resolve`. */
  x = -1;
  y = -1;
  source: AimSource = 'pointer';
  /** The cursor, in screen coordinates: its world point changes as the camera and the body move. */
  private cursor: Vec | null = null;
  /** A spot of the map picked by hand (a finger dragged onto the arena). */
  private spot: Vec | null = null;

  /** Whether the point is a place the player picked, rather than a reach along the direction. */
  get pointed() {
    return !!(this.cursor || this.spot);
  }

  /** The mouse moved. */
  pointer(screenX: number, screenY: number) {
    this.cursor = { x: screenX, y: screenY };
    this.spot = null;
    this.source = 'pointer';
  }

  /** A point of the map touched directly. */
  target(point: Vec, source: AimSource = 'stick') {
    this.spot = { x: point.x, y: point.y };
    this.cursor = null;
    this.source = source;
  }

  /**
   * A stick, the arrows or a gamepad. Inside the deadzone nothing changes, so releasing the stick
   * leaves the aim where it was. Returns whether the aim took the new direction.
   */
  direction(dx: number, dy: number, source: AimSource, deadzone = 0) {
    if (!(Math.hypot(dx, dy) > deadzone)) return false;
    this.angle = Math.atan2(dy, dx);
    this.cursor = null;
    this.spot = null;
    this.source = source;
    return true;
  }

  /** A facing the game itself gives (where a spawn looks), until a device says otherwise. */
  face(angle: number) {
    this.angle = angle;
  }

  /**
   * Once per frame: the direction and the point as seen from where the character stands now. A
   * cursor is re-read every time, so strafing with the mouse still keeps aiming at it.
   */
  resolve(origin: Vec, toWorld: (screenX: number, screenY: number) => Vec, bounds: Bounds, reach: number) {
    const place = this.spot ?? (this.cursor ? toWorld(this.cursor.x, this.cursor.y) : null);
    if (place) {
      if (Math.hypot(place.x - origin.x, place.y - origin.y) > 1e-6)
        this.angle = Math.atan2(place.y - origin.y, place.x - origin.x);
      this.x = clamp(place.x, bounds.minX, bounds.maxX);
      this.y = clamp(place.y, bounds.minY, bounds.maxY);
      return;
    }
    // A direction has no place of its own: walk it out to `reach` and stop at the arena's edge, so
    // the point always lies on the ray. Clamping each axis on its own would bend it near a border.
    const dx = Math.cos(this.angle);
    const dy = Math.sin(this.angle);
    const length = Math.max(
      0,
      Math.min(reach, room(origin.x, dx, bounds.minX, bounds.maxX), room(origin.y, dy, bounds.minY, bounds.maxY)),
    );
    this.x = clamp(origin.x + dx * length, bounds.minX, bounds.maxX);
    this.y = clamp(origin.y + dy * length, bounds.minY, bounds.maxY);
  }
}
