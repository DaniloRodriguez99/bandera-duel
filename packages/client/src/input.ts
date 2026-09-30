import { idleInput, idleSlots, CLASSES, DEFAULT_CLASS, DEFAULT_BINDINGS, DEFAULT_LOADOUTS, activePreset, SKILL_SLOTS, type CharacterCustomization, type ClassId, type Input, type PhysicalBinding, type SkillSlot } from '@bandera/shared';
import { primaryAbility, touchMeta, type TouchAbilitySlot } from './mobile-controls.js';
import { ABILITY_IDS } from './abilities.js';
import { CAST_SLOTS, type CastSlot } from '@bandera/shared/world';
import { Aim } from './aim.js';

/** Which held key's aim preview wins: mobility and the big abilities over the steady attacks. */
const TARGET_ORDER: readonly SkillSlot[] = ['mobility', 'f', 'r', 'e', 'q', 'secondary', 'primary'];

type ActionState = Omit<Input, 'seq' | 'x' | 'y' | 'angle' | 'charge' | 'special' | 'guard' | 'aimX' | 'aimY' | 'slots' | 'worldBlink' | 'kit' | 'world'>;

const emptyActions = (): ActionState => ({
  sword: false,
  shot: false,
  dash: false,
  blackHole: false,
  blackHoleRelease: false,
  blackHoleDetonate: false,
  blink: false,
  blinkRelease: false,
  summon: false,
  trap: false,
  volley: false,
  command: false,
  mark: false,
  ice: false,
});

interface TouchGesture {
   slot: Pick<TouchAbilitySlot,'id'|'mode'|'directional'|'primary'|'logicalSlot'>;
  source: string;
  element: HTMLElement;
  x: number;
  y: number;
  dragged: boolean;
  cancelled: boolean;
  started: number;
}

export class Controls {
  keys = new Set<string>();
  /**
   * The one aim every skill reads, whatever device set it: the mouse, a stick, the arrows. `angle`
   * is the aimDirection and `aimX`/`aimY` the point it lands on.
   */
  aim = new Aim();
  get angle() {
    return this.aim.angle;
  }
  get aimX() {
    return this.aim.x;
  }
  get aimY() {
    return this.aim.y;
  }
  screenToWorld: ((clientX: number, clientY: number) => { x: number; y: number }) | null = null;
  worldAimDragging = false;
  move = { x: 0, y: 0 };
  actions = emptyActions();
  enabled = false;
  /**
   * Set in the world: E/X/C/R/F/V cast equipped skills, Q swings the weapon, Space blinks with a
   * staff and the arrows aim. Null in every match, where the keys keep
   * meaning what they always meant (arrows move there).
   */
  onCast: ((slot: CastSlot) => void) | null = null;
  /**
   * World only: what the equipped weapon's click is. A dagger aims a short cone, not the line of
   * the archer class that simulates it. Null in matches, where the class decides.
   */
  attackKind: 'melee' | 'ranged' | 'spell' | null = null;
  classId: ClassId = DEFAULT_CLASS;
  bindings = { ...DEFAULT_BINDINGS[DEFAULT_CLASS] };
  loadout = { ...DEFAULT_LOADOUTS[DEFAULT_CLASS] };
  private physical = new Set<PhysicalBinding>();
  private slotPressed = new Set<SkillSlot>();
  private slotReleased = new Set<SkillSlot>();
  private touchHeld = new Set<SkillSlot>();
  private chargeSources = new Set<string>();
  private specialSources = new Set<string>();
  private guardSources = new Set<string>();
  private guardPulse = false;
  private directionalDashPulse = false;
  private movePointers = new Map<number, { x: number; y: number; el: HTMLElement }>();
  /** The finger on the aim stick, and where it landed. */
  private aimPointer: { id: number; x: number; y: number } | null = null;
  private gestures = new Map<number, TouchGesture>();

  configure(classId: ClassId, customization?: CharacterCustomization) {
    if (this.classId !== classId) {
      this.clear();
      this.classId = classId;
    }
    const preset=customization?.classId===classId?activePreset(customization):undefined;
    this.bindings={...(preset?.bindings??DEFAULT_BINDINGS[classId])};
    this.loadout={...(preset?.loadout??DEFAULT_LOADOUTS[classId])};
  }

