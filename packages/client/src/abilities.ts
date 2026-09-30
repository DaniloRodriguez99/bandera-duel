import { CLASSES, DEFAULT_BINDINGS, KIT, KNIGHT_AWAKEN, MOVES, RULES, SKILLS, WARRIOR_PARRY, WARRIOR_REINFORCE, affordable, blackHoleStats, chargePower, chargeProgress, chargeTier, kitCooldown, overcharge, projectileSkillStats, skillCost, type ClassId, type InputBindings, type PhysicalBinding, type Player, type ResourceCost, type SkillId, type SkillSlot, type Snapshot } from '@bandera/shared';
import { hasFaces, showFace } from './combo-icons.js';

/**
 * Whether this player's Singularidad is still out. Its key then bursts the hole, so its card and
 * button read as ready while the cooldown keeps running underneath.
 */
export const liveBlackHole = (s: Pick<Snapshot, 'blackHoles'>, id: string) =>
  (s.blackHoles ?? []).some((hole) => hole.owner === id && hole.left > 0);

/** One branch of an ability: what a tap, a hold or a full charge does. */
export interface AbilityTier {
  label: string;
  active?: (p: Player) => boolean;
  state?: (p: Player) => string | null;
}

export interface AbilitySlot {
  id: string;
  skillId?: SkillId;
  logicalSlot?: SkillSlot;
  /** The summon's Mando or Marcar, which have keys of their own rather than slots. */
  companion?: 'companionCommand' | 'companionMark';
  key: string;
  name: string;
  icon: string;
  cooldown: (p: Player) => number;
  max: number;
  detail?: (p: Player) => string | null;
  tiers?: AbilityTier[];
  /** An empty position of the universal layout. */
  locked?: boolean;
  /** How to use it, with the bound key already in. */
  howTo?: string;
  /** The same line for a finger, which presses a button rather than a key. */
  howToTouch?: string;
  /** What it takes to use it, in the modes that have mana. */
  cost?: ResourceCost;
}

const skillIcon = (name: string) => `/assets/skills/${name}.png`;

const percent = (value: number) => `${Math.round(Math.min(1, value) * 100)} %`;
const tapped = (charge: number) => charge > 0 && charge < RULES.overchargeTap;
/** A full primary charge becomes wind; every active archer dash empowers the triple shot. */
const windFull = (p: Player) => p.shotCharge >= RULES.chargeTime - 1e-8;

/**
 * The HUD's fixed positions, the same for every class: M1 M2 · Q E F R, and Space below. An empty
 * position still shows its key, so the layout itself teaches the control language.
 */
export const LAYOUT: readonly SkillSlot[] = ['primary', 'secondary', 'q', 'e', 'f', 'r', 'mobility'];
const COMPANIONS = ['companionCommand', 'companionMark'] as const;
type Companion = (typeof COMPANIONS)[number];

/** The ids the scene's aim previews, the touch buttons and the stylesheet know each skill by. */
export const ABILITY_IDS: Record<SkillId, string> = {
  'archer.arrow': 'shot', 'archer.dagger': 'dagger', 'archer.trap': 'trap', 'archer.volley': 'volley',
  'mage.fireball': 'shot', 'mage.magicShield': 'magic-shield', 'mage.ice': 'ice', 'mage.blink': 'dash',
  'mage.blackHole': 'black-hole', 'necromancer.fire': 'shot', 'necromancer.summon': 'summon',
  'guardian.sword': 'sword', 'guardian.flurry': 'flurry', 'guardian.dash': 'dash',
  'guardian.fury': 'fury', 'vanguard.sword': 'sword',
  'vanguard.slash': 'slash', 'vanguard.counter': 'counter', 'vanguard.dash': 'dash',
  'vanguard.reinforce': 'reinforce', 'common.dash': 'dash',
};
/** Short names that fit a card. */
const CARD_NAMES: Record<SkillId, string> = {
  'archer.arrow': 'Flecha', 'archer.dagger': 'Daga', 'archer.trap': 'Trampa', 'archer.volley': 'Triple',
  'mage.fireball': 'Orbe de fuego', 'mage.magicShield': 'Égida de dos sellos', 'mage.ice': 'Flecha de hielo',
  'mage.blink': 'Parpadeo', 'mage.blackHole': 'Singularidad', 'necromancer.fire': 'Fuego',
  'necromancer.summon': 'Invocar zombies', 'guardian.sword': 'Tres Cortes', 'guardian.flurry': 'Ráfaga de Acero',
  'guardian.dash': 'Paso Relámpago', 'guardian.fury': 'Despertar',
  'vanguard.sword': 'Mandoble Colosal', 'vanguard.slash': 'Creciente Escarlata', 'vanguard.counter': 'Revancha de Hierro',
  'vanguard.dash': 'Avance Imparable', 'vanguard.reinforce': 'Cuerpo de Hierro', 'common.dash': 'Esquivar',
};
const COMPANION_NAMES: Record<Companion, string> = { companionCommand: 'Mando', companionMark: 'Marcar' };
const COMPANION_HOW_TO: Record<Companion, string> = {
  companionCommand: 'Pulsá {key} para alternar zombies automáticos o a tu mando.',
  companionMark: 'Pulsá {key} sobre un zombie para cambiarlo de círculo.',
};
/** The shared dash wears each class's own art. */
const iconFor = (classId: ClassId, id: SkillId) =>
  skillIcon(id === 'common.dash' ? (classId === 'archer' ? 'archer-wind' : 'vanguard-dash') : SKILLS[id].icon);
