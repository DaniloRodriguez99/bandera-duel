import type { Player } from '@bandera/shared';
import {
  AFFINITIES,
  AFFINITY_NAMES,
  AFFINITY_TEXT,
  STAT_TEXT,
  ARCANE,
  MONSTER_TREES,
  RANKS,
  RARITY_NAMES,
  SKILLS_WORLD,
  STAT_NAMES,
  canLearn,
  effectiveSkill,
  refusalFor,
  schoolOpen,
  rankOf,
  skillName,
  usesToLevel,
  type Affinity,
  type Rarity,
  type WorldSkill,
} from '@bandera/shared/rpg/skills';
import { xpToLevel, STAT_IDS, type StatId } from '@bandera/shared/rpg/progression';
import {
  EQUIP_SLOTS,
  INVENTORY_SIZE,
  ITEMS,
  describeBonus,
  describeGrimoire,
  equipmentBonus,
  type EquipSlot,
  type ItemInstance,
} from '@bandera/shared/rpg/items';
import { CHEST_TIERS } from '@bandera/shared/rpg/loot';
import {
  CAST_SLOTS,
  SLOT_LEVEL,
  SLOT_NAMES,
  SPARKS,
  WEAPONS,
  WEAPON_IDS,
  type CastSlot,
  type Character,
  type ChestView,
  type Creation,
  type Notice,
  type Weapon,
} from '@bandera/shared/world';

/**
 * The world's HUD, drawn in the language of isekai: the System.
 *
 * Skills are not cards with labels floating over the battlefield. They sit in a compact bar framed
 * by their rarity, breathe while ready, flash when they come back, and shout their name when they
 * are cast. Everything the System has to say slides in as its own window. Nothing here paints text
 * over the game itself.
 */

export interface WorldHudActions {
  cast(slot: CastSlot): void;
  learn(skillId: string, nodeId: string): void;
  slot(slot: CastSlot, skillId: string | null): void;
  spend(stat: StatId): void;
  equip(uid: string): void;
  unequip(slot: EquipSlot): void;
  use(uid: string, skillId?: string): void;
  discard(uid: string): void;
}

const SLOT_LABEL: Record<EquipSlot, string> = { weapon: 'Arma', armor: 'Armadura', amulet: 'Amuleto' };
const KIND_LABEL: Record<string, string> = { arma: 'Arma', armadura: 'Armadura', amuleto: 'Amuleto', grimorio: 'Grimorio' };

const RARITY_COLOR: Record<Rarity, string> = {
  comun: '#b9c6cf',
  rara: '#56b8ff',
  epica: '#b877ff',
  legendaria: '#ffc84d',
  unica: '#ff4f7a',
};

const WEAPON_ICON: Record<Weapon, string> = {
  espada: 'guardian-slash',
  baston: 'mage-fireball',
  arco: 'archer-arrow',
  daga: 'archer-trap',
  escudo: 'guardian-shield',
};

const AFFINITY_COLOR: Record<Affinity, string> = {
  fuego: '#ff7a2f',
  agua: '#7dd8ff',
  tierra: '#c9a36b',
  viento: '#d8fbff',
  rayo: '#f4f07a',
  sombra: '#a070e0',
  luz: '#fff1a8',
  fuerza: '#e0a060',
  destreza: '#8fe3b0',
  sigilo: '#6fbf8a',
};

const icon = (name: string) => `/assets/skills/${name}.png`;

/**
 * The Man-God as the books draw him: a slim, featureless white figure standing in the white void,
 * his face hidden behind a flickering mosaic nobody can see through.
 */
