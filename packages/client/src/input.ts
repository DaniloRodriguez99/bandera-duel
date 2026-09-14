import { idleInput, CLASSES, DEFAULT_CLASS, type ClassId, type Input } from '@bandera/shared';
export class Controls {
  keys = new Set<string>();
  angle = 0;
  move = { x: 0, y: 0 };
  actions = { sword: false, shot: false, dash: false, summon: false, trap: false, volley: false };
  enabled = false;
  classId: ClassId = DEFAULT_CLASS;
  private chargeSources = new Set<string>();
  private guardSources = new Set<string>();
  configure(classId: ClassId) {
    if (this.classId !== classId) { this.clear(); this.classId = classId; }
  }
  primary() {
    if (!this.enabled) return;
    if (this.classId === 'archer') this.chargeSources.add('mouse');
    else this.actions[CLASSES[this.classId].ranged ? 'shot' : 'sword'] = true;
  }
  releasePrimary() {
    if (this.chargeSources.delete('mouse') && this.enabled) this.actions.shot = true;
  }
  secondary(held: boolean) {
    if (!held) { this.guardSources.delete('mouse'); return; }
    if (!this.enabled) return;
    if (CLASSES[this.classId].summon) this.actions.summon = true;
    else if (this.classId === 'mage') this.guardSources.add('mouse');
    else if (CLASSES[this.classId].ranged) this.actions.sword = true;
    else if (this.classId === 'guardian') this.guardSources.add('mouse');
  }
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
      if (!e.repeat && this.classId === 'archer') {
        if (e.code === 'KeyQ') this.actions.trap = true;
        if (e.code === 'KeyE') this.actions.volley = true;
      }
      if (e.code === 'Space' && !e.repeat) {
        if (CLASSES[this.classId].dash) this.actions.dash = true;
        else if (CLASSES[this.classId].summon) this.actions.summon = true;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('pointerup', e => { if (e.button === 2) this.secondary(false); if(e.button === 0) this.releasePrimary(); });
    window.addEventListener('pointercancel', () => this.clear());
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
        if(kind === 'aim' && this.classId === 'archer') this.chargeSources.add(`touch-${e.pointerId}`);
        this.stickMove(e);
      });
      el.addEventListener('pointermove', (e) => this.stickMove(e));
      const end = (e: PointerEvent) => {
        const s = this.sticks.get(e.pointerId);
        if (!s) return;
        if (s.kind === 'aim' && e.type === 'pointerup' && CLASSES[this.classId].ranged) this.actions.shot = true;
        if (s.kind === 'move') this.move = { x: 0, y: 0 };
        s.el.style.setProperty('--dx', '0px');
        s.el.style.setProperty('--dy', '0px');
        this.chargeSources.delete(`touch-${e.pointerId}`);
        this.sticks.delete(e.pointerId);
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
    }
    for (const action of ['sword', 'dash', 'summon'] as const)
      document.querySelector(`#touch-${action}`)!.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const stats = CLASSES[this.classId];
        if (this.enabled && (action === 'sword' ? stats.melee : stats[action])) this.actions[action] = true;
      });
    for (const action of ['trap','volley'] as const) document.querySelector(`#touch-${action}`)!.addEventListener('pointerdown', e => { e.preventDefault(); if(this.enabled && this.classId === 'archer') this.actions[action] = true; });
    const guard = document.querySelector<HTMLElement>('#touch-guard')!;
    guard.addEventListener('pointerdown', e => {
      if (!this.enabled || (!CLASSES[this.classId].shield && this.classId !== 'mage')) return;
      e.preventDefault(); guard.setPointerCapture(e.pointerId);
      this.guardSources.add(`touch-${e.pointerId}`);
    });
    for (const event of ['pointerup','pointercancel','lostpointercapture'])
      guard.addEventListener(event, e => this.guardSources.delete(`touch-${(e as PointerEvent).pointerId}`));
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
    const result = { seq, x: x / n, y: y / n, angle: this.angle, ...this.actions, charge: this.chargeSources.size > 0, guard: this.guardSources.size > 0 };
    this.actions = { sword: false, shot: false, dash: false, summon: false, trap: false, volley: false };
    return result;
  }
  clear() {
    this.keys.clear();
    this.guardSources.clear();
    this.chargeSources.clear();
    this.move = { x: 0, y: 0 };
    this.actions = { sword: false, shot: false, dash: false, summon: false, trap: false, volley: false };
    this.sticks.clear();
    document.querySelectorAll<HTMLElement>('.stick').forEach((el) => {
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '0px');
    });
  }
}
