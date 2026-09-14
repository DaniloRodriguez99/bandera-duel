import { CLASSES, RULES, chargePower, projectileStats, type ClassId, type Player } from '@bandera/shared';

/** One branch of an ability: what a tap, a hold or a full charge does. */
export interface AbilityTier {
  label: string;
  active?: (p: Player) => boolean;
  state?: (p: Player) => string | null;
}

export interface AbilitySlot {
  id: string;
  key: string;
  name: string;
  icon: string;
  cooldown: (p: Player) => number;
  max: number;
  detail?: (p: Player) => string | null;
  tiers?: AbilityTier[];
}

const percent = (value: number) => `${Math.round(Math.min(1, value) * 100)} %`;
const tapped = (charge: number) => charge > 0 && charge < RULES.overchargeTap;
const COMMAND_NAMES = { violet: 'Violeta', red: 'Rojo', auto: 'Auto' } as const;

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
      tiers:
        classId === 'archer'
          ? [
              { label: 'Toque · flecha', active: (p) => tapped(p.shotCharge) },
              {
                label: 'Mantener 0,8 s · flecha cargada',
                active: (p) => p.shotCharge >= RULES.overchargeTap,
                state: (p) => (p.shotCharge > 0 ? percent(p.shotCharge / RULES.chargeTime) : null),
              },
            ]
          : [
              { label: `Toque · ${name.toLowerCase()}`, active: (p) => tapped(p.shotCharge) },
              {
                label: classId === 'mage' ? 'Mantener · gran bola explosiva' : 'Mantener · bola de fuego gigante',
                active: (p) => p.shotCharge >= RULES.overchargeTap,
                state: (p) => (p.shotCharge > 0 ? percent(chargePower(p.shotCharge)) : null),
              },
            ],
    });
  } else
    slots.push({
      id: 'sword',
      key: 'CLIC',
      name: classId === 'vanguard' ? 'Espada pesada' : 'Espada',
      icon: '⚔',
      cooldown: (p) => p.swordCd,
      max: stats.meleeCooldown,
      tiers: [
        { label: 'Toque · golpe', active: (p) => tapped(p.shotCharge) },
        {
          label: 'Mantener · golpe cargado',
          active: (p) => p.shotCharge >= RULES.overchargeTap,
          state: (p) => (p.shotCharge > 0 ? percent(chargePower(p.shotCharge)) : null),
        },
      ],
    });
  if (stats.dash)
    slots.push({
      id: 'dash',
      key: 'ESPACIO',
      name: 'Esquivar',
      icon: '➟',
      cooldown: (p) => p.dashCd,
      max: RULES.dashCooldown,
      tiers: [
        { label: 'Toque · esquivar', active: (p) => tapped(p.specialCharge) },
        {
          label: 'Mantener · dash largo',
          active: (p) => p.specialCharge >= RULES.overchargeTap,
          state: (p) => (p.specialCharge > 0 ? percent(chargePower(p.specialCharge)) : null),
        },
      ],
    });
  if (stats.summon)
    slots.push(
      {
        id: 'summon',
        key: 'ESPACIO',
        name: 'Invocar zombies',
        icon: '☠',
        cooldown: (p) => p.summonCd,
        max: RULES.summonCooldown,
        tiers: [
          {
            label: 'Toque · 2 zombies',
            active: (p) => tapped(p.specialCharge),
            state: (p) => `${p.activeExecutions}/${RULES.zombieExecutions}`,
          },
          {
            label: 'Mantener · zombie mago',
            active: (p) => p.specialCharge >= RULES.overchargeTap && p.specialCharge < RULES.overchargeTime,
            state: (p) => (p.hatAlive ? 'Vivo' : null),
          },
          {
            label: 'Aura llena · resucitar',
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
        ],
      },
      {
        id: 'command',
        key: 'E',
        name: 'Mando',
        icon: '⚑',
        cooldown: () => 0,
        max: 1,
        detail: (p) => COMMAND_NAMES[p.zombieCommand],
        tiers: [
          { label: 'Violetas siguen el mouse', active: (p) => p.zombieCommand === 'violet' },
          { label: 'Rojos siguen el mouse', active: (p) => p.zombieCommand === 'red' },
          { label: 'Todos atacan solos', active: (p) => p.zombieCommand === 'auto' },
        ],
      },
      {
        id: 'mark',
        key: '⌘ E',
        name: 'Marcar',
        icon: 'E',
        cooldown: () => 0,
        max: 1,
        tiers: [{ label: 'Sobre un zombie · grupo rojo' }, { label: 'Otra vez · vuelve a violeta' }],
      },
    );
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

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** Each ability is a card with its key and cooldown; its tap/hold branches grow above it. */
export function updateAbilities(root: HTMLElement, p: Player) {
  const slots = abilitySlots(p.classId);
  if (root.dataset.class !== p.classId) {
    root.dataset.class = p.classId;
    root.replaceChildren(
      ...slots.map((slot) => {
        const branch = element('div', 'ability-branch');
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
        const icon = element('span', 'ability-icon', slot.icon);
        icon.setAttribute('aria-hidden', 'true');
        card.append(icon, element('span', 'ability-state'), element('kbd', '', slot.key), element('small', '', slot.name));
        branch.append(card);
        return branch;
      }),
    );
  }
  root.querySelectorAll<HTMLElement>('.ability-branch').forEach((branch, i) => {
    const slot = slots[i],
      card = branch.querySelector<HTMLElement>('.ability')!,
      left = slot.cooldown(p),
      detail = slot.detail?.(p) ?? null;
    card.dataset.ready = String(left <= 0);
    card.style.setProperty('--cd', String(Math.min(1, left / slot.max)));
    card.querySelector('.ability-state')!.textContent = left > 0 ? `${left.toFixed(1)}s` : (detail ?? '');
    card.setAttribute('aria-label', `${slot.name} · ${slot.key} · ${left > 0 ? `${left.toFixed(1)} s` : 'lista'}`);
    branch.querySelectorAll('li').forEach((item, j) => {
      const tier = slot.tiers![j];
      item.dataset.active = String(tier.active?.(p) ?? false);
      item.querySelector('b')!.textContent = tier.state?.(p) ?? '';
    });
  });
}