export const hitogamiSvg = (key: string) => {
  // Each copy owns its gradient and filter ids: a url(#id) resolving to a copy inside a hidden
  // section paints nothing, which left the figure invisible in the birth screen.
  let seed = 7;
  const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const greys = ['#eef1f7', '#d6dce7', '#bcc5d4', '#a3adbf', '#8c97ab', '#e2e6ee'];
  const tiles: string[] = [];
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++)
      tiles.push(
        `<rect class="mz" x="${44 + col * 4}" y="${17 + row * 4}" width="4" height="4" fill="${greys[Math.floor(next() * greys.length)]}" style="animation-delay:-${(next() * 1.6).toFixed(2)}s"/>`,
      );
  return `<svg class="hitogami" viewBox="0 0 120 200" role="img" aria-label="Hitogami">
    <defs>
      <radialGradient id="hg-glow"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".55" stop-color="#dfe7f7" stop-opacity=".35"/><stop offset="1" stop-color="#dfe7f7" stop-opacity="0"/></radialGradient>
      <clipPath id="hg-face"><circle cx="60" cy="33" r="15"/></clipPath>
      <radialGradient id="hg-halo"><stop offset="0" stop-color="#c7d2e8" stop-opacity=".9"/><stop offset=".7" stop-color="#dfe6f3" stop-opacity=".45"/><stop offset="1" stop-color="#eef2f9" stop-opacity="0"/></radialGradient>
      <linearGradient id="hg-body" x1="0" x2="1"><stop offset="0" stop-color="#e3e9f4"/><stop offset=".45" stop-color="#ffffff"/><stop offset="1" stop-color="#d7dfee"/></linearGradient>
      <filter id="hg-soft" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="3.5" flood-color="#6c7fa6" flood-opacity=".75"/></filter>
    </defs>
    <ellipse cx="60" cy="96" rx="56" ry="92" fill="url(#hg-halo)"/>
    <ellipse cx="60" cy="104" rx="58" ry="98" fill="url(#hg-glow)" opacity=".6"/>
    <ellipse cx="60" cy="194" rx="30" ry="4" fill="#8c97ab" opacity=".35"/>
    <g filter="url(#hg-soft)" fill="url(#hg-body)" stroke="#aeb9cf" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M45 62 Q34 90 36 121" fill="none" stroke="#aeb9cf" stroke-width="8.5"/>
      <path d="M45 62 Q34 90 36 121" fill="none" stroke="#f7f9fd" stroke-width="6.5"/>
      <path d="M75 62 Q86 90 84 121" fill="none" stroke="#aeb9cf" stroke-width="8.5"/>
      <path d="M75 62 Q86 90 84 121" fill="none" stroke="#f7f9fd" stroke-width="6.5"/>
      <rect x="55" y="45" width="10" height="11" rx="3"/>
      <path d="M44 58 Q60 51 76 58 L73 112 Q66 119 60 117 Q54 119 47 112 Z"/>
      <path d="M49 108 L47 192 L57 192 L60 134 L63 192 L73 192 L71 108 Z"/>
      <circle cx="60" cy="33" r="15"/>
    </g>
    <g clip-path="url(#hg-face)">${tiles.join('')}</g>
  </svg>`.replace(/hg-(glow|face|soft|halo|body)/g, `hg-${key}-$1`);
};
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const NOTICE_LIFE: Partial<Record<Notice['kind'], number>> = {
  evolution: 6500,
  steal: 7000,
  level: 5000,
  denied: 2200,
  learn: 3800,
  death: 6000,
  loot: 6000,
  item: 4200,
  kill: 4500,
  raise: 5000,
};

export class WorldHud {
  readonly root: HTMLElement;
  private sheet: Character | null = null;
  private player: Player | null = null;
  private cooldowns = new Map<CastSlot, { until: number; total: number }>();
  private slotEls = new Map<CastSlot | 'click', HTMLElement>();
  private callout: HTMLElement;
  private calloutTimer = 0;
  private notices: HTMLElement;
  private tooltip: HTMLElement;
  private panel: HTMLElement;
  private creation: HTMLElement;
  private revealPending = false;
  private tab: 'skills' | 'items' = 'skills';
  private selectedUid: string | null = null;
  /** Second click on "Tirar" within a few seconds actually throws it away. */
  private discardArmed: string | null = null;
  private channel: HTMLElement;
  private lootStrip: HTMLElement;

