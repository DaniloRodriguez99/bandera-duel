import { idleInput, type Input } from '@bandera/shared';
export class Controls {
  keys = new Set<string>();
  angle = 0;
  move = { x: 0, y: 0 };
  actions = { sword: false, shot: false, dash: false };
  enabled = false;
  private sticks = new Map<
    number,
    { kind: 'move' | 'aim'; x: number; y: number; el: HTMLElement }
  >();
  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || (e.target as HTMLElement)?.matches('input')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
        e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) this.actions.dash = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
    for (const kind of ['move', 'aim'] as const) {
      const el = document.querySelector<HTMLElement>(`#stick-${kind}`)!;
      el.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const r = el.getBoundingClientRect();
        this.sticks.set(e.pointerId, {
          kind,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          el,
        });
        this.stickMove(e);
      });
      el.addEventListener('pointermove', (e) => this.stickMove(e));
      const end = (e: PointerEvent) => {
        const s = this.sticks.get(e.pointerId);
        if (!s) return;
        if (s.kind === 'aim' && e.type === 'pointerup') this.actions.shot = true;
        if (s.kind === 'move') this.move = { x: 0, y: 0 };
        s.el.style.setProperty('--dx', '0px');
        s.el.style.setProperty('--dy', '0px');
        this.sticks.delete(e.pointerId);
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
    }
    for (const action of ['sword', 'dash'] as const)
      document.querySelector(`#touch-${action}`)!.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.enabled) this.actions[action] = true;
      });
  }
  stickMove(e: PointerEvent) {
    const s = this.sticks.get(e.pointerId);
    if (!s) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y,
      mag = Math.hypot(dx, dy),
      scale = Math.min(1, mag / 35);
    const x = mag > 5 ? (dx / mag) * scale : 0,
      y = mag > 5 ? (dy / mag) * scale : 0;
    s.el.style.setProperty('--dx', `${x * 30}px`);
    s.el.style.setProperty('--dy', `${y * 30}px`);
    if (s.kind === 'move') this.move = { x, y };
    else if (mag > 5) this.angle = Math.atan2(dy, dx);
  }
  read(seq: number): Input {
    if (!this.enabled) return idleInput(seq, this.angle);
    let x =
      this.move.x +
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    let y =
      this.move.y +
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
    const n = Math.max(1, Math.hypot(x, y));
    const result = { seq, x: x / n, y: y / n, angle: this.angle, ...this.actions };
    this.actions = { sword: false, shot: false, dash: false };
    return result;
  }
  clear() {
    this.keys.clear();
    this.move = { x: 0, y: 0 };
    this.actions = { sword: false, shot: false, dash: false };
    this.sticks.clear();
    document.querySelectorAll<HTMLElement>('.stick').forEach((el) => {
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '0px');
    });
  }
}
