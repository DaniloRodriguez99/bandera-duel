import Phaser from 'phaser';
import {
  RULES,
  CLASSES,
  CLASS_IDS,
  DEFAULT_CLASS,
  WALLS,
  TEAMS,
  TEAM_NAMES,
  TEAM_ICONS,
  layout,
  projectileStats,
  chargePower,
  distance,
  movePlayer,
  newPlayer,
  lineClear,
  type Snapshot,
  type Player,
  type Team,
  type Base,
  type Zombie,
  type Input,
} from '@bandera/shared';
import { Controls } from './input.js';
import { sound } from './audio.js';
import { CLASS_ART, ZOMBIE_ART, HAT_ZOMBIE_ART, palette, zombiePalette, hatPalette, undeadPalette } from './art.js';

const GOLD = 0xf3ce86;
const COLORS: Record<Team, number> = { blue: 0x73bbef, red: 0xee8b79, green: 0x86cf97, violet: 0xbf98ea };
const LIGHT: Record<Team, string> = { blue: '#8cc5e7', red: '#efa08b', green: '#9fdcae', violet: '#c9aef0' };
const CLOTH: Record<Team, string> = { blue: '#548cb7', red: '#b66558', green: '#4f9a68', violet: '#8062a8' };
export class Arena extends Phaser.Scene {
  controls!: Controls;
  localId = '';
  snapshot?: Snapshot;
  predicted?: Player;
  localStep?: (input: Input) => void;
  send: (input: Input) => void = () => {};
  private visuals = new Map<
    string,
    {
      body: Phaser.GameObjects.Sprite;
      shadow: Phaser.GameObjects.Ellipse;
      name: Phaser.GameObjects.Text;
      hp: Phaser.GameObjects.Graphics;
      weapon: Phaser.GameObjects.Graphics;
      x: number;
      y: number;
    }
  >();
  private flags!: Phaser.GameObjects.Graphics;
  private traps!: Phaser.GameObjects.Graphics;
  private arrows!: Phaser.GameObjects.Graphics;
  private aim!: Phaser.GameObjects.Graphics;
  private bases!: Phaser.GameObjects.Graphics;
  private baseLabels: Phaser.GameObjects.Text[] = [];
  private layoutKey = '';
  private zombieVisuals = new Map<
    string,
    {
      body: Phaser.GameObjects.Sprite;
      hp: Phaser.GameObjects.Graphics;
      fx: Phaser.GameObjects.Graphics;
      label?: Phaser.GameObjects.Text;
      x: number;
      y: number;
    }
  >();
  private pending: Input[] = [];
  private seq = 0;
  private accumulator = 0;
  private lastEvent = 0;
  private phase = '';
  private receivedAt = 0;
  constructor() {
    super('arena');
  }
  create() {
    this.drawMap();
    this.bases = this.add.graphics().setDepth(1);
    this.makeTextures();
    this.flags = this.add.graphics().setDepth(5);
    this.traps = this.add.graphics().setDepth(4);
    this.arrows = this.add.graphics().setDepth(9);
    this.aim = this.add.graphics().setDepth(4);
    this.controls = new Controls();
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !this.predicted) return;
      this.controls.angle = Math.atan2(p.y - this.predicted.y, p.x - this.predicted.x);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !this.controls.enabled) return;
      if (p.rightButtonDown()) this.controls.secondary(true);
      else this.controls.primary();
    });
    const preview = layout(['blue', 'red']);
    this.drawBases(preview);
    this.paintFlags(
      preview.map(
        (b) => ({ ...b.home, team: b.team, status: 'home', carrier: null }) as Snapshot['flags'][number],
      ),
    );
    for (const b of preview) this.drawPlayer(newPlayer(`preview-${b.team}`, '', b.team), false, 0);
  }
  private makeTextures() {
    for (const team of TEAMS)
      for (const classId of CLASS_IDS) for(let frame=0;frame<2;frame++) {
        const data=CLASS_ART[classId].map((row,i)=>frame===1&&i>=13?row.slice(0,3)+row.slice(3,13).split('').reverse().join('')+row.slice(13):row);
        this.textures.generate(`${team}-${classId}-${frame}`, { data,pixelWidth:2,palette:palette(CLOTH[team],LIGHT[team]) as Phaser.Types.Create.Palette });
      }
    for (const team of TEAMS)
      for (let frame = 0; frame < 2; frame++) {
        const data = ZOMBIE_ART.map((row, i) =>
          frame === 1 && i >= 11 ? row.slice(0, 3) + row.slice(3, 13).split('').reverse().join('') + row.slice(13) : row,
        );
        this.textures.generate(`${team}-zombie-${frame}`, {
          data,
          pixelWidth: 2,
          palette: zombiePalette(CLOTH[team], LIGHT[team]) as Phaser.Types.Create.Palette,
        });
      }
    const stride = (rows: string[], from: number, frame: number) =>
      rows.map((row, i) =>
        frame === 1 && i >= from ? row.slice(0, 3) + row.slice(3, 13).split('').reverse().join('') + row.slice(13) : row,
      );
    for (const team of TEAMS)
      for (let frame = 0; frame < 2; frame++) {
        this.textures.generate(`${team}-hat-${frame}`, {
          data: stride(HAT_ZOMBIE_ART, 12, frame),
          pixelWidth: 2,
          palette: hatPalette(CLOTH[team], LIGHT[team]) as Phaser.Types.Create.Palette,
        });
        for (const classId of CLASS_IDS)
          this.textures.generate(`${team}-${classId}-undead-${frame}`, {
            data: stride(CLASS_ART[classId], 13, frame),
            pixelWidth: 2,
            palette: undeadPalette(CLOTH[team], LIGHT[team]) as Phaser.Types.Create.Palette,
          });
      }
  }
  private drawBases(bases: Base[]) {
    const key = JSON.stringify(bases);
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    const g = this.bases;
    g.clear();
    this.baseLabels.forEach((label) => label.destroy());
    this.baseLabels = bases.map(({ team, home: h, spawn: sp }) => {
      const color = COLORS[team];
      g.fillStyle(color, 0.1);
      g.fillRoundedRect(h.x < RULES.width / 2 ? h.x - 117 : h.x - 51, h.y - 56, 168, 112, 10);
      g.lineStyle(2, color, 0.45);
      g.strokeCircle(h.x, h.y, 38);
      g.lineStyle(1, color, 0.17);
      g.strokeCircle(h.x, h.y, 45);
      g.fillStyle(color, 0.18);
      g.fillCircle(sp.x, sp.y, 19);
      return this.add
        .text(h.x, h.y + 56, `${TEAM_ICONS[team]}  ${TEAM_NAMES[team]}`, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: LIGHT[team],
          letterSpacing: 2,
        })
        .setOrigin(0.5)
        .setDepth(1);
    });
  }
  private drawMap() {
    const g = this.add.graphics();
    g.fillStyle(0x18272c);
    g.fillRect(0, 0, 960, 540);
    for (let y = 20; y < 520; y += 20)
      for (let x = 20; x < 940; x += 20) {
        const n = ((x * 37 + y * 19) % 113) / 113;
        g.fillStyle(n > 0.62 ? 0x30423c : n > 0.32 ? 0x2b3d38 : 0x293a36);
        g.fillRect(x, y, 19, 19);
        if (n > 0.85) {
          g.fillStyle(0x52614a, 0.5);
          g.fillRect(x + 5, y + 6, 2, 4);
          g.fillRect(x + 9, y + 5, 2, 5);
        }
      }
    // Worn stone lanes form a cross, with a ring around the central courtyard.
    for (let y = 234; y < 306; y += 18)
      for (let x = 20; x < 940; x += 28) {
        g.fillStyle((x + y) % 3 ? 0x5b6153 : 0x636958);
        g.fillRect(x + (y % 36 ? 7 : 0), y, 26, 16);
        g.fillStyle(0x838573, 0.25);
        g.fillRect(x + 2, y, 22, 2);
      }
    for (const x of [130, 800])
      for (let y = 50; y < 490; y += 24) {
        g.fillStyle(0x565e50, 0.55);
        g.fillRect(x, y, 28, 22);
      }
    g.lineStyle(2, 0x8a9073, 0.25);
    g.strokeCircle(480, 270, 62);
    g.strokeCircle(480, 270, 54);
    g.fillStyle(0x8a9073, 0.3);
    g.fillTriangle(480, 245, 496, 270, 480, 295);
    g.fillTriangle(480, 245, 464, 270, 480, 295);
    const wall = (x: number, y: number, w: number, h: number) => {
      g.fillStyle(0x0e1c20, 0.6);
      g.fillRect(x + 6, y + 9, w, h);
      g.fillStyle(0x313e42);
      g.fillRect(x, y, w, h);
      for (let row = 0; row < h; row += 14)
        for (let col = 0; col < w; col += 26) {
          g.fillStyle((row + col) % 3 ? 0x626e69 : 0x56635f);
          g.fillRect(
            x + col + 1,
            y + row + 1,
            Math.min(24, w - col - 2),
            Math.min(12, h - row - 2),
          );
          g.fillStyle(0x899084, 0.55);
          g.fillRect(x + col + 2, y + row + 1, Math.min(22, w - col - 3), 2);
        }
      g.fillStyle(0x9ca08b, 0.55);
      g.fillRect(x, y, w, 3);
      g.fillStyle(0x1f2e31);
      g.fillRect(x, y + h - 6, w, 6);
    };
    for (const w of WALLS) wall(w.x, w.y, w.w, w.h);
    wall(0, 0, 960, 20);
    wall(0, 520, 960, 20);
    wall(0, 20, 20, 500);
    wall(940, 20, 20, 500);
    for (const [x, y] of [
      [225, 96],
      [735, 96],
      [225, 440],
      [735, 440],
      [400, 150],
      [560, 390],
    ]) {
      g.fillStyle(0x4a3a2b);
      g.fillRect(x - 3, y, 6, 12);
      g.fillStyle(0xf4b765);
      g.fillRect(x - 3, y - 8, 6, 9);
      g.fillStyle(0xffe0a0);
      g.fillRect(x - 1, y - 11, 3, 9);
      const glow = this.add.circle(x, y - 4, 19, 0xffb35c, 0.07);
      this.tweens.add({ targets: glow, alpha: 0.35, duration: 850 + x, yoyo: true, repeat: -1 });
    }
  }
  receive(snapshot: Snapshot, id: string) {
    if (!this.controls) return;
    const was = this.snapshot,
      first = !was;
    this.snapshot = snapshot;
    this.localId = id;
    this.receivedAt = performance.now();
    this.drawBases(snapshot.bases);
    for (const [key, v] of this.visuals) {
      if (snapshot.players.some((p) => p.id === key)) continue;
      v.body.destroy();
      v.name.destroy();
      v.shadow.destroy();
      v.hp.destroy();
      v.weapon.destroy();
      this.visuals.delete(key);
    }
    const own = snapshot.players.find((p) => p.id === id);
    if (own) {
      this.controls.configure(own.classId);
      if (first) this.controls.angle = own.angle;
      this.seq = Math.max(this.seq, own.ack);
      this.pending = this.pending.filter((i) => i.seq > own.ack);
      if (snapshot.phase !== this.phase || snapshot.paused || own.hp <= 0) this.pending = [];
      this.predicted = { ...own };
      if (snapshot.phase === 'playing' && !snapshot.paused)
        for (const input of this.pending)
          movePlayer(
            this.predicted,
            input,
            snapshot.flags.some((f) => f.carrier === id),
          );
    }
    this.phase = snapshot.phase;
    this.controls.enabled = snapshot.phase === 'playing' && !snapshot.paused && !!own?.hp && own.stunLeft <= 0;
    if (!this.controls.enabled) this.controls.clear();
    if (first) this.lastEvent = snapshot.events.at(-1)?.id ?? 0;
    for (const e of snapshot.events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      sound(e.kind);
      if (e.kind === 'sword') {
        const slash = this.add.graphics().setDepth(15);
        const power = e.power ?? 0;
        slash.lineStyle(4 + power * 5, power > 0.05 ? 0xffc86b : 0xffe7b1, 0.9);
        slash.beginPath();
        const stats = CLASSES[e.classId ?? DEFAULT_CLASS];
        const arc = stats.meleeArc * (1 + 0.2 * power);
        slash.arc(
          e.x,
          e.y,
          stats.meleeRange * (1 + 0.3 * power),
          (e.angle ?? 0) - arc / 2,
          (e.angle ?? 0) + arc / 2,
        );
        slash.strokePath();
        this.tweens.add({
          targets: slash,
          alpha: 0,
          duration: 180,
          onComplete: () => slash.destroy(),
        });
      } else {
        const color = e.kind==='block'?GOLD:COLORS[e.team];
        for (let i = 0; i < (e.kind === 'capture' ? 24 : 7); i++) {
          const a = i * 2.4,
            rect = this.add.rectangle(e.x, e.y, 3, 3, color).setDepth(20);
          this.tweens.add({
            targets: rect,
            x: e.x + Math.cos(a) * (e.kind === 'capture' ? 100 : 30),
            y: e.y + Math.sin(a) * 35,
            alpha: 0,
            duration: 450,
            onComplete: () => rect.destroy(),
          });
        }
      }
      if (e.kind === 'summon') {
        const smoke = this.add.circle(e.x, e.y, 12, 0x6a4c93, 0.4).setDepth(8);
        this.tweens.add({
          targets: smoke,
          scale: 3.2,
          alpha: 0,
          duration: 520,
          onComplete: () => smoke.destroy(),
        });
      }
      this.spellEffect(e);
      if (e.kind === 'capture') {
        const pulse = this.add
          .rectangle(480, 270, 960, 540, COLORS[e.team], 0.2)
          .setDepth(25);
        this.tweens.add({
          targets: pulse,
          alpha: 0,
          duration: 600,
          onComplete: () => pulse.destroy(),
        });
      }
    }
  }
  private fade(target: Phaser.GameObjects.GameObject, props: object, duration: number) {
    this.tweens.add({ targets: target, ...props, alpha: 0, duration, onComplete: () => target.destroy() });
  }
  private spellEffect(e: Snapshot['events'][number]) {
    if (e.kind === 'explosion') {
      const radius = RULES.explosionRadius * (0.6 + 0.4 * (e.power ?? 1));
      this.fade(this.add.circle(e.x, e.y, 10, 0xff7a2f, 0.6).setDepth(16), { scale: radius / 10 }, 380);
      this.fade(this.add.circle(e.x, e.y, 8).setStrokeStyle(3, 0xffe08a, 0.95).setDepth(16), { scale: 6 }, 460);
    } else if (e.kind === 'freeze') {
      this.fade(this.add.star(e.x, e.y - 6, 6, 4, 13, 0xbff4ff, 0.85).setDepth(16), { scale: 1.9, angle: 45 }, 520);
    } else if (e.kind === 'heal') {
      const plus = this.add
        .text(e.x, e.y - 24, '+', { fontFamily: 'monospace', fontSize: '16px', color: '#7dffa0', stroke: '#0b2a14', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(16);
      this.fade(plus, { y: e.y - 44 }, 700);
    } else if (e.kind === 'raise') {
      this.fade(this.add.rectangle(e.x, e.y - 40, 22, 96, 0x7dffb0, 0.4).setDepth(16), { scaleX: 0 }, 760);
      this.fade(this.add.ellipse(e.x, e.y + 8, 30, 12).setStrokeStyle(2, 0x7dffb0, 0.9).setDepth(4), { scale: 3 }, 760);
    } else if (e.kind === 'shot' && (e.power ?? 0) > 0.05) {
      const power = e.power ?? 0;
      this.fade(this.add.circle(e.x, e.y, 10, 0xff7a2f, 0.6).setDepth(16), { scale: 2.5 + power * 2 }, 300);
      this.fade(this.add.circle(e.x, e.y, 6).setStrokeStyle(3, 0xffe08a, 0.9).setDepth(16), { scale: 5 + power * 3 }, 380);
    } else if (e.kind === 'summon' && e.power) {
      this.fade(this.add.ellipse(e.x, e.y + 8, 36, 14).setStrokeStyle(3, 0xb06cff, 0.9).setDepth(4), { scale: 3.4 }, 700);
    }
  }
  /** Charged fire: roaring core, long flickering flame trail, corona and orbiting embers. */
  private drawBlaze(p: { x: number; y: number }, angle: number, power: number, time: number, core: number) {
    const g = this.arrows,
      dx = Math.cos(angle),
      dy = Math.sin(angle);
    for (let i = 9; i >= 1; i--) {
      const back = i * (8 + power * 7),
        fade = 1 - i / 10,
        wobble = Math.sin(time * 0.035 + i * 1.3) * (2 + power * 2);
      g.fillStyle(i % 2 ? 0xff3d0d : 0xffa132, 0.1 + fade * 0.3);
      g.fillCircle(p.x - dx * back - dy * wobble, p.y - dy * back + dx * wobble, (5 + power * 11) * fade + 2);
    }
    const flicker = 0.85 + Math.sin(time * 0.05) * 0.15;
    g.fillStyle(0xff2a00, 0.14);
    g.fillCircle(p.x, p.y, (22 + power * 20) * flicker);
    g.lineStyle(2, 0xffd36b, 0.6);
    g.strokeCircle(p.x, p.y, (14 + power * 11) * flicker);
    g.fillStyle(core, 0.9);
    g.fillCircle(p.x, p.y, 8 + power * 8);
    g.fillStyle(0xfff3c4);
    g.fillCircle(p.x, p.y, 3 + power * 4);
    for (let i = 0; i < 5; i++) {
      const a = time * 0.02 + i * 1.26,
        orbit = 12 + power * 10;
      g.fillStyle(0xffc14a, 0.85);
      g.fillRect(p.x + Math.cos(a) * orbit - dx * 10, p.y + Math.sin(a) * orbit - dy * 10, 2, 2);
    }
  }
  /** Rune circle that grows and spins faster as a held ability charges. */
  private drawCharge(g: Phaser.GameObjects.Graphics, p: Player, x: number, y: number, time: number) {
    const stats = CLASSES[p.classId];
    const special = p.specialCharge > 0;
    if (!special && (p.shotCharge <= 0 || p.classId === 'archer')) return;
    const seconds = special ? p.specialCharge : p.shotCharge;
    const power = chargePower(seconds);
    const summoning = special && stats.summon;
    const raising = summoning && seconds >= RULES.overchargeTime;
    const color = raising ? 0x7dffb0 : summoning ? 0x9b59d0 : special ? 0x9fe8ff : stats.ranged ? 0xff8a3c : GOLD;
    const radius = 18 + power * 14,
      spin = time * (0.002 + power * 0.01);
    g.lineStyle(1 + power * 2, color, 0.35 + power * 0.45);
    g.strokeEllipse(x, y + 8, radius * 2, radius * 0.8);
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3;
      g.lineBetween(
        x + Math.cos(a) * radius * 0.6,
        y + 8 + Math.sin(a) * radius * 0.24,
        x + Math.cos(a) * radius,
        y + 8 + Math.sin(a) * radius * 0.4,
      );
    }
    const progress = summoning ? Math.min(1, seconds / RULES.raiseCharge) : power;
    g.lineStyle(3, color, 0.9);
    g.beginPath();
    g.arc(x, y - 4, 22, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    g.strokePath();
    if (progress >= 1) {
      const flare = 0.5 + Math.sin(time * 0.03) * 0.5;
      g.lineStyle(2, 0xffffff, 0.3 + flare * 0.5);
      g.strokeCircle(x, y - 4, 26 + flare * 3);
    }
    if (raising) {
      g.lineStyle(1, color, 0.6);
      g.strokeEllipse(x, y + 8, radius * 2.8, radius * 1.1);
    }
  }
  reset() {
    this.localStep = undefined;
    this.accumulator = 0;
    this.snapshot = undefined;
    this.predicted = undefined;
    this.pending = [];
    this.seq = 0;
    this.phase = '';
    this.controls.enabled = false;
    this.controls.clear();
  }
  private paintFlags(flags: Snapshot['flags']) {
    const g = this.flags;
    g.clear();
    for (const f of flags) {
      const color = COLORS[f.team];
      const x = f.x + (f.status === 'carried' ? 15 : 0),
        y = f.y - (f.status === 'carried' ? 22 : 0);
      g.fillStyle(0x000000, 0.2);
      g.fillEllipse(x, y + 7, 20, 8);
      g.fillStyle(0xc0ae81);
      g.fillRect(x - 1, y - 27, 3, 34);
      g.fillStyle(color);
      g.fillRect(x + 2, y - 26, 19, 13);
      g.fillTriangle(x + 2, y - 13, x + 21, y - 13, x + 2, y - 7);
      g.fillStyle(0xece2c6);
      if (f.team === 'blue') {
        g.fillTriangle(x + 10, y - 23, x + 6, y - 19, x + 10, y - 15);
        g.fillTriangle(x + 10, y - 23, x + 14, y - 19, x + 10, y - 15);
      } else if (f.team === 'red') {
        g.fillRect(x + 10, y - 24, 3, 10);
        g.fillRect(x + 6, y - 20, 11, 3);
      } else if (f.team === 'green') {
        g.fillTriangle(x + 11, y - 24, x + 6, y - 15, x + 16, y - 15);
      } else {
        g.fillCircle(x + 11, y - 19, 4);
      }
      if (f.status === 'dropped') {
        g.lineStyle(1, color, 0.7);
        g.strokeCircle(x, y, 22);
      }
    }
  }
  private drawPlayer(p: Player, local: boolean, time: number, delta = 16.67) {
    let v = this.visuals.get(p.id);
    if (!v) {
      v = {
        body: this.add
          .sprite(p.x, p.y, `${p.team}-${p.classId}-0`)
          .setOrigin(0.5, 0.7)
          .setDepth(10),
        shadow: this.add.ellipse(p.x, p.y + 8, 26, 10, 0x081618, 0.4).setDepth(3),
        name: this.add
          .text(p.x, p.y - 32, p.name, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#e8e9d5',
            stroke: '#15242b',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(13),
        hp: this.add.graphics().setDepth(13),
        weapon: this.add.graphics().setDepth(11),
        x: p.x,
        y: p.y,
      };
      this.visuals.set(p.id, v);
    }
    const moving = Math.hypot(p.x - v.x, p.y - v.y) > 0.3;
    const smooth = local ? 1 : 1 - Math.exp(-delta / 55);
    v.x += (p.x - v.x) * smooth;
    v.y += (p.y - v.y) * smooth;
    v.body
      .setPosition(v.x, v.y + (moving ? Math.sin(time * 0.022) * 1.2 : 0))
      .setTexture(`${p.team}-${p.classId}-${moving ? Math.floor(time / 110) % 2 : 0}`)
      .setFlipX(Math.cos(p.angle) < 0);
    v.body
      .setAngle(p.hp <= 0 ? 90 : 0)
      .setAlpha(p.eliminated?.08:p.hp<=0?.2:p.dashInvulnerable?.45:p.invuln>0?.55+Math.sin(time*.025)*.25:1);
    if (p.hitFlash > 0) v.body.setTintFill(0xffe6ba);
    else v.body.clearTint();
    v.shadow.setPosition(v.x, v.y + 8);
    v.name.setPosition(v.x, v.y - 34).setText(local ? `${p.name} · VOS` : p.name);
    const stats=CLASSES[p.classId], w=v.weapon;
    w.clear();w.setPosition(v.x,v.y);w.setRotation(p.angle);
    if(p.hp>0){
      if(p.classId==='archer') {
        const charge = Math.min(1, Math.max(0, p.shotCharge / RULES.chargeTime));
        const red = 0xf04432;
        const channel = (shift: number) => Math.round(((GOLD >> shift) & 255) + (((red >> shift) & 255) - ((GOLD >> shift) & 255)) * charge);
        const bowColor = (channel(16) << 16) | (channel(8) << 8) | channel(0);
        w.lineStyle(2,bowColor);w.beginPath();w.arc(9,0,15,-Math.PI/2,Math.PI/2);w.strokePath();
        w.lineStyle(1,0xdad6bd);w.lineBetween(9,-15,9,15);
        if(p.windup>0){w.fillStyle(0xe3e5d5);w.fillRect(12,-2,14,3);}
      } else if(p.classId==='necromancer') {
        w.lineStyle(3,0x4a3a2b);w.lineBetween(6,4,28,-2);
        w.fillStyle(0xe8e2c8);w.fillCircle(29,-3,4);w.fillStyle(0x26353b);w.fillRect(27,-4,1,1);w.fillRect(30,-4,1,1);
        if(p.summonCd>RULES.summonCooldown-.4){w.lineStyle(2,0xa070e0,.7);w.strokeCircle(29,-3,9);}
      } else if(p.classId==='mage') {
        w.lineStyle(4,0x796452);w.lineBetween(8,0,30,0);
        w.fillStyle(0x8edcff);w.fillCircle(32,0,6);w.lineStyle(2,0xe8f7ff,.85);w.strokeCircle(32,0,7);
        if(p.windup>0){w.lineStyle(2,0xb9edff,.65);w.strokeCircle(32,0,11);}
      } else {
        const wind = p.windup > 0 ? Math.min(1, p.windup / stats.windup) : 0;
        w.setRotation(p.angle - wind * 0.9);
        w.fillStyle(0xe3e5d5);
        w.fillRect(11, -2, p.classId === 'vanguard' ? 43 : 23, p.classId === 'vanguard' ? 5 : 3);
        w.fillStyle(GOLD);
        w.fillRect(12, -7, 3, 14);
        w.fillStyle(0x77634b);
        w.fillRect(6, -2, 7, 4);
        if (p.classId === 'guardian') {
          w.setRotation(p.angle);
          w.fillStyle(p.guarding ? GOLD : 0x738b86);
          w.fillPoints(
            [
              { x: 14, y: -11 },
              { x: 24, y: -8 },
              { x: 24, y: 8 },
              { x: 14, y: 11 },
              { x: 9, y: 0 },
            ],
            true,
          );
          w.lineStyle(2, 0x435955);
          w.lineBetween(17, -7, 17, 7);
          w.lineBetween(12, 0, 22, 0);
          if (p.guarding) {
            w.lineStyle(3, GOLD, 0.8);
            w.beginPath();
            w.arc(0, 0, 31, -RULES.guardArc / 2, RULES.guardArc / 2);
            w.strokePath();
          }
        }
      }
    }
    v.hp.clear();
    if (p.hp > 0) this.drawCharge(v.hp, p, v.x, v.y, time);
    if (p.hp > 0 && p.frozenLeft > 0) {
      v.body.setTint(0x9fe8ff);
      v.hp.fillStyle(0xbff4ff, 0.28);
      v.hp.fillRoundedRect(v.x - 15, v.y - 27, 30, 38, 5);
      v.hp.lineStyle(1, 0xe8fbff, 0.8);
      v.hp.strokeRoundedRect(v.x - 15, v.y - 27, 30, 38, 5);
    }
    if (p.hp > 0 && p.classId === 'mage' && p.magicShieldHits > 0) {
      v.hp.fillStyle(0x78cfff,.10);v.hp.fillCircle(v.x,v.y-3,25);
      v.hp.lineStyle(2,0x9deaff,.8);v.hp.strokeCircle(v.x,v.y-3,25);
      if(p.magicShieldHits===2){v.hp.lineStyle(1,0xe6faff,.55);v.hp.strokeCircle(v.x,v.y-3,29);}
    }
    if (p.hp > 0) {
      const left=v.x-(p.maxHp*8-2)/2;
      for (let i=0;i<p.maxHp;i++) {
        v.hp.fillStyle(0x1a282c);v.hp.fillRect(left+i*8,v.y-25,6,3);
        const fill=Math.min(1,Math.max(0,p.hp-i));
        v.hp.fillStyle(COLORS[p.team]);v.hp.fillRect(left+i*8,v.y-25,6*fill,3);
      }
      if (local) {
        v.hp.lineStyle(1, GOLD, 0.6);
        v.hp.strokeEllipse(v.x, v.y + 9, 32, 12);
      }
    } else {
      v.name.setText(p.eliminated ? `☠ ${p.name}` : `${p.name} · ${Math.ceil(p.respawnLeft)}`);
    }
  }
  private drawZombie(z: Zombie, time: number, delta: number) {
    let v = this.zombieVisuals.get(z.id);
    if (!v) {
      v = {
        body: this.add.sprite(z.x, z.y, `${z.team}-zombie-0`).setOrigin(0.5, 0.7).setDepth(10),
        hp: this.add.graphics().setDepth(13),
        fx: this.add.graphics().setDepth(14),
        label:
          z.kind === 'thrall'
            ? this.add
                .text(z.x, z.y - 34, `☠ ${z.name ?? ''}`, {
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#c9ffd8',
                  stroke: '#10241a',
                  strokeThickness: 3,
                })
                .setOrigin(0.5)
                .setDepth(13)
            : undefined,
        x: z.x,
        y: z.y,
      };
      this.zombieVisuals.set(z.id, v);
    }
    const moving = Math.hypot(z.x - v.x, z.y - v.y) > 0.3;
    const smooth = 1 - Math.exp(-delta / 55);
    v.x += (z.x - v.x) * smooth;
    v.y += (z.y - v.y) * smooth;
    const frame = moving ? Math.floor(time / 160) % 2 : 0;
    const texture =
      z.kind === 'hat'
        ? `${z.team}-hat-${frame}`
        : z.kind === 'thrall'
          ? `${z.team}-${z.classId ?? 'guardian'}-undead-${frame}`
          : `${z.team}-zombie-${frame}`;
    v.body
      .setPosition(v.x, v.y + (moving ? Math.sin(time * 0.015) * 1.5 : 0))
      .setTexture(texture)
      .setFlipX(Math.cos(z.angle) < 0)
      .setAngle(
        z.windup > 0
          ? Math.sin(time * 0.05) * 8
          : z.kind === 'hat'
            ? (moving ? Math.sin(time * 0.011) * 5 : Math.sin(time * 0.003) * 2) -
              (z.cast > 0 ? Math.cos(z.angle) * 6 : 0)
            : 0,
      )
      .setScale(z.kind === 'hat' ? 1.15 : 1)
      .setAlpha(Math.min(1, z.life / 1.5));
    if (z.frozenLeft > 0) v.body.setTint(0x9fe8ff);
    else v.body.clearTint();
    v.label?.setPosition(v.x, v.y - 34);
    v.hp.clear();
    const bars = Math.ceil(z.maxHp);
    const left = v.x - (bars * 8 - 2) / 2;
    for (let i = 0; i < bars; i++) {
      v.hp.fillStyle(0x1a282c);
      v.hp.fillRect(left + i * 8, v.y - 25, 6, 2);
      v.hp.fillStyle(z.kind === 'hat' ? 0xb06cff : COLORS[z.team]);
      v.hp.fillRect(left + i * 8, v.y - 25, 6 * Math.min(1, Math.max(0, z.hp - i)), 2);
    }
    if (z.windup > 0) {
      v.hp.lineStyle(1, 0x9bd17a, 0.5);
      v.hp.strokeCircle(v.x, v.y, RULES.zombieRange);
    }
    v.fx.clear();
    if (z.frozenLeft > 0) {
      v.fx.fillStyle(0xbff4ff, 0.28);
      v.fx.fillRoundedRect(v.x - 14, v.y - 26, 28, 36, 5);
      v.fx.lineStyle(1, 0xe8fbff, 0.8);
      v.fx.strokeRoundedRect(v.x - 14, v.y - 26, 28, 36, 5);
    }
    if (z.kind !== 'hat') return;
    v.fx.fillStyle(0x2b0f3a, 0.3 + Math.sin(time * 0.005) * 0.1);
    v.fx.fillEllipse(v.x, v.y + 9, 46, 16);
    const until = 1 - Math.max(0, z.spawnLeft) / RULES.hatSpawnEvery;
    v.fx.lineStyle(2, 0xb06cff, 0.8);
    v.fx.beginPath();
    v.fx.arc(v.x, v.y + 9, 14, -Math.PI / 2, -Math.PI / 2 + until * Math.PI * 2);
    v.fx.strokePath();
    this.drawRevivedCaster(v.fx, z, v.x, v.y, time, moving);
  }
  /**
   * A revived corpse with a staff: the free arm hangs limp and sways, the staff is planted with
   * each shamble; to cast, the staff rises overhead with fire while the other hand thrusts ice.
   */
  private drawRevivedCaster(
    g: Phaser.GameObjects.Graphics,
    z: Zombie,
    x: number,
    y: number,
    time: number,
    moving: boolean,
  ) {
    const face = Math.cos(z.angle) < 0 ? -1 : 1;
    const seed = Number(z.id.slice(1)) || 0;
    const gait = moving ? Math.sin(time * 0.011 + seed) : Math.sin(time * 0.0025 + seed) * 0.3;
    const cast = z.cast > 0 ? 1 - z.cast / RULES.hatCastTime : 0;
    const recoil = Math.max(0, (z.castCd - (RULES.hatCastCooldown - 0.25)) / 0.25);
    const shoulderY = y - 11 + Math.abs(gait) * 1.5;
    const front = { x: x + face * 7, y: shoulderY },
      back = { x: x - face * 6, y: shoulderY + 1 };
    let staffHand = { x: front.x + face * 5, y: front.y + 11 + gait * 2 };
    let offHand = { x: back.x - face + gait * 3, y: back.y + 13 - Math.abs(gait) };
    let tilt = face * (0.08 + gait * 0.05);
    if (cast > 0) {
      staffHand = { x: front.x + face * (5 + 3 * cast), y: front.y + 11 - 32 * cast };
      offHand = { x: back.x + face * (6 + 16 * cast), y: back.y + 6 - 10 * cast };
      tilt = face * 0.35 * cast;
    } else if (recoil > 0) {
      staffHand = { x: front.x + face * (8 + 12 * recoil), y: front.y - 10 * recoil };
      offHand = { x: back.x + face * (10 + 14 * recoil), y: back.y - 2 * recoil };
      tilt = face * 0.6 * recoil;
    }
    const top = { x: staffHand.x + Math.sin(tilt) * 26, y: staffHand.y - Math.cos(tilt) * 26 };
    const foot = { x: staffHand.x - Math.sin(tilt) * 12, y: staffHand.y + Math.cos(tilt) * 12 };
    g.lineStyle(3, 0x3a281b, 1);
    g.lineBetween(foot.x, foot.y, top.x, top.y);
    g.lineStyle(1, 0x6b4a30, 1);
    g.lineBetween(foot.x, foot.y, top.x, top.y);
    const pulse = 0.6 + Math.sin(time * 0.01) * 0.4;
    g.fillStyle(cast > 0 || recoil > 0 ? 0xff8a3c : 0xb06cff, 0.25 + cast * 0.35);
    g.fillCircle(top.x, top.y - 2, 5 + pulse * 2 + cast * 8);
    g.fillStyle(0xd6cfb3);
    g.fillCircle(top.x, top.y - 2, 3.5);
    g.fillStyle(0x1a1414);
    g.fillRect(top.x - 2, top.y - 3, 1, 1);
    g.fillRect(top.x + 1, top.y - 3, 1, 1);
    if (cast > 0) {
      g.fillStyle(0xffd36b, 0.95);
      g.fillCircle(top.x, top.y - 2, 2 + cast * 4);
      g.fillStyle(0x9fe8ff, 0.35);
      g.fillCircle(offHand.x, offHand.y, 3 + cast * 6);
      g.fillStyle(0xe8fbff, 0.95);
      g.fillCircle(offHand.x, offHand.y, 1.5 + cast * 3);
    }
    for (const [shoulder, hand] of [
      [back, offHand],
      [front, staffHand],
    ]) {
      const elbow = { x: (shoulder.x + hand.x) / 2 - face * 2, y: (shoulder.y + hand.y) / 2 + 3 };
      for (const [width, color] of [
        [4, 0x1d241c],
        [2, 0x8c9a82],
      ]) {
        g.lineStyle(width, color, 1);
        g.lineBetween(shoulder.x, shoulder.y, elbow.x, elbow.y);
        g.lineBetween(elbow.x, elbow.y, hand.x, hand.y);
      }
      g.fillStyle(0x8c9a82);
      g.fillCircle(hand.x, hand.y, 2);
      g.lineStyle(1, 0xd6cfb3, 0.9);
      g.lineBetween(hand.x, hand.y, hand.x + face * 2, hand.y + 2);
    }
  }
  update(time: number, delta: number) {
    if (!this.controls || !this.snapshot) return;
    let s = this.snapshot;
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator >= 1000 / 30) {
      this.accumulator -= 1000 / 30;
      if (this.localStep) {
        const input = this.controls.read(++this.seq);
        this.localStep(input);
        s = this.snapshot!;
        continue;
      }
      if (this.controls.enabled) {
        const input = this.controls.read(++this.seq);
        this.send(input);
        this.pending.push(input);
        if (this.pending.length > 90) this.pending.shift();
        if (this.predicted)
          movePlayer(
            this.predicted,
            input,
            s.flags.some((f) => f.carrier === this.localId),
          );
      }
    }
    for (const p of s.players)
      this.drawPlayer(
        p.id === this.localId && this.predicted
          ? {
              ...p,
              x: this.predicted.x,
              y: this.predicted.y,
              angle: this.controls.angle,
              shotCharge: this.predicted.shotCharge,
              specialCharge: this.predicted.specialCharge,
              guarding: this.predicted.guarding,
              guardLeft: this.predicted.guardLeft,
              dashInvulnerable: this.predicted.dashInvulnerable,
              windup: this.predicted.windup,
            }
          : p,
        p.id === this.localId,
        time,
        delta,
      );
    for (const z of s.zombies) this.drawZombie(z, time, delta);
    for (const [id, v] of this.zombieVisuals) {
      if (s.zombies.some((z) => z.id === id)) continue;
      v.body.destroy();
      v.hp.destroy();
      v.fx.destroy();
      v.label?.destroy();
      this.zombieVisuals.delete(id);
    }
    const flags = s.flags.map((f) => {
      const carrier = f.carrier ? this.visuals.get(f.carrier) : undefined;
      return carrier ? { ...f, x: carrier.x, y: carrier.y } : f;
    });
    this.paintFlags(flags);
    this.traps.clear();
    for (const trap of s.traps) {
      const color = 0x89816a;
      this.traps.lineStyle(1,color,trap.armLeft>0?.16:.3);
      this.traps.strokeCircle(trap.x,trap.y,RULES.trapRadius);
      for(let i=0;i<8;i++) { const a=i*Math.PI/4;
        this.traps.lineBetween(trap.x+Math.cos(a)*16,trap.y+Math.sin(a)*16,trap.x+Math.cos(a)*10,trap.y+Math.sin(a)*10);
      }
      this.traps.fillStyle(color,.2); this.traps.fillCircle(trap.x,trap.y,3);
    }
    this.arrows.clear();
    for (const a of s.arrows) {
      const age = s.paused ? 0 : Math.min((performance.now() - this.receivedAt) / 1000, 1 / 15);
      const next = {
        x: a.x + Math.cos(a.angle) * projectileStats(a.classId, a.charged, a.power).speed * age,
        y: a.y + Math.sin(a.angle) * projectileStats(a.classId, a.charged, a.power).speed * age,
      };
      const p = lineClear(a, next) ? next : a;
      const grow = 1 + (a.power ?? 0);
      if (a.element === 'ice') {
        const dx = Math.cos(a.angle),
          dy = Math.sin(a.angle);
        this.arrows.lineStyle(4, 0x9fe8ff, 0.3);
        this.arrows.lineBetween(p.x - dx * 16, p.y - dy * 16, p.x, p.y);
        this.arrows.fillStyle(0xdffaff);
        this.arrows.fillTriangle(p.x + dx * 7, p.y + dy * 7, p.x - dy * 4, p.y + dx * 4, p.x + dy * 4, p.y - dx * 4);
        this.arrows.fillTriangle(p.x - dx * 5, p.y - dy * 5, p.x - dy * 4, p.y + dx * 4, p.x + dy * 4, p.y - dx * 4);
      } else if ((a.classId === 'mage' || a.classId === 'necromancer') && (a.power ?? 0) > 0.05) {
        this.drawBlaze(p, a.angle, a.power!, time, a.classId === 'necromancer' ? 0xc26bff : 0xff6a1f);
      } else if(a.classId==='necromancer') {
        const size = grow * (a.element === 'fire' ? 0.6 : 1);
        this.arrows.lineStyle(6*size,0xff7a2f,.25);
        this.arrows.lineBetween(p.x-Math.cos(a.angle)*18*grow,p.y-Math.sin(a.angle)*18*grow,p.x,p.y);
        this.arrows.fillStyle(0xff9a3c,.5);this.arrows.fillCircle(p.x,p.y,8*size);
        this.arrows.fillStyle(0xffe08a);this.arrows.fillCircle(p.x,p.y,4*size);
      } else if(a.classId==='mage') {
        if (a.power) {
          this.arrows.fillStyle(0xff4a1a, 0.18);
          this.arrows.fillCircle(p.x, p.y, 16 * grow);
        }
        this.arrows.lineStyle(5*grow,0xff6326,.35);
        this.arrows.lineBetween(p.x-Math.cos(a.angle)*16*grow,p.y-Math.sin(a.angle)*16*grow,p.x,p.y);
        this.arrows.fillStyle(0xff982c,.7);this.arrows.fillCircle(p.x,p.y,7*grow);
        this.arrows.fillStyle(0xffed9b);this.arrows.fillCircle(p.x,p.y,3*grow);
      } else {
        this.arrows.lineStyle(a.charged ? 4 : 2, a.charged ? 0xff842f : 0xe3cf96);
        this.arrows.lineBetween(
          p.x - Math.cos(a.angle) * 12,
          p.y - Math.sin(a.angle) * 12,
          p.x,
          p.y,
        );
        this.arrows.fillStyle(a.charged ? 0xffb24a : 0xf2e9cf);
        this.arrows.fillCircle(p.x, p.y, 2);
      }
    }
    this.aim.clear();
    if (this.controls.enabled && this.predicted) {
      const p = this.predicted,
        a = this.controls.angle;
      this.aim.lineStyle(1, GOLD, 0.6);
      this.aim.lineBetween(
        p.x + Math.cos(a) * 22,
        p.y + Math.sin(a) * 22,
        p.x + Math.cos(a) * 45,
        p.y + Math.sin(a) * 45,
      );
      this.aim.strokeCircle(p.x + Math.cos(a) * 48, p.y + Math.sin(a) * 48, 3);
      if (CLASSES[p.classId].summon && p.specialCharge >= RULES.overchargeTime) {
        const flicker = 0.5 + Math.sin(time * 0.02) * 0.5;
        const corpse = s.players
          .filter((q) => q.team !== p.team && q.hp <= 0 && !q.eliminated && distance(q, p) <= RULES.raiseRange)
          .sort((m, n) => distance(m, p) - distance(n, p))[0];
        if (corpse && !s.zombies.some((z) => z.owner === this.localId)) {
          this.aim.lineStyle(2, 0x7dffb0, 0.45 + flicker * 0.45);
          this.aim.lineBetween(p.x, p.y - 4, corpse.x, corpse.y);
        } else {
          this.aim.lineStyle(1, 0x8a8f8a, 0.2 + flicker * 0.4);
          this.aim.strokeCircle(p.x, p.y - 4, 36);
        }
      }
    }
  }
}
