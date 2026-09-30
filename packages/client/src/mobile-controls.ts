import { CLASSES, DEFAULT_LOADOUTS, KIT, RULES, affordable, chargeProgress, overcharge, type ClassId, type Player, type SkillSlot } from '@bandera/shared';
import { abilityCards, type AbilitySlot } from './abilities.js';

/** Thumb order: the big attack button first, mobility beside it, then the class's abilities. */
const TOUCH_ORDER: readonly SkillSlot[] = ['primary', 'mobility', 'secondary', 'q', 'e', 'f', 'r'];

export type TouchMode = 'charge' | 'hold' | 'release' | 'press';

export interface TouchAbilitySlot extends AbilitySlot {
  mode: TouchMode;
  directional: boolean;
  primary: boolean;
  logicalSlot?: SkillSlot;
}

const TOUCH_META: Record<string, Omit<TouchAbilitySlot, keyof AbilitySlot>> = {
  shot: { mode: 'charge', directional: true, primary: true },
  sword: { mode: 'charge', directional: true, primary: true },
  dash: { mode: 'charge', directional: true, primary: false },
  'black-hole': { mode: 'charge', directional: true, primary: false },
  summon: { mode: 'charge', directional: true, primary: false },
  dagger: { mode: 'release', directional: true, primary: false },
  trap: { mode: 'release', directional: false, primary: false },
  volley: { mode: 'release', directional: true, primary: false },
  'magic-shield': { mode: 'press', directional: false, primary: false },
  ice: { mode: 'release', directional: true, primary: false },
  command: { mode: 'release', directional: false, primary: false },
  mark: { mode: 'release', directional: true, primary: false },
  flurry: { mode: 'charge', directional: true, primary: false },
  fury: { mode: 'release', directional: false, primary: false },
  slash: { mode: 'charge', directional: true, primary: false },
  // A parry goes up the moment the finger lands; dragging still turns the guard.
  counter: { mode: 'press', directional: true, primary: false },
  reinforce: { mode: 'press', directional: false, primary: false },
};
export const touchMeta=(id:string,classId:ClassId)=>{const meta=TOUCH_META[id];if(!meta)throw new Error(`Falta configuración táctil para ${classId}/${id}`);return {...meta};};

/**
 * Every class's buttons come from the same cards as the ability bar. Empty positions have no button,
 * and Marcar has none either: a long press on Mando marks, since a finger cannot right-click.
 */
export function touchAbilitySlots(classId: ClassId,player?:Pick<Player,'loadout'>): TouchAbilitySlot[] {
  const loadout = player?.loadout ?? DEFAULT_LOADOUTS[classId];
  return abilityCards({ classId, loadout }, undefined, TOUCH_ORDER)
    .filter((slot) => !slot.locked && slot.companion !== 'companionMark')
    .map((slot) => ({
      ...slot,
      ...touchMeta(slot.id, classId),
      // Mando is not a slot: its button keeps its own tap / long-press path.
      logicalSlot: slot.companion ? undefined : slot.logicalSlot,
    }));
}

function chargeFor(slot: TouchAbilitySlot, p: Player) {
  // A kit skill fills its ring over its own charge.
  if (slot.skillId && slot.skillId in KIT)
    return p.chargeSkill === slot.skillId ? chargeProgress(KIT[slot.skillId].charge, p.chargeT) : 0;
  if (slot.id === 'shot' || slot.id === 'sword')
    return p.shotCharge / (p.classId === 'archer' ? RULES.chargeTime : RULES.overchargeTime);
  if (slot.skillId === 'mage.blink') return p.blinkCharge / RULES.mageBlinkChargeTime;
  if (slot.id === 'black-hole') return p.blackHoleCharge / RULES.blackHoleChargeTime;
  if (slot.id === 'summon') return p.specialCharge / RULES.raiseCharge;
  if (slot.id === 'dash') return p.specialCharge / RULES.overchargeTime;
  return 0;
}

function activeFor(id: string, p: Player) {
  if (id === 'counter') return p.counterLeft > 0;
  if (id === 'fury') return p.empowered === 'awaken';
  if (id === 'reinforce') return p.empowered === 'reinforce';
  if (id === 'flurry') return p.move.startsWith('guardian.flurry:');
  if (id === 'slash') return p.move.startsWith('vanguard.slash:');
  if (id === 'magic-shield') return p.magicShieldHits > 0;
  if (id === 'trap') return p.trapLeft > 0;
  if (id === 'dash') return p.dashLeft > 0;
  return false;
}

