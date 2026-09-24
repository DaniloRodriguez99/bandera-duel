import { CLASSES, RULES, SKILLS, SKILL_SLOTS, chargePower, projectileStats, type ClassId, type InputBindings, type PhysicalBinding, type Player, type SkillId } from '@bandera/shared';

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

const skillIcon = (name: string) => `/assets/skills/${name}.png`;

const percent = (value: number) => `${Math.round(Math.min(1, value) * 100)} %`;
const tapped = (charge: number) => charge > 0 && charge < RULES.overchargeTap;
/** A full primary charge becomes wind; every active archer dash empowers the triple shot. */
const windFull = (p: Player) => p.shotCharge >= RULES.chargeTime - 1e-8;

/** Abilities in panel order: click first, then space, then the class extras. */
export function abilitySlots(classId: ClassId): AbilitySlot[] {
  const stats = CLASSES[classId];
  const slots: AbilitySlot[] = [];
  if (stats.ranged) {
    const [name, icon] =
      classId === 'mage'
        ? ['Bola de fuego', skillIcon('mage-fireball')]
        : classId === 'necromancer'
          ? ['Fuego', skillIcon('necromancer-fire')]
          : ['Flecha', skillIcon('archer-arrow')];
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
                active: (p) => p.shotCharge >= RULES.overchargeTap && !windFull(p),
                state: (p) => (p.shotCharge > 0 ? percent(p.shotCharge / RULES.chargeTime) : null),
              },
              { label: 'Carga completa · flecha de viento', active: windFull },
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
      icon: skillIcon(classId === 'vanguard' ? 'vanguard-sword' : 'guardian-slash'),
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
      name: classId === 'guardian' ? 'Embestida' : classId === 'mage' ? 'Parpadeo' : 'Esquivar',
      icon: skillIcon(
        classId === 'archer'
          ? 'archer-wind'
          : classId === 'mage'
            ? 'mage-blink'
            : classId === 'vanguard'
              ? 'vanguard-dash'
              : 'guardian-bash',
      ),
      cooldown: (p) => p.dashCd,
      max: classId === 'guardian' ? RULES.guardianDashCooldown : RULES.dashCooldown,
      tiers:
        classId === 'guardian'
          ? [{ label: '190 u · 1 daño · sin invulnerabilidad', active: (p) => p.dashLeft > 0 }]
          : classId === 'mage'
            ? [{ label: 'Pulsar · teletransporte corto', active: (p) => p.dashCd <= 0 }]
          : [
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
        icon: skillIcon('necromancer-summon'),
        cooldown: (p) => p.summonCd,
        max: RULES.summonCooldown,
        tiers: [
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
        ],
      },
      {
        id: 'command',
        key: 'E',
        name: 'Mando',
        icon: skillIcon('necromancer-mage'),
        cooldown: () => 0,
        max: 1,
        detail: (p) => (p.zombieAuto ? 'Auto' : 'Mando'),
        tiers: [
          { label: 'Zombies normales · círculo rojo contigo', active: (p) => !p.zombieAuto },
          { label: 'Mago, lacayos y esclavo · mouse', active: (p) => !p.zombieAuto },
          { label: 'Automático · atacan solos', active: (p) => p.zombieAuto },
        ],
      },
      {
        id: 'mark',
        key: '⌘ E',
        name: 'Marcar',
        icon: skillIcon('necromancer-resurrection'),
        cooldown: () => 0,
        max: 1,
        tiers: [{ label: 'Sobre un zombie · cambia de círculo' }, { label: 'Rojo contigo ↔ violeta al mouse' }],
      },
    );
  if (classId === 'archer')
    slots.push(
      { id: 'dagger', key: 'CLIC DER.', name: 'Daga', icon: skillIcon('archer-arrow'), cooldown: (p) => p.swordCd, max: stats.meleeCooldown },
      {
        id: 'trap',
        key: 'Q',
        name: 'Trampa',
        icon: skillIcon('archer-trap'),
        cooldown: (p) => p.trapCd,
        max: RULES.trapCooldown,
        detail: (p) => (p.trapLeft > 0 ? 'Preparando' : null),
      },
      {
        id: 'volley',
        key: 'E',
        name: 'Triple',
        icon: skillIcon('archer-volley'),
        cooldown: (p) => p.volleyCd,
        max: RULES.volleyCooldown,
        tiers: [
          { label: 'Toque · 3 flechas en fila' },
          { label: 'Cargando clic · 3 al 33 %', active: (p) => p.shotCharge >= RULES.overchargeTap && !windFull(p) },
          { label: 'Durante el dash · 3 flechas de viento', active: (p) => p.windDash > 0 },
        ],
      },
    );
  if (classId === 'mage')
    slots.push({
      id: 'magic-shield',
      key: 'CLIC DER.',
      name: 'Escudo mágico',
      icon: skillIcon('mage-shield'),
      cooldown: (p) => p.magicShieldCd,
      max: RULES.magicShieldCooldown,
      detail: (p) => (p.magicShieldHits > 0 ? `${p.magicShieldHits}/${RULES.magicShieldHits}` : null),
    });
  if (classId === 'mage')
    slots.push({
      id: 'ice',
      key: 'CLIC 3',
      name: 'Flecha de hielo',
      icon: skillIcon('mage-ice'),
      cooldown: (p) => p.iceCd,
      max: RULES.iceCooldown,
      tiers: [{ label: 'Clic central · inmoviliza 1 s' }],
    });
  if (stats.shield)
    slots.push({
      id: 'guard',
      key: 'CLIC DER.',
      name: 'Guardia continua',
      icon: skillIcon('guardian-shield'),
      cooldown: (p) => p.guardCd,
      max: RULES.guardCooldown,
      detail: (p) => (p.guarding ? 'Bloqueando · 45 % velocidad' : null),
      tiers: [{ label: 'Mantener · bloqueo frontal de 120°', active: (p) => p.guarding }],
    });
  if (classId === 'guardian')
    slots.push(
      {
        id: 'shield-bash',
        key: 'Q',
        name: 'Golpe de escudo',
        icon: skillIcon('guardian-bash'),
        cooldown: (p) => p.shieldBashCd,
        max: RULES.shieldBashCooldown,
        detail: (p) => (p.shieldBashLeft > 0 ? 'Golpeando' : null),
        tiers: [{ label: '0,5 daño · empujón · aturde 1,5 s', active: (p) => p.shieldBashLeft > 0 }],
      },
      {
        id: 'fury',
        key: 'E',
        name: 'Furia',
        icon: skillIcon('guardian-fury'),
        cooldown: (p) => p.furyCd,
        max: RULES.furyCooldown,
        detail: (p) => (p.furyLeft > 0 ? `${p.furyLeft.toFixed(1)}s activa` : null),
        tiers: [
          {
            label: '5 s · espada +40 % daño',
            active: (p) => p.furyLeft > 0,
            state: (p) => (p.furyLeft > 0 ? `${p.furyLeft.toFixed(1)}s` : null),
          },
        ],
      },
    );
  if (classId === 'vanguard')
    slots.push({
      id: 'slash',
      key: 'Q',
      name: 'Tajo viajero',
      icon: skillIcon('vanguard-slash'),
      cooldown: (p) => p.slashCd,
      max: RULES.slashCooldown,
    }, {
      id: 'counter',
      key: 'E',
      name: 'Contraataque',
      icon: skillIcon('vanguard-counter'),
      cooldown: (p) => p.counterCd,
      max: RULES.counterCooldown,
      detail: (p) => (p.counterLeft > 0 ? 'Activo' : null),
      tiers: [
        {
          label: 'Toque · devuelve proyectiles',
          active: (p) => p.counterLeft > 0 && p.counterCharge < RULES.counterChargeTime - 1e-8,
        },
        {
          label: 'Mantener 1 s · doble de rápido y fuerte',
          active: (p) => p.counterCharge >= RULES.counterChargeTime - 1e-8,
          state: (p) => (p.counterLeft > 0 ? percent(p.counterCharge / RULES.counterChargeTime) : null),
        },
      ],
    });
  return slots;
}