  private mouseBinding(button:number):PhysicalBinding|undefined{return button===0?'MouseLeft':button===1?'MouseMiddle':button===2?'MouseRight':undefined;}
  private keyBinding(code:string):PhysicalBinding|undefined{const value=code==='ControlLeft'||code==='ControlRight'?'Ctrl':code==='ShiftLeft'||code==='ShiftRight'?'Shift':code;return Object.values(this.bindings).includes(value as PhysicalBinding)?value as PhysicalBinding:undefined;}
  private pressPhysical(binding:PhysicalBinding){
    this.physical.add(binding);
    for(const slot of SKILL_SLOTS)if(this.loadout[slot]&&this.bindings[slot]===binding)this.slotPressed.add(slot);
    // The summon's Mando and Marcar have keys of their own: one key, one action, no combinations.
    if(this.enabled&&!this.onCast&&Object.values(this.loadout).includes('necromancer.summon')){
      if(binding===this.bindings.companionCommand)this.actions.command=true;
      if(binding===this.bindings.companionMark)this.actions.mark=true;
    }
  }
  private releasePhysical(binding:PhysicalBinding){this.physical.delete(binding);for(const slot of SKILL_SLOTS)if(this.loadout[slot]&&this.bindings[slot]===binding)this.slotReleased.add(slot);}

  get targetingAbility(): string | null {
    const touches = [...this.gestures.values()];
    if (touches.length) return touches.at(-1)!.slot.id;
    if (!this.onCast) {
      // Matches: whichever bound key is held shows its reach, mobility and the big abilities first.
      for (const slot of TARGET_ORDER) {
        const id = this.loadout[slot];
        if (id && this.physical.has(this.bindings[slot])) return ABILITY_IDS[id];
      }
      return null;
    }
    // The world has no class kit: Q and the click swing the equipped weapon.
    if (this.chargeSources.has('mouse') || this.chargeSources.has('key'))
      return this.attackKind ? (this.attackKind === 'melee' ? 'sword' : 'shot') : primaryAbility(this.classId);
    return null;
  }

  primary() {
    if (!this.enabled) return;
    this.chargeSources.add('mouse');
  }
  releasePrimary(source = 'mouse') {
    if (this.chargeSources.delete(source) && this.enabled)
      this.actions[CLASSES[this.classId].ranged ? 'shot' : 'sword'] = true;
  }
  /** World: the arrows held right now point the aim, in eight directions. Nothing held keeps the last. */
  private aimWithArrows() {
    const dx = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    const dy = (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0);
    // The scene then places the aim point along this direction, the same way a touch stick does.
    this.aim.direction(dx, dy, 'keys');
  }
  pressSpecial(source: string) {
    const stats = CLASSES[this.classId];
    if (this.enabled && (stats.dash || stats.summon)) this.specialSources.add(source);
  }
  releaseSpecial(source: string) {
    if (!this.specialSources.delete(source) || !this.enabled) return;
    if (CLASSES[this.classId].dash) this.actions.dash = true;
    else if (CLASSES[this.classId].summon) this.actions.summon = true;
  }
  /** World only: the right button follows the class there. In matches it is just the M2 binding. */
  secondary(held: boolean) {
    if (!held) {
      this.guardSources.delete('mouse');
      return;
    }
    if (!this.enabled || !this.onCast) return;
    if (CLASSES[this.classId].summon) this.actions.summon = true;
    else if (this.classId === 'mage') this.guardSources.add('mouse');
    else if (CLASSES[this.classId].ranged) this.actions.sword = true;
  }

  constructor() {
    document.querySelector('#game')!.addEventListener('mousedown', (event) => {
      const mouse = event as MouseEvent;
      const binding=this.mouseBinding(mouse.button);if(binding)this.pressPhysical(binding);
      if (mouse.button === 1) mouse.preventDefault();
      if (mouse.button === 0) this.primary();
    });
    document.querySelector('#game')!.addEventListener('auxclick', (event) => {
      if ((event as MouseEvent).button === 1) event.preventDefault();
    });
    window.addEventListener('keydown', (event) => this.keyDown(event));
    window.addEventListener('keyup', (event) => this.keyUp(event));
    window.addEventListener('pointerup', (event) => {
      if(event.pointerType==='touch')return;
      const binding=this.mouseBinding(event.button);if(binding)this.releasePhysical(binding);
      if (event.button === 2) this.secondary(false);
      if (event.button === 0) this.releasePrimary();
    });
    window.addEventListener('mouseup', (event) => {
      if((event.target as HTMLElement)?.closest?.('#touch-controls'))return;
      const binding=this.mouseBinding(event.button);if(binding)this.releasePhysical(binding);
      if (event.button === 2) this.secondary(false);
      if (event.button === 0) this.releasePrimary();
    });
    window.addEventListener('pointercancel', () => this.clear());
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
    this.bindMovement();
    this.bindAim();
    this.bindAbilities();
  }