  constructor(
    stage: HTMLElement,
    private actions: WorldHudActions,
  ) {
    this.root = el('div', 'world-hud');
    this.root.id = 'world-hud';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="wh-status" aria-label="Estado">
        <div class="wh-ident"><b id="wh-name"></b><span id="wh-level" class="wh-level"></span></div>
        <div class="wh-bar hp" title="Vida"><i id="wh-hp"></i><span id="wh-hp-text"></span></div>
        <div class="wh-bar mp" title="Maná"><i id="wh-mp"></i><span id="wh-mp-text"></span></div>
        <div class="wh-bar xp" title="Experiencia"><i id="wh-xp"></i></div>
        <button type="button" id="wh-system" class="wh-system" aria-label="Abrir el Sistema">SISTEMA <kbd>K</kbd><b id="wh-owed" hidden></b></button>
      </div>
      <div id="wh-channel" class="wh-channel" hidden><span></span><i></i></div>
      <div id="skillbar" class="skillbar" aria-label="Habilidades"></div>
      <div id="wh-loot" class="wh-loot" hidden></div>
      <div id="wh-notices" class="wh-notices" aria-live="polite"></div>
      <div id="wh-callout" class="wh-callout" hidden aria-live="polite">
        <small id="wh-incantation"></small><strong id="wh-callout-name"></strong>
      </div>
      <div id="wh-tooltip" class="wh-tooltip" hidden></div>
      <section id="wh-panel" class="wh-panel" hidden aria-label="Sistema"></section>`;
    stage.append(this.root);
    this.callout = this.root.querySelector('#wh-callout')!;
    this.notices = this.root.querySelector('#wh-notices')!;
    this.tooltip = this.root.querySelector('#wh-tooltip')!;
    this.channel = this.root.querySelector('#wh-channel')!;
    this.lootStrip = this.root.querySelector('#wh-loot')!;
    this.panel = this.root.querySelector('#wh-panel')!;
    // The HUD is a stacking context under the chat button; the System window must open above it.
    stage.append(this.panel);
    this.root.querySelector<HTMLButtonElement>('#wh-system')!.onclick = () => this.togglePanel();

    this.creation = el('div', 'wh-creation');
    this.creation.id = 'wh-creation';
    this.creation.hidden = true;
    stage.append(this.creation);
    this.buildSkillbar();
  }

  show() {
    if (!this.root.hidden) return;
    this.root.hidden = false;
    // Snapshots come fifteen times a second; the cooldown sweep deserves every frame.
    const frame = () => {
      if (this.root.hidden) return;
      this.tick();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  hide() {
    this.root.hidden = true;
    this.togglePanel(false);
  }

  get panelOpen() {
    return !this.panel.hidden;
  }

  // ─── Sheet and live state ──────────────────────────────────────────────────────────────────

  setSheet(sheet: Character) {
    this.sheet = sheet;
    this.root.querySelector('#wh-name')!.textContent = sheet.name;
    this.root.querySelector('#wh-level')!.textContent = `Nv ${sheet.level}`;
    const need = xpToLevel(sheet.level);
    (this.root.querySelector('#wh-xp') as HTMLElement).style.width = `${Math.min(100, (sheet.xp / need) * 100)}%`;
    // Points waiting to be spent glow on the System button instead of nagging over the field.
    const owed = this.root.querySelector<HTMLElement>('#wh-owed')!;
    const points = sheet.unspent + sheet.skillPoints;
    owed.hidden = points <= 0;
    owed.textContent = String(points);
    owed.title = `${sheet.unspent} de atributo · ${sheet.skillPoints} de habilidad`;
    this.refreshSlots();
    if (this.panelOpen) this.renderPanel();
    if (this.revealPending) {
      this.revealPending = false;
      this.revealDestiny(sheet);
    }
  }

  setPlayer(p: Player) {
    this.player = p;
    const hp = this.root.querySelector('#wh-hp') as HTMLElement;
    const mp = this.root.querySelector('#wh-mp') as HTMLElement;
    hp.style.width = `${Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100))}%`;
    mp.style.width = `${Math.max(0, Math.min(100, (p.mana / Math.max(1, p.maxMana)) * 100))}%`;
    this.root.querySelector('#wh-hp-text')!.textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
    this.root.querySelector('#wh-mp-text')!.textContent = `${Math.floor(p.mana)} / ${Math.round(p.maxMana)}`;
    this.tick();
  }

  /** Cooldown sweeps, readiness and mana starvation, recomputed as often as snapshots arrive. */
  tick(now = performance.now()) {
    const sheet = this.sheet;
    if (!sheet) return;
    for (const slot of CAST_SLOTS) {
      const node = this.slotEls.get(slot)!;
      const skillId = sheet.slots[slot];
      const skill = skillId ? SKILLS_WORLD[skillId] : undefined;
      const cd = this.cooldowns.get(slot);
      const left = cd ? Math.max(0, cd.until - now) : 0;
      const wasReady = node.dataset.ready === 'true';
      const ready = !!skill && left <= 0 && node.dataset.locked !== 'true';
      node.style.setProperty('--cd', cd && left > 0 ? String(left / cd.total) : '0');
      node.dataset.cooling = String(left > 0);
      node.querySelector('.slot-cd')!.textContent = left > 0 ? (left / 1000).toFixed(left < 10000 ? 1 : 0) : '';
      node.dataset.ready = String(ready);
      // The moment a skill comes back it flashes, once.
      if (ready && !wasReady && cd) {
        node.classList.remove('slot-return');
        void node.offsetWidth;
        node.classList.add('slot-return');
        this.cooldowns.delete(slot);
      }
      if (skill && skillId && this.player) {
        const cost = effectiveSkill(skill, sheet.skills[skillId]).mana;
        node.dataset.starved = String(this.player.mana + 1e-6 < cost);
      }
    }
  }

  // ─── The skill bar ─────────────────────────────────────────────────────────────────────────

  private buildSkillbar() {
    const bar = this.root.querySelector('#skillbar')!;
    const weapon = el('div', 'skill-slot weapon');
    weapon.dataset.slot = 'click';
    weapon.innerHTML = `<span class="slot-frame"><img alt="" aria-hidden="true"></span><kbd>CLIC</kbd>`;
    bar.append(weapon);
    this.slotEls.set('click', weapon);
    for (const slot of CAST_SLOTS) {
      const node = el('button', 'skill-slot');
      (node as HTMLButtonElement).type = 'button';
      node.dataset.slot = slot;
      node.innerHTML = `
        <span class="slot-frame"><img alt="" aria-hidden="true"><span class="slot-cd"></span><span class="slot-lock">Nv ${SLOT_LEVEL[slot]}</span></span>
        <kbd>${SLOT_NAMES[slot].toUpperCase()}</kbd><span class="slot-mana"></span><span class="slot-level"></span>`;
      node.addEventListener('mouseenter', () => this.showTooltip(slot, node));
      node.addEventListener('mouseleave', () => (this.tooltip.hidden = true));
      // A tap or a click casts, like the key; the tree lives behind the System button.
      node.addEventListener('click', () => this.actions.cast(slot));
      bar.append(node);
      this.slotEls.set(slot, node);
    }
  }

  private refreshSlots() {
    const sheet = this.sheet!;
    const weapon = this.slotEls.get('click')!;
    weapon.querySelector('img')!.src = icon(WEAPON_ICON[sheet.weapon]);
    weapon.title = `${ITEMS[sheet.equipment.weapon.itemId]?.name ?? WEAPONS[sheet.weapon].name} · ${WEAPONS[sheet.weapon].text}`;
    for (const slot of CAST_SLOTS) {
      const node = this.slotEls.get(slot)!;
      const locked = sheet.level < SLOT_LEVEL[slot];
      const skillId = sheet.slots[slot];
      const skill = skillId ? SKILLS_WORLD[skillId] : undefined;
      const progress = skillId ? sheet.skills[skillId] : undefined;
      node.dataset.locked = String(locked);
      node.dataset.skill = skillId ?? '';
      node.dataset.rarity = skill?.rarity ?? '';
      node.style.setProperty('--rarity', skill ? RARITY_COLOR[skill.rarity] : '#44545c');
      node.style.setProperty('--element', skill?.color ?? '#44545c');
      const image = node.querySelector('img')!;
      image.hidden = !skill;
      if (skill) image.src = icon(skill.icon);
      node.querySelector('.slot-level')!.textContent = progress ? `${progress.level}` : '';
      node.querySelector('.slot-mana')!.textContent = skill && progress ? String(Math.ceil(effectiveSkill(skill, progress).mana)) : '';
      node.setAttribute(
        'aria-label',
        locked
          ? `Ranura ${SLOT_NAMES[slot]} · se abre en el nivel ${SLOT_LEVEL[slot]}`
          : skill && progress
            ? `${skillName(skill, progress.level)} · ${SLOT_NAMES[slot]} · nivel ${progress.level}`
            : `Ranura ${SLOT_NAMES[slot]} vacía`,
      );
    }
    this.tick();
  }

  /** The System window that opens over a slot: the skill's name, voice and road. */
  private showTooltip(slot: CastSlot, anchor: HTMLElement) {
    const sheet = this.sheet;
    if (!sheet) return;
    const skillId = sheet.slots[slot];
    const skill = skillId ? SKILLS_WORLD[skillId] : undefined;
    if (sheet.level < SLOT_LEVEL[slot] || !skill || !skillId) {
      this.tooltip.innerHTML = `<header>SISTEMA</header><h4>Ranura ${SLOT_NAMES[slot]}</h4><p>${
        sheet.level < SLOT_LEVEL[slot] ? `Se abre en el nivel ${SLOT_LEVEL[slot]}.` : 'Vacía. Abrí el panel con K para ponerle una habilidad.'
      }</p>`;
    } else {
      this.tooltip.innerHTML = '';
      this.tooltip.append(this.skillCard(skill, sheet, false));
    }
    this.tooltip.style.setProperty('--rarity', skill ? RARITY_COLOR[skill.rarity] : '#56b8ff');
    const box = anchor.getBoundingClientRect();
    const stage = this.root.getBoundingClientRect();
    this.tooltip.style.left = `${box.left - stage.left + box.width / 2}px`;
    this.tooltip.hidden = false;
  }

  private skillCard(skill: WorldSkill, sheet: Character, withTree: boolean) {
    const progress = sheet.skills[skill.id];
    const effective = effectiveSkill(skill, progress);
    const card = el('article', `wh-skill rarity-${skill.rarity}`);
    card.style.setProperty('--rarity', RARITY_COLOR[skill.rarity]);
    card.style.setProperty('--element', skill.color);
    const need = usesToLevel(skill, progress.level);
    const maxed = progress.level >= skill.maxLevel;
    card.innerHTML = `
      <header>SISTEMA · ${RARITY_NAMES[skill.rarity].toUpperCase()}</header>
      <div class="wh-skill-head">
        <img src="${icon(skill.icon)}" alt="" aria-hidden="true">
        <div><h4>${skillName(skill, progress.level)}</h4>
        <span class="wh-meta">Nv ${progress.level}${maxed ? ' · máximo' : ''} · ${Math.ceil(effective.mana)} maná · ${effective.cooldown.toFixed(1)} s</span></div>
      </div>
      <div class="wh-progress" title="Usos hasta el próximo nivel"><i style="width:${maxed ? 100 : Math.min(100, (progress.uses / need) * 100)}%"></i></div>
      <blockquote>${skill.flavor}</blockquote>
      ${skill.incantation ? `<p class="wh-chant">${skill.incantation}</p>` : ''}`;
    if (!withTree) return card;
    const slots = el('div', 'wh-assign');
    for (const slot of CAST_SLOTS) {
      const button = el('button', '', SLOT_NAMES[slot]) as HTMLButtonElement;
      button.type = 'button';
      // A book can teach a skill whose door is still closed: say so instead of a silent refusal.
      const closed = !schoolOpen(skill, sheet.affinities, sheet.trees);
      button.disabled = sheet.level < SLOT_LEVEL[slot] || closed;
      if (closed) button.title = refusalFor(skill.school);
      button.dataset.active = String(sheet.slots[slot] === skill.id);
      button.dataset.assign = `${skill.id}:${slot}`;
      button.onclick = () => this.actions.slot(slot, skill.id);
      slots.append(button);
    }
    card.append(slots);
    if (skill.tree.length) {
      const tree = el('ol', 'wh-tree');
      for (const node of skill.tree) {
        const learned = progress.nodes.includes(node.id);
        const check = canLearn(skill, progress, node.id, sheet.skillPoints, sheet.stats);
        const closed = !learned && !!node.fork && skill.tree.some((n) => n.fork === node.fork && progress.nodes.includes(n.id));
        const item = el('li');
        item.dataset.state = learned ? 'learned' : closed ? 'closed' : check.ok ? 'open' : 'locked';
        item.dataset.node = node.id;
        item.innerHTML = `<b>${node.name}</b><small>Nv ${node.level} · ${node.cost} pt${node.fork ? ' · rama' : ''}</small><p>${node.text}</p>`;
        if (!learned && !closed) {
          if (check.ok) {
            const learn = el('button', 'wh-learn', 'Aprender') as HTMLButtonElement;
            learn.type = 'button';
            learn.onclick = () => this.actions.learn(skill.id, node.id);
            item.append(learn);
          } else item.append(el('em', '', check.reason ?? ''));
        } else if (closed) item.append(el('em', '', 'Camino cerrado'));
        tree.append(item);
      }
      card.append(tree);
    }
    return card;
  }

  // ─── The System panel (K) ──────────────────────────────────────────────────────────────────

  togglePanel(open = this.panel.hidden) {
    this.panel.hidden = !open;
    if (open) this.renderPanel();
  }

  private renderPanel() {
    const sheet = this.sheet;
    if (!sheet) return;
    this.panel.replaceChildren();
    const head = el('header', 'wh-panel-head');
    head.innerHTML = `<span>SISTEMA</span><b>${sheet.name}</b><small>Nivel ${sheet.level} · ${sheet.skillPoints} punto${sheet.skillPoints === 1 ? '' : 's'} de habilidad</small>`;
    const close = el('button', 'wh-close', '✕') as HTMLButtonElement;
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar');
    close.onclick = () => this.togglePanel(false);
    head.append(close);
    const tabs = el('nav', 'wh-tabs');
    tabs.id = 'wh-tabs';
    for (const [id, label] of [['skills', 'Habilidades'], ['items', `Equipo · ${sheet.inventory.length}/${INVENTORY_SIZE}`]] as const) {
      const button = el('button', '', label) as HTMLButtonElement;
      button.type = 'button';
      button.dataset.tab = id;
      button.setAttribute('aria-pressed', String(this.tab === id));
      button.onclick = () => {
        this.tab = id;
        this.renderPanel();
      };
      tabs.append(button);
    }
    if (this.tab === 'items') {
      this.panel.append(head, tabs, this.itemsTab(sheet));
      return;
    }

    const status = el('div', 'wh-attributes');
    status.append(el('h5', '', `Atributos · ${sheet.unspent} por repartir`));
    for (const stat of STAT_IDS) {
      const row = el('div', 'wh-attribute');
      const label = el('span', '', STAT_NAMES[stat]);
      label.append(el('small', '', STAT_TEXT[stat]));
      row.append(label, el('b', '', String(sheet.stats[stat])));
      const plus = el('button', '', '+') as HTMLButtonElement;
      plus.type = 'button';
      plus.disabled = sheet.unspent <= 0;
      plus.dataset.stat = stat;
      plus.onclick = () => this.actions.spend(stat);
      row.append(plus);
      status.append(row);
    }
    const affinities = el('div', 'wh-affinities');
    affinities.append(el('h5', '', 'Afinidades'));
    for (const affinity of AFFINITIES) {
      const state = sheet.affinities[affinity];
      if (!state) continue;
      const row = el('div', 'wh-affinity');
      row.style.setProperty('--element', AFFINITY_COLOR[affinity]);
      row.title = AFFINITY_TEXT[affinity];
      row.append(el('span', '', AFFINITY_NAMES[affinity]), el('b', '', RANKS[rankOf(state.xp)]), el('small', '', '◆'.repeat(state.points)));
      affinities.append(row);
    }
    if (sheet.passives.length) {
      affinities.append(el('h5', '', 'Pasivas robadas'));
      for (const id of sheet.passives) {
        const passive = Object.values(MONSTER_TREES).find((tree) => tree.passive.id === id)?.passive;
        const row = el('div', 'wh-passive');
        row.append(el('b', '', passive?.name ?? id), el('small', '', passive?.text ?? ''));
        affinities.append(row);
      }
    }
    const side = el('aside', 'wh-side');
    side.append(status, affinities);
    const skills = el('div', 'wh-skills');
    for (const skillId of Object.keys(sheet.skills)) {
      const skill = SKILLS_WORLD[skillId];
      if (skill) skills.append(this.skillCard(skill, sheet, true));
    }
    const body = el('div', 'wh-panel-body');
    body.append(side, skills);
    this.panel.append(head, tabs, body);
  }

  /** Opens the System on the gear tab, with one item picked. */
  showItem(uid: string) {
    this.tab = 'items';
    this.selectedUid = uid;
    this.togglePanel(true);
  }

  private itemsTab(sheet: Character) {
    const body = el('div', 'wh-panel-body');
    const side = el('aside', 'wh-side');
    const gear = el('div', 'wh-equipment');
    gear.id = 'wh-equipment';
    gear.append(el('h5', '', 'Puesto'));
    for (const slot of EQUIP_SLOTS) {
      const instance = sheet.equipment[slot];
      const item = instance ? ITEMS[instance.itemId] : undefined;
      const cell = el('button', 'wh-equip-slot') as HTMLButtonElement;
      cell.type = 'button';
      cell.dataset.slot = slot;
      cell.dataset.item = instance?.itemId ?? '';
      cell.style.setProperty('--rarity', item ? RARITY_COLOR[item.rarity] : '#2b4a66');
      cell.innerHTML = `<small>${SLOT_LABEL[slot]}</small>${item ? `<img src="${icon(item.icon)}" alt="" aria-hidden="true"><b></b>` : '<em>Vacío</em>'}`;
      if (item) cell.querySelector('b')!.textContent = item.name;
      if (instance) cell.onclick = () => ((this.selectedUid = instance.uid), this.renderPanel());
      gear.append(cell);
    }
    const bonus = equipmentBonus(sheet);
    const lines = describeBonus({ ...bonus, stats: Object.fromEntries(Object.entries(bonus.stats).filter(([, n]) => n)) });
    gear.append(el('p', 'wh-gear-total', lines.length ? lines.join(' · ') : 'Sin bonos de equipo.'));
    side.append(gear);

    const main = el('div', 'wh-bag-area');
    const bag = el('div', 'wh-bag');
    bag.id = 'wh-bag';
    bag.dataset.capacity = String(INVENTORY_SIZE);
    bag.dataset.count = String(sheet.inventory.length);
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const instance = sheet.inventory[i];
      const item = instance ? ITEMS[instance.itemId] : undefined;
      const cell = el('button', 'wh-bag-cell') as HTMLButtonElement;
      cell.type = 'button';
      if (instance) {
        cell.dataset.uid = instance.uid;
        cell.dataset.item = instance.itemId;
        cell.dataset.rarity = item?.rarity ?? '';
        cell.style.setProperty('--rarity', item ? RARITY_COLOR[item.rarity] : '#44545c');
        cell.setAttribute('aria-pressed', String(this.selectedUid === instance.uid));
        cell.innerHTML = `<img src="${icon(item?.icon ?? 'vanguard-counter')}" alt="${item?.name ?? 'Objeto desconocido'}">`;
        cell.title = item?.name ?? 'Objeto desconocido';
        cell.onclick = () => ((this.selectedUid = instance.uid), (this.discardArmed = null), this.renderPanel());
      } else cell.disabled = true;
      bag.append(cell);
    }
    main.append(bag);
    const selected = this.findItem(sheet, this.selectedUid);
    main.append(selected ? this.itemCard(sheet, selected.instance, selected.slot) : el('p', 'wh-hint', 'Elegí un objeto para ver qué hace.'));
    body.append(side, main);
    return body;
  }

  private findItem(sheet: Character, uid: string | null): { instance: ItemInstance; slot: EquipSlot | null } | null {
    if (!uid) return null;
    const inBag = sheet.inventory.find((i) => i.uid === uid);
    if (inBag) return { instance: inBag, slot: null };
    for (const slot of EQUIP_SLOTS) if (sheet.equipment[slot]?.uid === uid) return { instance: sheet.equipment[slot]!, slot };
    return null;
  }

  private itemCard(sheet: Character, instance: ItemInstance, worn: EquipSlot | null) {
    const item = ITEMS[instance.itemId];
    const card = el('article', `wh-item rarity-${item?.rarity ?? 'comun'}`);
    card.dataset.uid = instance.uid;
    card.style.setProperty('--rarity', item ? RARITY_COLOR[item.rarity] : '#44545c');
    if (!item) {
      card.append(el('h4', '', 'Objeto desconocido'), el('p', '', 'Este objeto ya no existe en el mundo. Podés tirarlo.'));
    } else {
      card.innerHTML = `
        <header>SISTEMA · ${RARITY_NAMES[item.rarity].toUpperCase()} · ${KIND_LABEL[item.kind]} · Nv ${item.level}</header>
        <div class="wh-skill-head"><img src="${icon(item.icon)}" alt="" aria-hidden="true"><div><h4></h4>${worn ? '<span class="wh-meta">Puesto</span>' : ''}</div></div>`;
      card.querySelector('h4')!.textContent = item.name;
      const effect = item.grimoire ? [describeGrimoire(item.grimoire)] : describeBonus(item.bonus);
      const list = el('ul', 'wh-item-lines');
      for (const line of effect) list.append(el('li', '', line));
      card.append(list, el('blockquote', '', item.flavor));
      if (item.grimoire?.kind === 'teach') {
        const skill = SKILLS_WORLD[item.grimoire.skillId];
        if (skill && !schoolOpen(skill, sheet.affinities, sheet.trees)) card.append(el('p', 'wh-warning', refusalFor(skill.school)));
      }
    }
    const actions = el('div', 'wh-item-actions');
    const button = (label: string, onclick: () => void, disabled = false) => {
      const b = el('button', '', label) as HTMLButtonElement;
      b.type = 'button';
      b.disabled = disabled;
      b.onclick = onclick;
      actions.append(b);
      return b;
    };
    if (item?.slot && !worn) {
      const b = button(sheet.level < item.level ? `Equipar · Nv ${item.level}` : 'Equipar', () => this.actions.equip(instance.uid), sheet.level < item.level);
      b.dataset.action = 'equip';
    }
    if (worn && worn !== 'weapon') button('Quitar', () => this.actions.unequip(worn)).dataset.action = 'unequip';
    if (item?.grimoire && !worn) {
      if (item.grimoire.kind === 'train') {
        const select = el('select', 'wh-train') as HTMLSelectElement;
        for (const [id, progress] of Object.entries(sheet.skills)) {
          const skill = SKILLS_WORLD[id];
          if (skill && progress.level < skill.maxLevel) select.append(new Option(`${skillName(skill, progress.level)} · Nv ${progress.level}`, id));
        }
        actions.append(select);
        button('Usar', () => this.actions.use(instance.uid, select.value), !select.options.length).dataset.action = 'use';
      } else button('Usar', () => this.actions.use(instance.uid)).dataset.action = 'use';
    }
    if (!worn) {
      const armed = this.discardArmed === instance.uid;
      const b = button(armed ? 'Tirar para siempre' : 'Tirar', () => {
        if (!armed) {
          this.discardArmed = instance.uid;
          this.renderPanel();
          return;
        }
        this.discardArmed = null;
        this.selectedUid = null;
        this.actions.discard(instance.uid);
      });
      b.dataset.action = 'discard';
      b.classList.toggle('danger', armed);
    }
    card.append(actions);
    return card;
  }

  // ─── Chests ────────────────────────────────────────────────────────────────────────────────

  /** While this character opens a chest, a thin System bar says so. */
  setChests(chests: ChestView[], me: Player | undefined) {
    const mine = me ? chests.find((c) => c.opener === me.id) : undefined;
    this.channel.hidden = !mine;
    if (!mine) return;
    this.channel.dataset.tier = mine.tier;
    this.channel.querySelector('span')!.textContent = `Abriendo ${CHEST_TIERS[mine.tier].name.toLowerCase()}…`;
    (this.channel.querySelector('i') as HTMLElement).style.width = `${Math.round(mine.progress * 100)}%`;
  }

  /** What a chest gave, as cards with their rarity; clicking one opens it in the System. */
  private showLoot(n: Notice) {
    this.lootStrip.replaceChildren();
    for (const instance of n.items ?? []) {
      const item = ITEMS[instance.itemId];
      if (!item) continue;
      const card = el('button', `reward-card rarity-${item.rarity}`) as HTMLButtonElement;
      card.type = 'button';
      card.dataset.item = item.id;
      card.dataset.rarity = item.rarity;
      card.style.setProperty('--rarity', RARITY_COLOR[item.rarity]);
      card.innerHTML = `<img class="reward-icon" src="${icon(item.icon)}" alt="" aria-hidden="true"><small>${RARITY_NAMES[item.rarity].toUpperCase()}</small><strong></strong><p></p>`;
      card.querySelector('strong')!.textContent = item.name;
      card.querySelector('p')!.textContent = item.grimoire ? describeGrimoire(item.grimoire) : describeBonus(item.bonus).join(' · ');
      card.onclick = () => {
        this.lootStrip.hidden = true;
        this.showItem(instance.uid);
      };
      this.lootStrip.append(card);
    }
    this.lootStrip.hidden = !this.lootStrip.children.length;
    clearTimeout(this.lootTimer);
    this.lootTimer = window.setTimeout(() => (this.lootStrip.hidden = true), 5500);
  }
  private lootTimer = 0;

  // ─── The voice of the System ───────────────────────────────────────────────────────────────

  notice(n: Notice, now = performance.now()) {
    if (n.kind === 'callout') {
      if (n.slot && n.cooldown) this.cooldowns.set(n.slot, { until: now + n.cooldown * 1000, total: n.cooldown * 1000 });
      this.shout(n);
      this.tick(now);
      return;
    }
    if (n.kind === 'evolution' || n.kind === 'steal') this.cinematic(n);
    if (n.kind === 'loot') this.showLoot(n);
    const window = el('article', 'wh-notice');
    window.dataset.kind = n.kind;
    window.style.setProperty('--accent', n.color ?? '#56b8ff');
    window.innerHTML = `<header>[ SISTEMA ]</header><h4></h4><p></p>`;
    window.querySelector('h4')!.textContent = n.title;
    window.querySelector('p')!.textContent = n.text;
    this.notices.append(window);
    while (this.notices.children.length > 4) this.notices.firstElementChild!.remove();
    setTimeout(() => {
      window.classList.add('leaving');
      setTimeout(() => window.remove(), 400);
    }, NOTICE_LIFE[n.kind] ?? 4200);
  }

  /** The skill's name cuts across the screen in its own colour; the chant shows while it lasts. */
  private shout(n: Notice) {
    const name = this.callout.querySelector('#wh-callout-name')!;
    const chant = this.callout.querySelector('#wh-incantation')!;
    name.textContent = `「${n.title}」`;
    chant.textContent = n.incantation ?? '';
    this.callout.dataset.rarity = n.rarity ?? 'comun';
    this.callout.dataset.chanting = String(!!n.incantation);
    this.callout.style.setProperty('--element', n.color ?? '#ffffff');
    this.callout.style.setProperty('--rarity', RARITY_COLOR[(n.rarity as Rarity) ?? 'comun'] ?? '#ffffff');
    this.callout.hidden = false;
    this.callout.classList.remove('shouting');
    void this.callout.offsetWidth;
    this.callout.classList.add('shouting');
    clearTimeout(this.calloutTimer);
    this.calloutTimer = window.setTimeout(() => (this.callout.hidden = true), n.incantation ? 2200 : 1500);
  }

  /** Evolutions and stolen trees are events in a character's life; they get a scene. */
  private cinematic(n: Notice) {
    const scene = el('div', 'wh-cinematic');
    scene.dataset.kind = n.kind;
    scene.style.setProperty('--accent', n.color ?? '#ffc84d');
    scene.innerHTML = `<small>${n.kind === 'steal' ? 'ROBO' : 'EVOLUCIÓN'}</small><h3></h3><p></p>`;
    scene.querySelector('h3')!.textContent = n.title;
    scene.querySelector('p')!.textContent = n.text;
    this.root.append(scene);
    setTimeout(() => scene.remove(), 4200);
  }

  // ─── Birth ─────────────────────────────────────────────────────────────────────────────────

  /**
   * The Man-God's welcome. He has no class to give and grants nothing: the sparks are yours to
   * place, the weapon yours to pick, and the one skill fate hands over is not chosen by anyone.
   */
  openCreation(onBorn: (creation: Creation) => void) {
    const sparks: Partial<Record<Affinity, number>> = {};
    let weapon: Weapon = 'espada';
    const left = () => SPARKS - Object.values(sparks).reduce((a, b) => a + (b ?? 0), 0);
    this.creation.hidden = false;
    this.creation.innerHTML = `
      <div class="wh-birth" role="dialog" aria-label="Nacer">
        <div class="wh-hitogami">${hitogamiSvg('birth')}</div>
        <p class="wh-god">Una figura blanca, sin rostro, te habla como un viejo amigo.</p>
        <h2>「Bienvenido a Aldrath.」</h2>
        <p class="wh-god-line">No, no soy tu dios. No tengo nada para darte. Solo vine a mirar.</p>
        <h5>Chispas de afinidad <b id="wh-sparks"></b></h5>
        <div class="wh-sparks" id="wh-spark-grid"></div>
        <h5>Tu arma</h5>
        <div class="wh-weapons" id="wh-weapon-grid"></div>
        <h5>Atributos <b>crecen al subir de nivel</b></h5>
        <dl class="wh-stat-legend">${STAT_IDS.map((stat) => `<div><dt>${STAT_NAMES[stat]}</dt><dd>${STAT_TEXT[stat]}</dd></div>`).join('')}</dl>
        <p class="wh-fate">La habilidad del destino se decide al nacer. Nadie la elige: ni vos, ni él.</p>
        <button type="button" id="wh-born" class="wh-born" disabled>Nacer ↗</button>
      </div>`;
    const grid = this.creation.querySelector('#wh-spark-grid')!;
    const weapons = this.creation.querySelector('#wh-weapon-grid')!;
    const born = this.creation.querySelector<HTMLButtonElement>('#wh-born')!;
    const render = () => {
      this.creation.querySelector('#wh-sparks')!.textContent = `${SPARKS - left()} / ${SPARKS}`;
      born.disabled = left() !== 0;
      grid.querySelectorAll<HTMLElement>('[data-affinity]').forEach((chip) => {
        const affinity = chip.dataset.affinity as Affinity;
        chip.dataset.count = String(sparks[affinity] ?? 0);
        chip.querySelector('.count')!.textContent = '◆'.repeat(sparks[affinity] ?? 0) || '·';
      });
      weapons.querySelectorAll<HTMLElement>('[data-weapon]').forEach((card) => (card.dataset.active = String(card.dataset.weapon === weapon)));
    };
    for (const affinity of AFFINITIES) {
      const chip = el('button', `wh-spark ${ARCANE.includes(affinity) ? 'arcana' : 'corporal'}`) as HTMLButtonElement;
      chip.type = 'button';
      chip.dataset.affinity = affinity;
      chip.style.setProperty('--element', AFFINITY_COLOR[affinity]);
      chip.innerHTML = `<b>${AFFINITY_NAMES[affinity]}</b><span class="count"></span><small>${AFFINITY_TEXT[affinity]}</small>`;
      chip.title = AFFINITY_TEXT[affinity];
      // Click adds a spark; right click takes one back.
      chip.onclick = () => {
        if (left() > 0) sparks[affinity] = (sparks[affinity] ?? 0) + 1;
        render();
      };
      chip.oncontextmenu = (event) => {
        event.preventDefault();
        if (sparks[affinity]) sparks[affinity]! -= 1;
        render();
      };
      grid.append(chip);
    }
    for (const id of WEAPON_IDS) {
      const card = el('button', 'wh-weapon') as HTMLButtonElement;
      card.type = 'button';
      card.dataset.weapon = id;
      card.innerHTML = `<img src="${icon(WEAPON_ICON[id])}" alt="" aria-hidden="true"><b>${WEAPONS[id].name}</b><small>${WEAPONS[id].text}</small>`;
      card.onclick = () => {
        weapon = id;
        render();
      };
      weapons.append(card);
    }
    born.onclick = () => {
      if (left() !== 0) return;
      const creation: Creation = { sparks: Object.fromEntries(Object.entries(sparks).filter(([, n]) => n)), weapon };
      this.creation.hidden = true;
      this.revealPending = true;
      onBorn(creation);
    };
    render();
  }

  /** The first sheet of a newborn: fate turns its card over. */
  private revealDestiny(sheet: Character) {
    const skill = SKILLS_WORLD[sheet.destiny.skillId];
    if (!skill) return;
    const card = el('div', `wh-destiny rarity-${sheet.destiny.rarity}`);
    card.id = 'wh-destiny';
    card.style.setProperty('--rarity', RARITY_COLOR[sheet.destiny.rarity]);
    card.style.setProperty('--element', skill.color);
    card.innerHTML = `
      <small>EL MUNDO TE CONCEDIÓ</small>
      <img src="${icon(skill.icon)}" alt="" aria-hidden="true">
      <h3>「${skill.name}」</h3>
      <span class="wh-rarity">${RARITY_NAMES[sheet.destiny.rarity]}</span>
      <blockquote>${skill.flavor}</blockquote>`;
    this.root.append(card);
    setTimeout(() => card.classList.add('leaving'), 5200);
    setTimeout(() => card.remove(), 5800);
  }
}