const dynamicCooldown=(id:SkillId,p:Player)=>id==='mage.magicShield'?p.magicShieldCd:id==='mage.ice'?p.iceCd:id==='mage.blackHole'?p.blackHoleCd:id==='necromancer.summon'?p.summonCd:id==='common.dash'||id==='mage.blink'?p.dashCd:p.shotCd;
const shortBinding=(value:PhysicalBinding)=>({MouseLeft:'CLIC',MouseRight:'CLIC DER.',MouseMiddle:'CLIC 3',Space:'ESPACIO',Shift:'SHIFT',Ctrl:'CTRL'} as Record<string,string>)[value]??value.replace('Key','');
export function playerAbilitySlots(p:Player,bindings?:InputBindings):AbilitySlot[]{
  const order=(['primary','mobility','secondary','skill1','skill2'] as const);
  const legacyId:Partial<Record<SkillId,string>>={'mage.fireball':'shot','common.dash':'dash','mage.blink':'dash','mage.blackHole':'black-hole','mage.magicShield':'magic-shield','mage.ice':'ice','necromancer.fire':'shot','necromancer.summon':'summon'};
  const legacyName:Partial<Record<SkillId,string>>={'mage.ice':'Flecha de hielo'};
  const cards:AbilitySlot[]=order.flatMap(slot=>{const id=p.loadout[slot];if(!id)return[];const skill=SKILLS[id];return [{id:legacyId[id]??id,key:bindings?shortBinding(bindings[slot]):slot.toUpperCase(),name:legacyName[id]??skill.name,icon:skillIcon(skill.icon),cooldown:(player:Player)=>dynamicCooldown(id,player),max:skill.cooldown||1,detail:(player:Player)=>id==='mage.magicShield'&&player.magicShieldHits?`${player.magicShieldHits}/${RULES.magicShieldHits}`:null,tiers:id==='necromancer.summon'?[{label:'Incluye Mando, Marcar y todas las invocaciones'}]:undefined} satisfies AbilitySlot];});
  if(Object.values(p.loadout).includes('necromancer.summon'))cards.push({id:'command',key:bindings?shortBinding(bindings.companionCommand):'MANDO',name:'Mando / Marcar',icon:skillIcon('necromancer-resurrection'),cooldown:()=>0,max:1,tiers:[{label:'Toque: Mando · Ctrl + tecla: Marcar'}]});
  return cards;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** Each ability is a card with its key and cooldown; its tap/hold branches grow above it. */
export function updateAbilities(root: HTMLElement, p: Player,bindings?:InputBindings) {
  const slots = p.classId==='mage'?playerAbilitySlots(p,bindings):abilitySlots(p.classId);
  const signature=p.classId==='mage'?`${p.classId}:${SKILL_SLOTS.map(slot=>p.loadout[slot]).join('|')}:${bindings?SKILL_SLOTS.map(slot=>bindings[slot]).join('|'):''}`:p.classId;
  if (root.dataset.class !== signature) {
    root.dataset.class = signature;
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
        const icon = document.createElement('img');
        icon.className = 'ability-icon';
        icon.src = slot.icon;
        icon.alt = '';
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