  private keyDown(event: KeyboardEvent) {
    if (!this.enabled || (event.target as HTMLElement)?.matches?.('input, textarea, select')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code))
      event.preventDefault();
    this.keys.add(event.code);
    if (this.onCast) {
      const cast = CAST_SLOTS.find((slot) => event.code === `Key${slot.toUpperCase()}`);
      if (cast) {
        if (!event.repeat) this.onCast(cast);
      } else if (event.code === 'Space') {
        if (!event.repeat && this.classId === 'mage') this.actions.dash = true;
      } else if (event.code === 'KeyQ') {
        // Held like the mouse button: holding charges, releasing strikes.
        if (!event.repeat) this.chargeSources.add('key');
      } else if (event.code.startsWith('Arrow')) this.aimWithArrows();
      // No class kit in the world: every other key is movement or nothing.
      return;
    }
    // Matches speak one language for every class: each bound key drives its slot, nothing else.
    const binding=this.keyBinding(event.code);
    if(binding){event.preventDefault();if(!event.repeat)this.pressPhysical(binding);}
  }

  private keyUp(event: KeyboardEvent) {
    this.keys.delete(event.code);
    if (this.onCast) {
      if (event.code === 'KeyQ') this.releasePrimary('key');
      else if (event.code.startsWith('Arrow')) this.aimWithArrows();
      return;
    }
    const binding=this.keyBinding(event.code);if(binding)this.releasePhysical(binding);
  }

  private bindMovement() {
    const element = document.querySelector<HTMLElement>('#stick-move')!;
    element.addEventListener('pointerdown', (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      const rect = element.getBoundingClientRect();
      this.movePointers.set(event.pointerId, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        el: element,
      });
      this.moveStick(event);
    });
    element.addEventListener('pointermove', (event) => this.moveStick(event));
    const finish = (event: PointerEvent) => {
      const pointer = this.movePointers.get(event.pointerId);
      if (!pointer) return;
      this.move = { x: 0, y: 0 };
      pointer.el.style.setProperty('--dx', '0px');
      pointer.el.style.setProperty('--dy', '0px');
      this.movePointers.delete(event.pointerId);
    };
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
    element.addEventListener('lostpointercapture', finish);
  }

  /**
   * The right thumb's aim stick. It appears wherever the thumb lands on the free right side and
   * only ever sets the aim; lifting the thumb leaves the last direction in place.
   */
  private bindAim() {
    const zone = document.querySelector<HTMLElement>('#aim-zone')!;
    const stick = document.querySelector<HTMLElement>('#stick-aim')!;
    const move = (event: PointerEvent) => {
      if (event.pointerId !== this.aimPointer?.id) return;
      const dx = event.clientX - this.aimPointer.x;
      const dy = event.clientY - this.aimPointer.y;
      const magnitude = Math.hypot(dx, dy);
      const scale = Math.min(1, magnitude / 35);
      stick.style.setProperty('--dx', `${magnitude > 0 ? (dx / magnitude) * scale * 30 : 0}px`);
      stick.style.setProperty('--dy', `${magnitude > 0 ? (dy / magnitude) * scale * 30 : 0}px`);
      this.aim.direction(dx, dy, 'stick', 8);
    };
    zone.addEventListener('pointerdown', (event) => {
      if (!this.enabled || this.aimPointer) return;
      event.preventDefault();
      zone.setPointerCapture(event.pointerId);
      this.aimPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      const rect = zone.getBoundingClientRect();
      stick.style.left = `${event.clientX - rect.left}px`;
      stick.style.top = `${event.clientY - rect.top}px`;
      stick.hidden = false;
    });
    zone.addEventListener('pointermove', move);
    const finish = (event: PointerEvent) => {
      if (event.pointerId === this.aimPointer?.id) this.releaseAimStick();
    };
    zone.addEventListener('pointerup', finish);
    zone.addEventListener('pointercancel', finish);
    zone.addEventListener('lostpointercapture', finish);
  }

  private releaseAimStick() {
    this.aimPointer = null;
    const stick = document.querySelector<HTMLElement>('#stick-aim');
    if (!stick) return;
    stick.hidden = true;
    stick.style.setProperty('--dx', '0px');
    stick.style.setProperty('--dy', '0px');
  }

  private bindAbilities() {
    const root = document.querySelector<HTMLElement>('#touch-actions')!;
    root.addEventListener('pointerdown', (event) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>('[data-touch-ability]');
      if (!element || !this.enabled) return;
      const id=element.dataset.touchAbility!;
       const logicalSlot=element.dataset.logicalSlot as SkillSlot|undefined;
       const slot={id,...touchMeta(id,this.classId),logicalSlot};
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      const rect = element.getBoundingClientRect();
      const gesture: TouchGesture = {
        slot,
        source: `touch-${event.pointerId}`,
        element,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        dragged: false,
        cancelled: false,
        started: performance.now(),
      };
      this.gestures.set(event.pointerId, gesture);
      this.beginTouch(gesture);
      this.moveAbility(event);
    });
    root.addEventListener('pointermove', (event) => this.moveAbility(event));
    const finish = (event: PointerEvent) => this.finishTouch(event, event.type === 'pointerup');
    root.addEventListener('pointerup', finish);
    root.addEventListener('pointercancel', finish);
    root.addEventListener('lostpointercapture', finish);
  }

  private beginTouch(gesture: TouchGesture) {
    const { id, mode } = gesture.slot;
    if (gesture.slot.logicalSlot) {
      // Charges and holds start with the finger; aimed taps wait for the release, after the drag
      // has pointed them.
      if (mode !== 'release') {
        this.slotPressed.add(gesture.slot.logicalSlot);
        this.touchHeld.add(gesture.slot.logicalSlot);
      }
      gesture.element.dataset.aiming = 'true';
      return;
    }
    if (mode === 'charge') {
      if (id === 'shot' || id === 'sword') {
        this.chargeSources.add(gesture.source);
      } else this.pressSpecial(gesture.source);
    }
    if (mode === 'press' && id === 'magic-shield') this.guardPulse = true;
    gesture.element.dataset.aiming = 'true';
  }

  private moveAbility(event: PointerEvent) {
    const gesture = this.gestures.get(event.pointerId);
    if (!gesture) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const magnitude = Math.hypot(dx, dy);
    // Singularidad targets the touched map point; other abilities use the drag direction.
    const onMap = gesture.slot.id === 'black-hole' && magnitude > 12 && !!this.screenToWorld;
    if (onMap) {
      this.aim.target(this.screenToWorld!(event.clientX, event.clientY));
      this.worldAimDragging = true;
    }
    if (magnitude > 12) gesture.dragged = true;
    gesture.cancelled = gesture.dragged && magnitude < 10;
    gesture.element.dataset.cancel = String(gesture.cancelled);
    const scale = Math.min(1, magnitude / 46);
    const thumbX = magnitude > 0 ? (dx / magnitude) * scale * 25 : 0;
    const thumbY = magnitude > 0 ? (dy / magnitude) * scale * 25 : 0;
    gesture.element.style.setProperty('--aim-x', `${thumbX}px`);
    gesture.element.style.setProperty('--aim-y', `${thumbY}px`);
    if (gesture.slot.directional && !onMap) this.aim.direction(dx, dy, 'stick', 7);
  }

  private finishTouch(event: PointerEvent, released: boolean) {
    const gesture = this.gestures.get(event.pointerId);
    if (!gesture) return;
    const cast = released && !gesture.cancelled && this.enabled;
    this.worldAimDragging = false;
    const { id, mode } = gesture.slot;
    if (gesture.slot.logicalSlot) {
      this.touchHeld.delete(gesture.slot.logicalSlot);
      // Dragged back to the centre: no release, so a held charge is dropped without its cooldown.
      if (cast) {
        if (mode === 'release') this.slotPressed.add(gesture.slot.logicalSlot);
        this.slotReleased.add(gesture.slot.logicalSlot);
      }
      gesture.element.dataset.aiming = 'false';
      gesture.element.dataset.cancel = 'false';
      gesture.element.style.setProperty('--aim-x', '0px');
      gesture.element.style.setProperty('--aim-y', '0px');
      this.gestures.delete(event.pointerId);
      return;
    }
    if (mode === 'charge') {
      if (id === 'shot' || id === 'sword') {
        const held = this.chargeSources.delete(gesture.source);
        if (cast && held) this.actions[id] = true;
      } else {
        const held = this.specialSources.delete(gesture.source);
        if (cast && held) {
          this.actions[id === 'summon' ? 'summon' : 'dash'] = true;
          if (id === 'dash') this.directionalDashPulse = true;
        }
      }
    }
    if (mode === 'hold') this.guardSources.delete(gesture.source);
    if (mode === 'release' && cast) this.releaseAction(id,performance.now()-gesture.started);
    gesture.element.dataset.aiming = 'false';
    gesture.element.dataset.cancel = 'false';
    gesture.element.style.setProperty('--aim-x', '0px');
    gesture.element.style.setProperty('--aim-y', '0px');
    this.gestures.delete(event.pointerId);
  }

  private releaseAction(id: string,duration=0) {
    if(id==='command'&&duration>=500){this.actions.mark=true;return;}
    if (id === 'dagger') this.actions.sword = true;
    else if (id in this.actions) (this.actions as Record<string, boolean>)[id] = true;
    if (id === 'dash') this.directionalDashPulse = true;
    if (id === 'volley') this.chargeSources.clear();
  }

  private moveStick(event: PointerEvent) {
    const pointer = this.movePointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const magnitude = Math.hypot(dx, dy);
    const scale = Math.min(1, magnitude / 35);
    const x = magnitude > 5 ? (dx / magnitude) * scale : 0;
    const y = magnitude > 5 ? (dy / magnitude) * scale : 0;
    pointer.el.style.setProperty('--dx', `${x * 30}px`);
    pointer.el.style.setProperty('--dy', `${y * 30}px`);
    this.move = { x, y };
  }

  read(seq: number): Input {
    if (!this.enabled) return idleInput(seq, this.angle);
    // In the world the arrows aim; only in a match do they also move.
    const arrows = !this.onCast;
    let x =
      this.move.x +
      (this.keys.has('KeyD') || (arrows && this.keys.has('ArrowRight')) ? 1 : 0) -
      (this.keys.has('KeyA') || (arrows && this.keys.has('ArrowLeft')) ? 1 : 0);
    let y =
      this.move.y +
      (this.keys.has('KeyS') || (arrows && this.keys.has('ArrowDown')) ? 1 : 0) -
      (this.keys.has('KeyW') || (arrows && this.keys.has('ArrowUp')) ? 1 : 0);
    if (this.directionalDashPulse && this.actions.dash) {
      x = Math.cos(this.angle);
      y = Math.sin(this.angle);
    }
    const magnitude = Math.max(1, Math.hypot(x, y));
    const result: Input = {
      seq,
      x: x / magnitude,
      y: y / magnitude,
      angle: this.angle,
      ...this.actions,
      charge: this.chargeSources.size > 0,
      special: this.specialSources.size > 0,
      guard: this.guardSources.size > 0 || this.guardPulse,
      aimX: this.aimX,
      aimY: this.aimY,
      // Only `worldInput` sets these; the network never carries them.
      worldBlink: false,
      world: false,
      slots:idleSlots(),
    };
    for(const slot of SKILL_SLOTS)if(this.loadout[slot])result.slots[slot]={pressed:this.slotPressed.has(slot),held:this.physical.has(this.bindings[slot])||this.touchHeld.has(slot),released:this.slotReleased.has(slot)};
    this.actions = emptyActions();
    this.slotPressed.clear();this.slotReleased.clear();
    this.guardPulse = false;
    this.directionalDashPulse = false;
    return result;
  }

  clearCombat() {
    this.guardSources.clear();
    this.chargeSources.clear();
    this.specialSources.clear();
    this.physical.clear();
    this.slotPressed.clear();
    this.slotReleased.clear();
    this.touchHeld.clear();
    this.guardPulse = false;
    this.directionalDashPulse = false;
    this.actions = emptyActions();
    this.gestures.clear();
    document.querySelectorAll<HTMLElement>('[data-touch-ability]').forEach((element) => {
      element.dataset.aiming = 'false';
      element.dataset.cancel = 'false';
      element.style.setProperty('--aim-x', '0px');
      element.style.setProperty('--aim-y', '0px');
    });
  }

  clear() {
    this.keys.clear();
    this.guardSources.clear();
    this.chargeSources.clear();
    this.specialSources.clear();
    this.physical.clear();this.slotPressed.clear();this.slotReleased.clear();this.touchHeld.clear();
    this.guardPulse = false;
    this.directionalDashPulse = false;
    this.move = { x: 0, y: 0 };
    this.actions = emptyActions();
    this.movePointers.clear();
    this.releaseAimStick();
    this.gestures.clear();
    document.querySelectorAll<HTMLElement>('.stick').forEach((element) => {
      element.style.setProperty('--dx', '0px');
      element.style.setProperty('--dy', '0px');
    });
    document.querySelectorAll<HTMLElement>('[data-touch-ability]').forEach((element) => {
      element.dataset.aiming = 'false';
      element.dataset.cancel = 'false';
      element.style.setProperty('--aim-x', '0px');
      element.style.setProperty('--aim-y', '0px');
    });
  }
}