export const bindingLabel = (value: PhysicalBinding) =>
  ({ MouseLeft: 'CLIC', MouseRight: 'CLIC DER.', MouseMiddle: 'CLIC 3', Space: 'ESPACIO', Shift: 'SHIFT', Ctrl: 'CTRL' } as Record<string, string>)[value] ?? value.replace('Key', '');
/** A skill's how-to line with the player's own key in it; on touch, its button. */
export const howToLine = (text: string, key: string) => text.replaceAll('{key}', key);

function cooldownOf(id: SkillId, p: Player): number {
  // Kit skills keep their own clocks; the ones without one are ready whenever the blade is free.
  if (id in KIT) return kitCooldown(p, id);
  switch (id) {
    case 'mage.magicShield': return p.magicShieldCd;
    case 'mage.ice': return p.iceCd;
    case 'mage.blackHole': return p.blackHoleCd;
    case 'necromancer.summon': return p.summonCd;
    case 'common.dash': case 'mage.blink': case 'guardian.dash': return p.dashCd;
    case 'archer.trap': return p.trapCd;
    case 'archer.volley': return p.volleyCd;
    case 'archer.dagger': return p.swordCd;
    default: return p.shotCd;
  }
}
function maxCooldown(id: SkillId, classId: ClassId) {
  if (id === 'archer.arrow' || id === 'mage.fireball' || id === 'necromancer.fire')
    return projectileSkillStats(id, classId).cooldown;
  if (id === 'archer.dagger') return CLASSES[classId].meleeCooldown;
  return SKILLS[id].cooldown || 1;
}
/** What a card says when it is off cooldown: a charge, the shield's seals, an active state. */
function detailOf(id: SkillId, p: Player): string | null {
  if (id === 'mage.magicShield') return p.magicShieldHits ? `${p.magicShieldHits}/${RULES.magicShieldHits}` : null;
  if (id === 'mage.blink') return p.blinkCharge > 0 ? percent(p.blinkCharge / RULES.mageBlinkChargeTime) : null;
  if (id === 'mage.blackHole') return p.blackHoleCharge > 0 ? percent(blackHoleStats(p.blackHoleCharge).power) : null;
  if (id === 'archer.trap') return p.trapLeft > 0 ? 'Preparando' : null;
  // The awakening shows the seconds it has left.
  if (id === 'guardian.fury') return p.empowered === 'awaken' ? `${p.furyLeft.toFixed(1)}s` : null;
  if (id === 'vanguard.reinforce') return p.empowered === 'reinforce' ? `${p.furyLeft.toFixed(1)}s` : null;
  if (id === 'vanguard.counter') return p.counterLeft > 0 ? 'Activo' : null;
  // A kit skill says how far its charge has gone (past 100 % when it overcharges), then the move
  // it is performing.
  if (id in KIT) {
    if (p.chargeSkill === id) {
      const over = overcharge(KIT[id].charge, p.chargeT);
      return over > 0 ? `${100 + Math.round(over * 100)} %` : percent(chargeProgress(KIT[id].charge, p.chargeT));
    }
    return p.move.startsWith(`${id}:`) ? MOVES[p.move].name : null;
  }
  return null;
}
/** Each ability's branches: what a tap, a hold or a full charge does, lit while it applies. */
function tiersOf(id: SkillId, classId: ClassId): AbilityTier[] | undefined {
  const name = CARD_NAMES[id].toLowerCase();
  switch (id) {
    case 'archer.arrow':
      return [
        { label: 'Toque · flecha', active: (p) => tapped(p.shotCharge) },
        {
          label: 'Mantener 0,8 s · flecha cargada',
          active: (p) => p.shotCharge >= RULES.overchargeTap && !windFull(p),
          state: (p) => (p.shotCharge > 0 ? percent(p.shotCharge / RULES.chargeTime) : null),
        },
        { label: 'Carga completa · flecha de viento', active: windFull },
      ];
    case 'mage.fireball': case 'necromancer.fire':
      return [
        { label: `Toque · ${name}`, active: (p) => tapped(p.shotCharge) },
        {
          label: classId === 'mage' ? 'Mantener · gran bola explosiva' : 'Mantener · bola de fuego gigante',
          active: (p) => p.shotCharge >= RULES.overchargeTap,
          state: (p) => (p.shotCharge > 0 ? percent(chargePower(p.shotCharge)) : null),
        },
      ];
    case 'guardian.fury':
      return [
        {
          label: `${KNIGHT_AWAKEN.duration} s de relámpago violeta · +${Math.round((KNIGHT_AWAKEN.damage - 1) * 100)} % de daño`,
          active: (p) => p.empowered === 'awaken',
          state: (p) => (p.empowered === 'awaken' ? `${p.furyLeft.toFixed(1)}s` : null),
        },
      ];
    case 'mage.blink':
      return [
        {
          label: 'Mantener y soltar · 0,5–2 s · hasta 260 u',
          active: (p) => p.blinkCharge > 0,
          state: (p) => (p.blinkCharge > 0 ? percent(p.blinkCharge / RULES.mageBlinkChargeTime) : null),
        },
      ];
    case 'common.dash':
      return [
        { label: 'Toque · esquivar', active: (p) => tapped(p.specialCharge) },
        {
          label: 'Mantener · dash largo',
          active: (p) => p.specialCharge >= RULES.overchargeTap,
          state: (p) => (p.specialCharge > 0 ? percent(chargePower(p.specialCharge)) : null),
        },
      ];
    case 'necromancer.summon':
      return [
        {
          label: 'Toque · 2 zombies',
          active: (p) => tapped(p.specialCharge) && p.fallenGuards === 0,
          state: (p) => `${p.activeExecutions}/${RULES.zombieExecutions}`,
        },
        {
          label: 'Cayó uno del círculo rojo · zombie con espada',
          active: (p) => p.fallenGuards > 0,
          state: (p) => (p.fallenGuards > 0 ? `×${p.fallenGuards}` : null),
        },
        {
          label: 'Mantener · zombie mago',
          active: (p) => p.specialCharge >= RULES.overchargeTap && p.specialCharge < RULES.overchargeTime,
          state: (p) => (p.hatAlive ? 'Vivo' : null),
        },
        {
          label: 'Aura llena · resucitar (0,5 s quieto)',
          active: (p) => p.specialCharge >= RULES.overchargeTime,
          state: (p) =>
            p.specialCharge >= RULES.overchargeTime
              ? percent(p.specialCharge / RULES.raiseCharge)
              : p.thrallAlive
                ? 'Esclavo'
                : p.thrallCd > 0
                  ? `${Math.ceil(p.thrallCd)}s`
                  : null,
        },
      ];
    case 'archer.volley':
      return [
        { label: 'Toque · 3 flechas en fila' },
        { label: 'Cargando clic · 3 al 33 %', active: (p) => p.shotCharge >= RULES.overchargeTap && !windFull(p) },
        { label: 'Durante el dash · 3 flechas de viento', active: (p) => p.windDash > 0 },
      ];
    case 'mage.ice':
      return [{ label: 'Inmoviliza 1 s' }];
    case 'vanguard.counter':
      return [
        { label: 'De frente · lo devuelve hacia quien lo lanzó', active: (p) => p.counterLeft > 0 },
        { label: 'Cuerpo a cuerpo · lo frena y lo hace tambalear', active: (p) => p.counterLeft > 0 },
        { label: `Si falla · ${String(WARRIOR_PARRY.cooldown).replace('.', ',')} s de recarga` },
      ];
    case 'vanguard.reinforce':
      return [
        {
          label: `${WARRIOR_REINFORCE.duration} s · −${Math.round((1 - WARRIOR_REINFORCE.taken) * 100)} % de daño, nada lo empuja`,
          active: (p) => p.empowered === 'reinforce',
          state: (p) => (p.empowered === 'reinforce' ? `${p.furyLeft.toFixed(1)}s` : null),
        },
      ];
    default:
      return kitTiers(id);
  }
}
/**
 * The branches of a kit skill, straight from its charge data: one line per state, lit while the
 * hold is in it. A chain adds which of its cuts comes next.
 */