function statusFor(slot: TouchAbilitySlot, p: Player, cooldown: number) {
  const charge = chargeFor(slot, p);
  // Past a full charge the number keeps climbing.
  const over = slot.skillId && p.chargeSkill === slot.skillId ? overcharge(KIT[slot.skillId].charge, p.chargeT) : 0;
  if (over > 0) return `${100 + Math.round(over * 100)}%`;
  if (charge > 0) return `${Math.round(Math.min(1, charge) * 100)}%`;
  if (slot.id === 'fury' && p.empowered !== 'awaken' && p.classId === 'guardian') return `${Math.floor(p.rage)}%`;
  if (slot.id === 'counter' && p.counterLeft > 0) return 'ACTIVO';
  if ((slot.id === 'fury' || slot.id === 'reinforce') && p.furyLeft > 0) return `${p.furyLeft.toFixed(1)}s`;
  if (slot.id === 'magic-shield' && p.magicShieldHits > 0) return `${p.magicShieldHits}/2`;
  if (slot.id === 'trap' && p.trapLeft > 0) return p.trapLeft.toFixed(1);
  if (cooldown > 0) return cooldown < 10 ? cooldown.toFixed(1) : String(Math.ceil(cooldown));
  return '';
}

function button(slot: TouchAbilitySlot) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `touch-ability${slot.primary ? ' primary' : ''}`;
  // The stylesheet lays these out by id (`.stage[data-class=archer] #touch-trap`) and the browser
  // specs address them the same way, so every button needs one.
  node.id = `touch-${slot.id}`;
  node.dataset.touchAbility = slot.id;
  if (slot.logicalSlot) node.dataset.logicalSlot = slot.logicalSlot;
  node.dataset.mode = slot.mode;
  node.dataset.directional = String(slot.directional);
  node.setAttribute('aria-label', `${slot.name}${slot.directional ? ' · arrastrá para apuntar' : ''}`);
  const icon = document.createElement('img');
  icon.src = slot.icon;
  icon.alt = '';
  icon.draggable = false;
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('small');
  label.textContent = slot.name;
  const status = document.createElement('b');
  status.className = 'touch-ability-status';
  const thumb = document.createElement('i');
  thumb.className = 'touch-ability-thumb';
  node.append(icon, label, status, thumb);
  return node;
}

export function mountTouchAbilities(root: HTMLElement, classId: ClassId,player?:Pick<Player,'loadout'>) {
  const signature=`${classId}:${Object.values(player?.loadout ?? DEFAULT_LOADOUTS[classId]).join('|')}`;
  if (root.dataset.class === signature) return;
  root.dataset.class = signature;
  root.replaceChildren(...touchAbilitySlots(classId,player).map(button));
}

export function updateTouchAbilities(root: HTMLElement, p: Player, holeLive = false) {
  mountTouchAbilities(root, p.classId,p);
  const slots = touchAbilitySlots(p.classId,p);
  root.querySelectorAll<HTMLElement>('[data-touch-ability]').forEach((node, index) => {
    const slot = slots[index];
    const cooldown = slot.cooldown(p);
    const charge = Math.max(0, Math.min(1, chargeFor(slot, p)));
    // A Singularidad in flight: a tap implodes it, while its cooldown runs in parallel.
    const live = holeLive && slot.id === 'black-hole';
    const status = live ? 'DETONAR' : statusFor(slot, p, cooldown);
    // A skill that cannot be paid for (the awakening without its Rage) is not ready either.
    node.dataset.ready = String((cooldown <= 0 || live) && (!slot.skillId || affordable(p, slot.skillId)));
    node.dataset.active = String(live || activeFor(slot.id, p));
    node.style.setProperty('--cd', String(live ? 0 : Math.min(1, cooldown / Math.max(0.001, slot.max))));
    node.style.setProperty('--charge', String(charge));
    node.querySelector<HTMLElement>('.touch-ability-status')!.textContent = status;
    node.setAttribute('aria-label', `${slot.name} · ${live ? 'tocá para detonar' : cooldown > 0 ? `${cooldown.toFixed(1)} segundos` : 'lista'}`);
  });
}

export function primaryAbility(classId: ClassId) {
  return CLASSES[classId].ranged ? 'shot' : 'sword';
}
