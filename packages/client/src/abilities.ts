import { CLASSES, RULES, projectileStats, type ClassId, type Player } from '@bandera/shared';

export interface AbilitySlot {
  id: string;
  key: string;
  name: string;
  icon: string;
  cooldown: (p: Player) => number;
  max: number;
  detail?: (p: Player) => string | null;
}

/** Abilities in panel order: click first, then space, then the class extras. */
export function abilitySlots(classId: ClassId): AbilitySlot[] {
  const stats = CLASSES[classId];
  const slots: AbilitySlot[] = [];
  if (stats.ranged) {
    const [name, icon] =
      classId === 'mage' ? ['Bola de fuego', '✦'] : classId === 'necromancer' ? ['Fuego', '✺'] : ['Flecha', '➶'];
    slots.push({
      id: 'shot',
      key: 'CLIC',
      name,
      icon,
      cooldown: (p) => p.shotCd,
      max: projectileStats(classId).cooldown,
      detail: (p) => (p.shotCharge > 0 ? `${Math.round((p.shotCharge / RULES.chargeTime) * 100)}%` : null),
    });
  } else
    slots.push({
      id: 'sword',
      key: 'CLIC',
      name: classId === 'vanguard' ? 'Espada pesada' : 'Espada',
      icon: '⚔',
      cooldown: (p) => p.swordCd,
      max: stats.meleeCooldown,
    });
  if (stats.dash)
    slots.push({ id: 'dash', key: 'ESPACIO', name: 'Esquivar', icon: '➟', cooldown: (p) => p.dashCd, max: RULES.dashCooldown });
  if (stats.summon)
    slots.push({
      id: 'summon',
      key: 'ESPACIO',
      name: 'Invocar zombies',
      icon: '☠',
      cooldown: (p) => p.summonCd,
      max: RULES.summonCooldown,
    });
  if (classId === 'archer')
    slots.push(
      { id: 'dagger', key: 'CLIC DER.', name: 'Daga', icon: '†', cooldown: (p) => p.swordCd, max: stats.meleeCooldown },
      {
        id: 'trap',
        key: 'Q',
        name: 'Trampa',
        icon: '⌖',
        cooldown: (p) => p.trapCd,
        max: RULES.trapCooldown,
        detail: (p) => (p.trapLeft > 0 ? 'Preparando' : null),
      },
      { id: 'volley', key: 'E', name: 'Triple', icon: '⋔', cooldown: (p) => p.volleyCd, max: RULES.volleyCooldown },
    );
  if (classId === 'mage')
    slots.push({
      id: 'magic-shield',
      key: 'CLIC DER.',
      name: 'Escudo mágico',
      icon: '⛨',
      cooldown: (p) => p.magicShieldCd,
      max: RULES.magicShieldCooldown,
      detail: (p) => (p.magicShieldHits > 0 ? `${p.magicShieldHits}/${RULES.magicShieldHits}` : null),
    });
  if (stats.shield)
    slots.push({
      id: 'guard',
      key: 'CLIC DER.',
      name: 'Escudo',
      icon: '⛨',
      cooldown: (p) => p.guardCd,
      max: RULES.guardCooldown,
      detail: (p) => (p.guarding ? 'Cubriendo' : null),
    });
  return slots;
}

export function updateAbilities(root: HTMLElement, p: Player) {
  const slots = abilitySlots(p.classId);
  if (root.dataset.class !== p.classId) {
    root.dataset.class = p.classId;
    root.replaceChildren(
      ...slots.map((slot) => {
        const card = document.createElement('div');
        card.className = 'ability';
        card.dataset.ability = slot.id;
        const icon = document.createElement('span');
        icon.className = 'ability-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = slot.icon;
        const state = document.createElement('span');
        state.className = 'ability-state';
        const key = document.createElement('kbd');
        key.textContent = slot.key;
        const name = document.createElement('small');
        name.textContent = slot.name;
        card.append(icon, state, key, name);
        return card;
      }),
    );
  }
  root.querySelectorAll<HTMLElement>('.ability').forEach((card, i) => {
    const slot = slots[i],
      left = slot.cooldown(p),
      detail = slot.detail?.(p) ?? null;
    card.dataset.ready = String(left <= 0);
    card.style.setProperty('--cd', String(Math.min(1, left / slot.max)));
    card.querySelector('.ability-state')!.textContent = left > 0 ? `${left.toFixed(1)}s` : (detail ?? '');
    card.setAttribute('aria-label', `${slot.name} · ${slot.key} · ${left > 0 ? `${left.toFixed(1)} s` : 'lista'}`);
  });
}