function kitTiers(id: SkillId): AbilityTier[] | undefined {
  const skill = KIT[id];
  if (!skill || skill.instant) return undefined;
  const tiers: AbilityTier[] = skill.charge.tiers.map((tier, index) => ({
    label: tier.label,
    active: (p) => p.chargeSkill === id && chargeTier(skill.charge, p.chargeT).index === index,
  }));
  if (skill.chain > 1)
    tiers.unshift({
      label: `Cadena de ${skill.chain} · el último remata`,
      active: (p) => p.comboLeft > 0,
      state: (p) => `${p.combo + 1}/${skill.chain}`,
    });
  return tiers;
}

function skillCard(classId: ClassId, id: SkillId, slot: SkillSlot, key: string): AbilitySlot {
  return {
    id: ABILITY_IDS[id],
    skillId: id,
    logicalSlot: slot,
    key,
    name: CARD_NAMES[id],
    icon: iconFor(classId, id),
    cooldown: (p) => cooldownOf(id, p),
    max: maxCooldown(id, classId),
    detail: (p) => detailOf(id, p),
    tiers: tiersOf(id, classId),
    howTo: howToLine(SKILLS[id].howTo, key),
    howToTouch: howToLine(SKILLS[id].howTo, 'su botón'),
    cost: skillCost(id),
  };
}
function companionCard(action: Companion, key: string): AbilitySlot {
  return {
    id: action === 'companionCommand' ? 'command' : 'mark',
    companion: action,
    key,
    name: COMPANION_NAMES[action],
    icon: skillIcon(action === 'companionCommand' ? 'necromancer-mage' : 'necromancer-resurrection'),
    cooldown: () => 0,
    max: 1,
    detail: action === 'companionCommand' ? (p) => (p.zombieAuto ? 'Auto' : 'Mando') : undefined,
    tiers:
      action === 'companionCommand'
        ? [
            { label: 'Zombies normales · círculo rojo contigo', active: (p) => !p.zombieAuto },
            { label: 'Mago, lacayos y esclavo · mouse', active: (p) => !p.zombieAuto },
            { label: 'Automático · atacan solos', active: (p) => p.zombieAuto },
          ]
        : [{ label: 'Sobre un zombie · cambia de círculo' }, { label: 'Rojo contigo ↔ violeta al mouse' }],
    howTo: howToLine(COMPANION_HOW_TO[action], key),
    howToTouch:
      action === 'companionCommand'
        ? 'Tocá su botón para alternar zombies automáticos o a tu mando; mantenelo para marcar.'
        : undefined,
  };
}
const lockedCard = (slot: SkillSlot, key: string): AbilitySlot => ({
  id: `locked-${slot}`,
  logicalSlot: slot,
  key,
  name: '—',
  icon: '',
  cooldown: () => 0,
  max: 1,
  locked: true,
});

