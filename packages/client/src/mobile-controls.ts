import { CLASSES, RULES, chargePower, type ClassId, type Player } from '@bandera/shared';
import { abilitySlots, playerAbilitySlots, type AbilitySlot } from './abilities.js';

export type TouchMode = 'charge' | 'hold' | 'release' | 'press';

export interface TouchAbilitySlot extends AbilitySlot {
  mode: TouchMode;
  directional: boolean;
  primary: boolean;
}

const TOUCH_META: Record<string, Omit<TouchAbilitySlot, keyof AbilitySlot>> = {
  shot: { mode: 'charge', directional: true, primary: true },
  sword: { mode: 'charge', directional: true, primary: true },
  dash: { mode: 'charge', directional: true, primary: false },
  summon: { mode: 'charge', directional: true, primary: false },
  dagger: { mode: 'release', directional: true, primary: false },
  trap: { mode: 'release', directional: false, primary: false },
  volley: { mode: 'release', directional: true, primary: false },
  'magic-shield': { mode: 'press', directional: false, primary: false },
  ice: { mode: 'release', directional: true, primary: false },
  command: { mode: 'release', directional: false, primary: false },
  mark: { mode: 'release', directional: true, primary: false },
  guard: { mode: 'hold', directional: true, primary: false },
  'shield-bash': { mode: 'release', directional: true, primary: false },
  fury: { mode: 'release', directional: false, primary: false },
  slash: { mode: 'release', directional: true, primary: false },
  counter: { mode: 'hold', directional: true, primary: false },
};
export const touchMeta=(id:string,classId:ClassId)=>{const meta=TOUCH_META[id];if(!meta)throw new Error(`Falta configuración táctil para ${classId}/${id}`);return {...meta,mode:id==='dash'&&classId==='guardian'?'release' as const:meta.mode};};

export function touchAbilitySlots(classId: ClassId,player?:Player): TouchAbilitySlot[] {
  return (player?.classId==='mage'?playerAbilitySlots(player):abilitySlots(classId)).map((slot) => {
    const meta = touchMeta(slot.id,classId);
    return {
      ...slot,
      ...meta,
      mode: slot.id === 'dash' && classId === 'guardian' ? 'release' : meta.mode,
    };
  });
}

function chargeFor(slot: TouchAbilitySlot, p: Player) {
  if (slot.id === 'shot' || slot.id === 'sword')
    return p.shotCharge / (p.classId === 'archer' ? RULES.chargeTime : RULES.overchargeTime);
  if (slot.id === 'dash' || slot.id === 'summon')
    return p.specialCharge / (CLASSES[p.classId].summon ? RULES.raiseCharge : RULES.overchargeTime);
  if (slot.id === 'counter') return p.counterCharge / RULES.counterChargeTime;
  return 0;
}

function activeFor(id: string, p: Player) {
  if (id === 'guard') return p.guarding;
  if (id === 'counter') return p.counterLeft > 0;
  if (id === 'fury') return p.furyLeft > 0;
  if (id === 'magic-shield') return p.magicShieldHits > 0;
  if (id === 'shield-bash') return p.shieldBashLeft > 0;
  if (id === 'trap') return p.trapLeft > 0;
  if (id === 'dash') return p.dashLeft > 0;
  return false;
}

function statusFor(slot: TouchAbilitySlot, p: Player, cooldown: number) {
  const charge = chargeFor(slot, p);
  if (charge > 0) return `${Math.round(Math.min(1, charge) * 100)}%`;
  if (slot.id === 'guard' && p.guarding) return 'ACTIVA';
  if (slot.id === 'counter' && p.counterLeft > 0) return p.counterCharge >= RULES.counterChargeTime ? 'MÁX' : 'ACTIVO';
  if (slot.id === 'fury' && p.furyLeft > 0) return `${p.furyLeft.toFixed(1)}s`;
  if (slot.id === 'magic-shield' && p.magicShieldHits > 0) return `${p.magicShieldHits}/2`;
  if (slot.id === 'trap' && p.trapLeft > 0) return p.trapLeft.toFixed(1);
  if (cooldown > 0) return cooldown < 10 ? cooldown.toFixed(1) : String(Math.ceil(cooldown));
  return '';
}

function button(slot: TouchAbilitySlot) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `touch-ability${slot.primary ? ' primary' : ''}`;
  node.dataset.touchAbility = slot.id;
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

export function mountTouchAbilities(root: HTMLElement, classId: ClassId,player?:Player) {
  const signature=player?.classId==='mage'?`${classId}:${Object.values(player.loadout).join('|')}`:classId;
  if (root.dataset.class === signature) return;
  root.dataset.class = signature;
  root.replaceChildren(...touchAbilitySlots(classId,player).map(button));
}

export function updateTouchAbilities(root: HTMLElement, p: Player) {
  mountTouchAbilities(root, p.classId,p);
  const slots = touchAbilitySlots(p.classId,p);
  root.querySelectorAll<HTMLElement>('[data-touch-ability]').forEach((node, index) => {
    const slot = slots[index];
    const cooldown = slot.cooldown(p);
    const charge = Math.max(0, Math.min(1, chargeFor(slot, p)));
    const status = statusFor(slot, p, cooldown);
    node.dataset.ready = String(cooldown <= 0);
    node.dataset.active = String(activeFor(slot.id, p));
    node.style.setProperty('--cd', String(Math.min(1, cooldown / Math.max(0.001, slot.max))));
    node.style.setProperty('--charge', String(charge));
    node.querySelector<HTMLElement>('.touch-ability-status')!.textContent = status;
    node.setAttribute('aria-label', `${slot.name} · ${cooldown > 0 ? `${cooldown.toFixed(1)} segundos` : 'lista'}`);
  });
}

export function primaryAbility(classId: ClassId) {
  return CLASSES[classId].ranged ? 'shot' : 'sword';
}
