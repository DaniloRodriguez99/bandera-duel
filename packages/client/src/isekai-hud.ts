import type { Player } from '@bandera/shared';
import {
  AFFINITIES,
  AFFINITY_NAMES,
  ARCANE,
  MONSTER_TREES,
  RANKS,
  RARITY_NAMES,
  SKILLS_WORLD,
  STAT_NAMES,
  canLearn,
  effectiveSkill,
  rankOf,
  skillName,
  usesToLevel,
  type Affinity,
  type Rarity,
  type WorldSkill,
} from '@bandera/shared/rpg/skills';
import { xpToLevel, STAT_IDS, type StatId } from '@bandera/shared/rpg/progression';
import {
  CAST_SLOTS,
  SLOT_LEVEL,
  SLOT_NAMES,
  SPARKS,
  WEAPONS,
  WEAPON_IDS,
  type CastSlot,
  type Character,
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
}

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
      <div id="skillbar" class="skillbar" aria-label="Habilidades"></div>
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
    weapon.title = `${WEAPONS[sheet.weapon].name} · ${WEAPONS[sheet.weapon].text}`;
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
      button.disabled = sheet.level < SLOT_LEVEL[slot];
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

    const status = el('div', 'wh-attributes');
    status.append(el('h5', '', `Atributos · ${sheet.unspent} por repartir`));
    for (const stat of STAT_IDS) {
      const row = el('div', 'wh-attribute');
      row.append(el('span', '', STAT_NAMES[stat]), el('b', '', String(sheet.stats[stat])));
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
    this.panel.append(head, body);
  }

  // ─── The voice of the System ───────────────────────────────────────────────────────────────

  notice(n: Notice, now = performance.now()) {
    if (n.kind === 'callout') {
      if (n.slot && n.cooldown) this.cooldowns.set(n.slot, { until: now + n.cooldown * 1000, total: n.cooldown * 1000 });
      this.shout(n);
      this.tick(now);
      return;
    }
    if (n.kind === 'evolution' || n.kind === 'steal') this.cinematic(n);
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
        <p class="wh-god">Una figura pequeña y blanca te sonríe como un viejo amigo.</p>
        <h2>「Bienvenido a Aldrath.」</h2>
        <p class="wh-god-line">No, no soy tu dios. No tengo nada para darte. Solo vine a mirar.</p>
        <h5>Chispas de afinidad <b id="wh-sparks"></b></h5>
        <div class="wh-sparks" id="wh-spark-grid"></div>
        <h5>Tu arma</h5>
        <div class="wh-weapons" id="wh-weapon-grid"></div>
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
      chip.innerHTML = `<b>${AFFINITY_NAMES[affinity]}</b><span class="count"></span>`;
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