/**
 * Every class's cards, in the universal positions. An empty position becomes a locked card, unless
 * the summon's Mando or Marcar is bound to its key (the necromancer's free E and M2); a companion
 * bound anywhere else gets a card of its own at the end.
 */
export function abilityCards(
  p: Pick<Player, 'classId' | 'loadout'>,
  bindings: InputBindings = DEFAULT_BINDINGS[p.classId],
  order: readonly SkillSlot[] = LAYOUT,
): AbilitySlot[] {
  const summon = Object.values(p.loadout).includes('necromancer.summon');
  const placed = new Set<Companion>();
  const cards = order.map((slot) => {
    const id = p.loadout[slot];
    const key = bindingLabel(bindings[slot]);
    if (id) return skillCard(p.classId, id, slot, key);
    const companion = summon ? COMPANIONS.find((action) => !placed.has(action) && bindings[action] === bindings[slot]) : undefined;
    if (!companion) return lockedCard(slot, key);
    placed.add(companion);
    return { ...companionCard(companion, key), logicalSlot: slot };
  });
  if (summon)
    for (const action of COMPANIONS) if (!placed.has(action)) cards.push(companionCard(action, bindingLabel(bindings[action])));
  return cards;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/**
 * The ability bar: the same seven positions for every class (M1 M2 · Q E F R, Space below), each
 * card with its icon, name, real key, cooldown, availability and, where a mode has mana, its cost.
 * Tap and hold branches grow above the cards.
 */
export function updateAbilities(root: HTMLElement, p: Player, bindings: InputBindings = DEFAULT_BINDINGS[p.classId], holeLive = false) {
  const slots = abilityCards(p, bindings);
  const signature = `${p.classId}:${Object.values(p.loadout).join('|')}:${Object.values(bindings).join('|')}`;
  if (root.dataset.class !== signature) {
    root.dataset.class = signature;
    root.replaceChildren(
      ...slots.map((slot) => {
        const branch = element('div', 'ability-branch');
        // Its place in the universal layout (the customizer's cards own `data-slot`).
        if (slot.logicalSlot) branch.dataset.position = slot.logicalSlot;
        if (slot.tiers)
          branch.append(
            Object.assign(element('ul', 'ability-tree'), {
              ariaLabel: `Árbol de ${slot.name}`,
            }),
          );
        for (const tier of slot.tiers ?? []) {
          const item = element('li', '', tier.label);
          item.append(element('b', 'tier-state'));
          branch.querySelector('ul')!.append(item);
        }
        const card = element('div', 'ability');
        card.dataset.ability = slot.id;
        card.dataset.locked = String(!!slot.locked);
        if (slot.howTo) card.title = slot.howTo;
        // A chain shows the cut that comes next; every other skill, its art.
        const icon = slot.locked
          ? element('span', 'ability-icon ability-empty', '—')
          : hasFaces(slot.skillId)
            ? element('span', 'ability-icon ability-face')
            : document.createElement('img');
        if (icon instanceof HTMLImageElement) {
          icon.className = 'ability-icon';
          icon.src = slot.icon;
          icon.alt = '';
        }
        icon.setAttribute('aria-hidden', 'true');
        card.append(
          icon,
          element('span', 'ability-state'),
          element('span', 'ability-cd'),
          element('span', 'ability-mana', slot.cost?.resource === 'mana' ? `${slot.cost.amount} M` : ''),
          element('kbd', '', slot.key),
          element('small', '', slot.locked ? 'Sin habilidad' : slot.name),
        );
        branch.append(card);
        return branch;
      }),
    );
  }
  root.querySelectorAll<HTMLElement>('.ability-branch').forEach((branch, i) => {
    const slot = slots[i],
      card = branch.querySelector<HTMLElement>('.ability')!;
    if (slot.locked) {
      card.dataset.ready = 'false';
      card.setAttribute('aria-label', `${slot.key} · sin habilidad`);
      return;
    }
    const left = slot.cooldown(p),
      detail = slot.detail?.(p) ?? null,
      // A Singularidad in flight: pressing again implodes it, while its cooldown runs in parallel.
      live = holeLive && slot.id === 'black-hole',
      // Only modes with mana can leave a skill unpaid; the arenas never do.
      paid = !slot.skillId || affordable(p, slot.skillId);
    card.dataset.ready = String(paid && (left <= 0 || live));
    card.dataset.live = String(live);
    card.dataset.unpaid = String(!paid);
    card.style.setProperty('--cd', String(live ? 0 : Math.min(1, left / slot.max)));
    card.querySelector('.ability-state')!.textContent = live ? 'Detonar' : left > 0 ? `${left.toFixed(1)}s` : (detail ?? '');
    card.querySelector('.ability-cd')!.textContent = live && left > 0 ? `${left.toFixed(1)}s` : '';
    const lacking = `sin maná (${slot.cost?.amount} M)`;
    if (hasFaces(slot.skillId)) showFace(card.querySelector<HTMLElement>('.ability-face')!, p, slot.skillId);
    card.setAttribute('aria-label', `${slot.name} · ${slot.key} · ${!paid ? lacking : live ? `detonar · recarga ${left.toFixed(1)} s` : left > 0 ? `${left.toFixed(1)} s` : 'lista'}`);
    branch.querySelectorAll('li').forEach((item, j) => {
      const tier = slot.tiers![j];
      item.dataset.active = String(tier.active?.(p) ?? false);
      item.querySelector('b')!.textContent = tier.state?.(p) ?? '';
    });
  });
}
