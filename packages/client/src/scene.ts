import Phaser from 'phaser';
import {
  RULES,
  CLASSES,
  CLASS_IDS,
  DEFAULT_CLASS,
  MAPS,
  TEAMS,
  TEAM_NAMES,
  TEAM_ICONS,
  layout,
  projectileStats,
  arrowMotion,
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
  type MapId,
} from '@bandera/shared';
import { Controls } from './input.js';
import { blueprintSpec, clipRay } from './targeting.js';
import { sound } from './audio.js';
import {
  CLASS_ART,
  ZOMBIE_ART,
  HAT_ZOMBIE_ART,
  palette,
  zombiePalette,
  hatPalette,
  undeadPalette,
} from './art.js';

const GOLD = 0xf3ce86;
const COLORS: Record<Team, number> = {
  blue: 0x73bbef,
  red: 0xee8b79,
  green: 0x86cf97,
  violet: 0xbf98ea,
};
const LIGHT: Record<Team, string> = {
  blue: '#8cc5e7',
  red: '#efa08b',
  green: '#9fdcae',
  violet: '#c9aef0',
};
const CLOTH: Record<Team, string> = {
  blue: '#548cb7',
  red: '#b66558',
  green: '#4f9a68',
  violet: '#8062a8',
};
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
      aura: Phaser.GameObjects.Graphics;
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
  private currentMapId: MapId = 'courtyard';
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private cameraKey = '';
  constructor() {
    super('arena');
  }
  create() {
    this.drawMap(this.currentMapId);
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
      this.controls.angle = Math.atan2(p.worldY - this.predicted.y, p.worldX - this.predicted.x);
      this.controls.aimX = Math.max(0, Math.min(RULES.width, p.worldX));
      this.controls.aimY = Math.max(0, Math.min(RULES.height, p.worldY));
      this.controls.aimFromPointer = true;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !this.controls.enabled) return;
      // Use the button that triggered this event. `rightButtonDown()` also stays true
      // while a left click is pressed during guard and would swallow that attack.
      if (p.button === 1) this.controls.tertiary();
      else if (p.button === 2) this.controls.secondary(true);
      else this.controls.primary();
    });
    const preview = layout(['blue', 'red'], this.currentMapId, 'duel');
    this.drawBases(preview);
    this.paintFlags(
      preview.map(
        (b) =>
          ({ ...b.home, team: b.team, status: 'home', carrier: null }) as Snapshot['flags'][number],
      ),
    );
    for (const b of preview) this.drawPlayer(newPlayer(`preview-${b.team}`, '', b.team), false, 0);
  }
  private makeTextures() {
    for (const team of TEAMS)
      for (const classId of CLASS_IDS)
        for (let frame = 0; frame < 2; frame++) {
          const data = CLASS_ART[classId].map((row, i) =>
            frame === 1 && i >= 13
              ? row.slice(0, 3) + row.slice(3, 13).split('').reverse().join('') + row.slice(13)
              : row,
          );
          this.textures.generate(`${team}-${classId}-${frame}`, {
            data,
            pixelWidth: 2,
            palette: palette(CLOTH[team], LIGHT[team]) as Phaser.Types.Create.Palette,
          });
        }
    for (const team of TEAMS)
      for (let frame = 0; frame < 2; frame++) {
        const data = ZOMBIE_ART.map((row, i) =>
          frame === 1 && i >= 11
            ? row.slice(0, 3) + row.slice(3, 13).split('').reverse().join('') + row.slice(13)
            : row,
        );
        this.textures.generate(`${team}-zombie-${frame}`, {
          data,
          pixelWidth: 2,
          palette: zombiePalette(CLOTH[team], LIGHT[team]) as Phaser.Types.Create.Palette,
        });
      }
    const stride = (rows: string[], from: number, frame: number) =>
      rows.map((row, i) =>
        frame === 1 && i >= from
          ? row.slice(0, 3) + row.slice(3, 13).split('').reverse().join('') + row.slice(13)
          : row,
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
  private drawMap(mapId: MapId) {
    this.currentMapId = mapId;
    this.mapObjects.forEach((object) => object.destroy());
    this.mapObjects = [];
    const map = MAPS[mapId];
    const g = this.add.graphics();
    this.mapObjects.push(g);
    const ground =
      map.theme === 'forest'
        ? 0x193329
        : map.theme === 'ruins'
          ? 0x292d30
          : map.theme === 'crossroads'
            ? 0x283537
            : 0x18272c;
    g.fillStyle(ground);
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
    for (const bush of map.bushes) {
      g.fillStyle(0x1a472c, 0.68);
      g.fillRoundedRect(bush.x, bush.y, bush.w, bush.h, 13);
      g.lineStyle(2, 0x57945c, 0.38);
      g.strokeRoundedRect(bush.x, bush.y, bush.w, bush.h, 13);
      for (let y = bush.y + 8; y < bush.y + bush.h; y += 14)
        for (let x = bush.x + 9; x < bush.x + bush.w; x += 18) {
          g.fillStyle((x + y) % 4 ? 0x2f7042 : 0x4d8950, 0.5);
          g.fillCircle(x, y, 6);
        }
    }
    for (const w of map.walls) wall(w.x, w.y, w.w, w.h);
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
      this.mapObjects.push(glow);
      this.tweens.add({ targets: glow, alpha: 0.35, duration: 850 + x, yoyo: true, repeat: -1 });
    }
  }
  receive(snapshot: Snapshot, id: string) {
    if (!this.controls) return;
    if (snapshot.mapId !== this.currentMapId) {
      this.drawMap(snapshot.mapId);
      this.layoutKey = '';
    }
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
            RULES.tick,
            MAPS[snapshot.mapId].walls,
          );
    }
    this.phase = snapshot.phase;
    this.controls.enabled =
      snapshot.phase === 'playing' && !snapshot.paused && !!own?.hp && own.stunLeft <= 0;
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
        const color = e.kind === 'block' ? GOLD : COLORS[e.team];
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
        const pulse = this.add.rectangle(480, 270, 960, 540, COLORS[e.team], 0.2).setDepth(25);
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
    this.tweens.add({
      targets: target,
      ...props,
      alpha: 0,
      duration,
      onComplete: () => target.destroy(),
    });
  }
  private spellEffect(e: Snapshot['events'][number]) {
    if (e.kind === 'explosion') {
      const radius = RULES.explosionRadius * (0.6 + 0.4 * (e.power ?? 1));
      this.fade(
        this.add.circle(e.x, e.y, 10, 0xff7a2f, 0.6).setDepth(16),
        { scale: radius / 10 },
        380,
      );
      this.fade(
        this.add.circle(e.x, e.y, 8).setStrokeStyle(3, 0xffe08a, 0.95).setDepth(16),
        { scale: 6 },
        460,
      );
    } else if (e.kind === 'icecone') {
      this.iceBreeze(e.x, e.y, e.angle ?? 0);
    } else if (e.kind === 'freeze') {
      this.fade(
        this.add.star(e.x, e.y - 6, 6, 4, 13, 0xbff4ff, 0.85).setDepth(16),
        { scale: 1.9, angle: 45 },
        520,
      );
    } else if (e.kind === 'heal') {
      const plus = this.add
        .text(e.x, e.y - 24, '+', {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#7dffa0',
          stroke: '#0b2a14',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(16);
      this.fade(plus, { y: e.y - 44 }, 700);
    } else if (e.kind === 'raise') {
      this.fade(
        this.add.rectangle(e.x, e.y - 40, 22, 96, 0x7dffb0, 0.4).setDepth(16),
        { scaleX: 0 },
        760,
      );
      this.fade(
        this.add
          .ellipse(e.x, e.y + 8, 30, 12)
          .setStrokeStyle(2, 0x7dffb0, 0.9)
          .setDepth(4),
        { scale: 3 },
        760,
      );
    } else if (e.kind === 'levelup') {
      this.fade(
        this.add
          .circle(e.x, e.y - 4, 12)
          .setStrokeStyle(3, 0xffd36b, 0.95)
          .setDepth(16),
        { scale: 3 },
        520,
      );
      const text = this.add
        .text(e.x, e.y - 40, `NV ${e.power ?? 2}`, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffd36b',
          stroke: '#2a1a06',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(17);
      this.fade(text, { y: e.y - 62 }, 900);
    } else if (e.kind === 'counter') {
      this.fade(
        this.add.star(e.x, e.y - 4, 8, 6, 20, e.power ? 0xff9a3c : 0xffd36b, 0.9).setDepth(16),
        { scale: 2, angle: 60 },
        380,
      );
    } else if (e.kind === 'slash') {
      // The warrior's slash leaves the blade as a white crescent.
      const flash = this.add.graphics().setDepth(16);
      flash.lineStyle(4, 0xfff3d6, 0.9);
      flash.beginPath();
      flash.arc(e.x, e.y - 4, 30, (e.angle ?? 0) - 1.2, (e.angle ?? 0) + 1.2);
      flash.strokePath();
      this.fade(flash, {}, 260);
    } else if (e.kind === 'dash') {
      const angle = e.angle ?? 0;
      const trail = this.add
        .rectangle(e.x - Math.cos(angle) * 20, e.y - Math.sin(angle) * 20, 58, 14, 0x541923, 0.52)
        .setRotation(angle)
        .setDepth(8);
      this.fade(trail, { scaleX: 1.9, scaleY: 0.25 }, 300);
      this.fade(
        this.add.circle(e.x, e.y, 11).setStrokeStyle(3, 0xc26a58, 0.85).setDepth(16),
        { scale: 2.5 },
        260,
      );
      if (e.power) this.cameras.main.shake(90, 0.0025);
    } else if (e.kind === 'bash') {
      const flash = this.add.graphics().setDepth(16);
      flash.lineStyle(7, 0xe1c37a, 0.9);
      flash.beginPath();
      flash.arc(
        e.x,
        e.y,
        RULES.shieldBashRange,
        (e.angle ?? 0) - RULES.shieldBashArc / 2,
        (e.angle ?? 0) + RULES.shieldBashArc / 2,
      );
      flash.strokePath();
      this.fade(flash, { scaleX: 1.12, scaleY: 1.12 }, 220);
      this.fade(this.add.circle(e.x, e.y, 9, 0xffe5a0, 0.65).setDepth(17), { scale: 2.2 }, 190);
    } else if (e.kind === 'fury') {
      this.fade(this.add.circle(e.x, e.y - 3, 17, 0x621522, 0.42).setDepth(9), { scale: 2.8 }, 520);
      this.fade(
        this.add
          .circle(e.x, e.y - 3, 18)
          .setStrokeStyle(4, 0xc83d43, 0.85)
          .setDepth(16),
        { scale: 3.2 },
        620,
      );
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        this.fade(
          this.add
            .circle(e.x + Math.cos(angle) * 10, e.y + Math.sin(angle) * 10, 3, 0x9f2634, 0.8)
            .setDepth(16),
          { x: e.x + Math.cos(angle) * 42, y: e.y + Math.sin(angle) * 42 - 8 },
          500,
        );
      }
    } else if (e.kind === 'wind') {
      this.fade(
        this.add
          .ellipse(e.x, e.y + 6, 30, 12)
          .setStrokeStyle(2, 0xd8fbff, 0.9)
          .setDepth(16),
        { scale: 3.2 },
        420,
      );
      for (const side of [-1, 1]) {
        const a = (e.angle ?? 0) + Math.PI + side * 0.5;
        this.fade(
          this.add.rectangle(e.x, e.y, 18, 2, 0xe8fbff, 0.85).setRotation(a).setDepth(16),
          { x: e.x + Math.cos(a) * 44, y: e.y + Math.sin(a) * 44 },
          380,
        );
      }
    } else if (e.kind === 'mandala') {
      this.fade(
        this.add
          .ellipse(e.x, e.y + 8, 20, 9)
          .setStrokeStyle(2, 0x7dffb0, 0.9)
          .setDepth(4),
        { scale: 3.5 },
        520,
      );
    } else if (e.kind === 'shot' && (e.power ?? 0) > 0.05) {
      const power = e.power ?? 0;
      this.fade(
        this.add.circle(e.x, e.y, 10, 0xff7a2f, 0.6).setDepth(16),
        { scale: 2.5 + power * 2 },
        300,
      );
      this.fade(
        this.add.circle(e.x, e.y, 6).setStrokeStyle(3, 0xffe08a, 0.9).setDepth(16),
        { scale: 5 + power * 3 },
        380,
      );
    } else if (e.kind === 'summon' && e.power) {
      this.fade(
        this.add
          .ellipse(e.x, e.y + 8, 36, 14)
          .setStrokeStyle(3, 0xb06cff, 0.9)
          .setDepth(4),
        { scale: 3.4 },
        700,
      );
    }
  }
  /** Sword zombie: a notched blade raised and swung on windup, gold level pips, a glow once it cleaves. */
  private drawZombieSword(
    g: Phaser.GameObjects.Graphics,
    z: Zombie,
    x: number,
    y: number,
    time: number,
  ) {
    const facing = Math.cos(z.angle) < 0 ? -1 : 1;
    const swing = z.windup > 0 ? 1 - z.windup / RULES.zombieWindup : 0;
    const lift = z.windup > 0 ? -1.9 + swing * 2.6 : -0.9 + Math.sin(time * 0.006 + z.slot) * 0.12;
    const angle = facing > 0 ? lift : Math.PI - lift;
    const hand = { x: x + facing * 9, y: y - 4 };
    const length = 20 + z.level * 2;
    const dx = Math.cos(angle),
      dy = Math.sin(angle);
    const tip = { x: hand.x + dx * length, y: hand.y + dy * length };
    if (z.level >= RULES.swordZombieLevelMax) {
      g.lineStyle(7, 0xffc86b, 0.25 + Math.sin(time * 0.01) * 0.1);
      g.lineBetween(hand.x, hand.y, tip.x, tip.y);
    }
    g.lineStyle(3, 0x3a3f44, 1);
    g.lineBetween(hand.x, hand.y, tip.x, tip.y);
    g.lineStyle(1, 0xd7dde0, 1);
    g.lineBetween(hand.x + dx * 4, hand.y + dy * 4, tip.x, tip.y);
    g.lineStyle(2, 0x8a6a3c, 1);
    g.lineBetween(
      hand.x + dx * 4 - dy * 4,
      hand.y + dy * 4 + dx * 4,
      hand.x + dx * 4 + dy * 4,
      hand.y + dy * 4 - dx * 4,
    );
    for (let i = 0; i < z.level; i++) {
      const px = x - (z.level - 1) * 4 + i * 8,
        py = y - 31;
      g.fillStyle(0xffd36b, 1);
      g.fillTriangle(px, py - 3, px + 3, py, px - 3, py);
      g.fillTriangle(px, py + 3, px + 3, py, px - 3, py);
    }
  }
  /** Warrior's full counter ward: spinning golden arcs; charged it spins faster and burns orange. */
  private drawCounterWard(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    charged: boolean,
    progress: number,
    now: number,
  ) {
    g.lineStyle(2, charged ? 0xff9a3c : 0xffd36b, 0.9);
    for (let i = 0; i < 6; i++) {
      const from = now * (charged ? 0.012 : 0.006) + (i * Math.PI) / 3;
      g.beginPath();
      g.arc(x, y - 3, 24, from, from + 0.6);
      g.strokePath();
    }
    if (charged) {
      g.lineStyle(1, 0xffe7b1, 0.75);
      g.strokeCircle(x, y - 3, 29 + Math.sin(now * 0.02) * 2);
    } else {
      g.lineStyle(2, 0xfff3c4, 0.6);
      g.beginPath();
      g.arc(x, y - 3, 29, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      g.strokePath();
    }
  }
  /** A fighting thrall's skills: charge rune, dash streaks, raised guard, counter ward and magic shield. */
  private drawThrallSkills(
    g: Phaser.GameObjects.Graphics,
    z: Zombie,
    x: number,
    y: number,
    time: number,
  ) {
    const action = z.action;
    if (action && action.skill !== 'dash') {
      const progress = 1 - action.left / Math.max(1e-6, action.total);
      const color =
        action.skill === 'raise'
          ? 0x7dffb0
          : CLASSES[z.classId ?? 'guardian'].ranged
            ? 0xff8a3c
            : GOLD;
      g.lineStyle(2, color, 0.5 + progress * 0.4);
      g.strokeEllipse(x, y + 8, 30 + progress * 18, 12 + progress * 7);
      g.lineStyle(3, color, 0.9);
      g.beginPath();
      g.arc(x, y - 4, 20, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      g.strokePath();
    }
    if (action?.skill === 'dash') {
      const dx = Math.cos(action.angle),
        dy = Math.sin(action.angle);
      g.lineStyle(2, 0xd8fbff, 0.55);
      for (const offset of [-6, 0, 6])
        g.lineBetween(
          x - dy * offset,
          y + dx * offset,
          x - dy * offset - dx * 26,
          y + dx * offset - dy * 26,
        );
    }
    if (z.guardLeft > 0) {
      g.lineStyle(3, 0xeac787, 0.9);
      g.beginPath();
      g.arc(x, y - 3, 20, z.angle - RULES.guardArc / 2, z.angle + RULES.guardArc / 2);
      g.strokePath();
    }
    if (z.counterLeft > 0) this.drawCounterWard(g, x, y, false, 1, time);
    if (z.shieldHits > 0) {
      g.fillStyle(0x78cfff, 0.1);
      g.fillCircle(x, y - 3, 23);
      g.lineStyle(2, 0x9deaff, 0.75);
      g.strokeCircle(x, y - 3, 23);
    }
  }
  /** Zombie mage's ice spell: an expanding cone of freezing wind with white streaks and drifting shards. */
  private iceBreeze(x: number, y: number, angle: number) {
    const g = this.add.graphics().setDepth(15);
    const half = RULES.iceConeArc / 2;
    const shards = Array.from({ length: 16 }, () => ({
      spread: (Math.random() - 0.5) * RULES.iceConeArc,
      speed: 0.7 + Math.random() * 0.5,
      size: 1.5 + Math.random() * 2,
    }));
    const clock = { t: 0 };
    this.tweens.add({
      targets: clock,
      t: 1,
      duration: 460,
      onUpdate: () => {
        const t = clock.t,
          reach = RULES.iceConeRange * (0.35 + 0.65 * t),
          fade = 1 - Math.max(0, t - 0.6) / 0.4;
        g.clear();
        g.fillStyle(0x9fe0ff, 0.24 * fade);
        g.beginPath();
        g.slice(x, y, reach, angle - half, angle + half, false);
        g.fillPath();
        g.fillStyle(0xe6f8ff, 0.2 * fade);
        g.beginPath();
        g.slice(x, y, reach * 0.6, angle - half * 0.7, angle + half * 0.7, false);
        g.fillPath();
        g.lineStyle(2, 0xe6f8ff, 0.75 * fade);
        g.beginPath();
        g.arc(x, y, reach, angle - half, angle + half);
        g.strokePath();
        for (let i = -2; i <= 2; i++) {
          const a = angle + (i / 2) * half * 0.8,
            sway = Math.sin(t * 14 + i) * 0.06;
          g.lineStyle(1, 0xffffff, 0.55 * fade);
          g.lineBetween(
            x + Math.cos(a + sway) * reach * 0.25,
            y + Math.sin(a + sway) * reach * 0.25,
            x + Math.cos(a) * reach * 0.95,
            y + Math.sin(a) * reach * 0.95,
          );
        }
        for (const shard of shards) {
          const r = reach * Math.min(1, t * shard.speed * 1.4),
            a = angle + shard.spread,
            px = x + Math.cos(a) * r,
            py = y + Math.sin(a) * r;
          g.fillStyle(0xf4fdff, 0.9 * fade);
          g.fillTriangle(px, py - shard.size, px + shard.size, py, px, py + shard.size);
          g.fillTriangle(px, py - shard.size, px - shard.size, py, px, py + shard.size);
        }
      },
      onComplete: () => g.destroy(),
    });
  }
  /** Warrior's travelling slash: a bright crescent with fading after-images, thinning out as it ends. */
  private drawSlash(p: { x: number; y: number }, angle: number, life: number) {
    const g = this.arrows,
      fade = Math.min(1, life / 0.2),
      dx = Math.cos(angle),
      dy = Math.sin(angle),
      radius = RULES.slashRadius;
    g.lineStyle(10, 0xffe3a3, 0.18 * fade);
    g.beginPath();
    g.arc(p.x - dx * radius, p.y - dy * radius, radius, angle - 1, angle + 1);
    g.strokePath();
    for (let i = 2; i >= 0; i--) {
      const back = i * 9;
      g.lineStyle(i ? 3 : 5, i ? 0xd9d2bd : 0xfff8e6, (i ? 0.25 : 0.95) * fade);
      g.beginPath();
      g.arc(
        p.x - dx * (radius + back),
        p.y - dy * (radius + back),
        radius,
        angle - 1.15,
        angle + 1.15,
      );
      g.strokePath();
    }
  }
  /** Wind arrow: a pale shaft wrapped in spiralling gusts and a streaming trail. */
  private drawWind(p: { x: number; y: number }, angle: number, time: number, small: boolean) {
    const g = this.arrows,
      dx = Math.cos(angle),
      dy = Math.sin(angle),
      size = small ? 0.75 : 1;
    for (let i = 0; i < 14; i++) {
      const back = i * 5 * size,
        swirl = (5 + i * 0.6) * size,
        phase = time * 0.03 - i * 0.55;
      for (const side of [1, -1]) {
        const offset = Math.sin(phase) * swirl * side;
        g.fillStyle(i % 3 ? 0xd8fbff : 0x8fe3ff, (1 - i / 14) * 0.7);
        g.fillCircle(
          p.x - dx * back - dy * offset,
          p.y - dy * back + dx * offset,
          (2.2 - i * 0.1) * size,
        );
      }
    }
    g.lineStyle(1, 0xe8fbff, 0.5);
    for (const ring of [10, 22]) {
      const spin = time * 0.02 + ring;
      g.beginPath();
      g.arc(
        p.x - dx * ring * size,
        p.y - dy * ring * size,
        (8 + ring * 0.25) * size,
        spin,
        spin + Math.PI * 1.2,
      );
      g.strokePath();
    }
    g.lineStyle(3 * size, 0xf4feff, 0.95);
    g.lineBetween(p.x - dx * 16 * size, p.y - dy * 16 * size, p.x, p.y);
    g.fillStyle(0xffffff);
    g.fillTriangle(
      p.x + dx * 7 * size,
      p.y + dy * 7 * size,
      p.x - dy * 4 * size,
      p.y + dx * 4 * size,
      p.x + dy * 4 * size,
      p.y - dx * 4 * size,
    );
  }
  /** Original raising mandala on the ground: counter-rotating rune squares, orbiting petals, glowing core. */
  private drawMandala(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    time: number,
    alpha: number,
    color = 0x7dffb0,
    light = 0xe8fff0,
  ) {
    const flat = 0.45,
      spin = time * 0.0015;
    const at = (angle: number, r: number) => ({
      x: x + Math.cos(angle) * r,
      y: y + Math.sin(angle) * r * flat,
    });
    g.fillStyle(color, alpha * 0.2);
    g.fillEllipse(x, y, radius * 0.9, radius * 0.9 * flat);
    g.lineStyle(2, color, alpha);
    g.strokeEllipse(x, y, radius * 2, radius * 2 * flat);
    g.lineStyle(1, light, alpha * 0.8);
    g.strokeEllipse(x, y, radius * 1.35, radius * 1.35 * flat);
    for (const [turn, dir] of [
      [0, 1],
      [Math.PI / 4, -1],
    ]) {
      g.lineStyle(1, color, alpha * 0.9);
      g.strokePoints(
        [0, 1, 2, 3].map((i) => at(spin * dir + turn + (i * Math.PI) / 2, radius * 0.95)),
        true,
      );
    }
    for (let i = 0; i < 8; i++) {
      const petal = at(-spin * 1.5 + (i * Math.PI) / 4, radius * 0.68);
      g.fillStyle(light, alpha * 0.85);
      g.fillCircle(petal.x, petal.y, 1.8);
    }
  }
  /** Charged fire: roaring core, long flickering flame trail, corona and orbiting embers. */
  private drawBlaze(
    p: { x: number; y: number },
    angle: number,
    power: number,
    time: number,
    core: number,
  ) {
    const g = this.arrows,
      dx = Math.cos(angle),
      dy = Math.sin(angle);
    for (let i = 9; i >= 1; i--) {
      const back = i * (8 + power * 7),
        fade = 1 - i / 10,
        wobble = Math.sin(time * 0.035 + i * 1.3) * (2 + power * 2);
      g.fillStyle(i % 2 ? 0xff3d0d : 0xffa132, 0.1 + fade * 0.3);
      g.fillCircle(
        p.x - dx * back - dy * wobble,
        p.y - dy * back + dx * wobble,
        (5 + power * 11) * fade + 2,
      );
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
  private drawCharge(
    g: Phaser.GameObjects.Graphics,
    p: Player,
    x: number,
    y: number,
    time: number,
  ) {
    const stats = CLASSES[p.classId];
    const special = p.specialCharge > 0;
    if (!special && p.shotCharge <= 0) return;
    const seconds = special ? p.specialCharge : p.shotCharge;
    const power = p.classId === 'archer' && !special
      ? Math.min(1, seconds / RULES.chargeTime)
      : chargePower(seconds);
    const summoning = special && stats.summon;
    const raising = summoning && seconds >= RULES.overchargeTime;
    const color = p.classId === 'archer' && !special
      ? 0x9feeff
      : raising
      ? 0x7dffb0
      : summoning
        ? 0x9b59d0
        : special
          ? 0x9fe8ff
          : stats.ranged
            ? 0xff8a3c
            : GOLD;
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
      .setAlpha(
        p.eliminated
          ? 0.08
          : p.hp <= 0
            ? 0.2
            : p.dashInvulnerable
              ? 0.45
              : p.invuln > 0
                ? 0.55 + Math.sin(time * 0.025) * 0.25
                : 1,
      );
    if (p.hitFlash > 0) v.body.setTintFill(0xffe6ba);
    else v.body.clearTint();
    v.shadow.setPosition(v.x, v.y + 8);
    v.name.setPosition(v.x, v.y - 34).setText(local ? `${p.name} · VOS` : p.name);
    const stats = CLASSES[p.classId],
      w = v.weapon;
    w.clear();
    w.setPosition(v.x, v.y);
    w.setRotation(p.angle);
    if (p.hp > 0) {
      if (p.classId === 'archer') {
        const charge = Math.min(1, Math.max(0, p.shotCharge / RULES.chargeTime));
        w.lineStyle(2, GOLD);
        w.beginPath();
        w.arc(9, 0, 15, -Math.PI / 2, Math.PI / 2);
        w.strokePath();
        w.lineStyle(1, 0xdad6bd);
        w.lineBetween(9, -15, 9, 15);
        if (charge > 0) {
          const pulse = 0.45 + Math.sin(time * (0.012 + charge * 0.02)) * 0.2;
          w.lineStyle(1 + charge * 2, 0x9feeff, 0.25 + charge * 0.55);
          w.strokeCircle(10, 0, 8 + charge * 10 + pulse * 2);
          for (let i = 0; i < 3; i++) {
            const gust = time * 0.01 + i * (Math.PI * 2) / 3;
            w.lineBetween(8 + Math.cos(gust) * (7 + charge * 8), Math.sin(gust) * (5 + charge * 5), 15 + charge * 11, Math.sin(gust) * 3);
          }
        }
        if (p.windup > 0) {
          w.fillStyle(0xe3e5d5);
          w.fillRect(12, -2, 14, 3);
        }
      } else if (p.classId === 'necromancer') {
        w.lineStyle(3, 0x4a3a2b);
        w.lineBetween(6, 4, 28, -2);
        w.fillStyle(0xe8e2c8);
        w.fillCircle(29, -3, 4);
        w.fillStyle(0x26353b);
        w.fillRect(27, -4, 1, 1);
        w.fillRect(30, -4, 1, 1);
        if (p.summonCd > RULES.summonCooldown - 0.4) {
          w.lineStyle(2, 0xa070e0, 0.7);
          w.strokeCircle(29, -3, 9);
        }
      } else if (p.classId === 'mage') {
        w.lineStyle(4, 0x796452);
        w.lineBetween(8, 0, 30, 0);
        w.fillStyle(0x8edcff);
        w.fillCircle(32, 0, 6);
        w.lineStyle(2, 0xe8f7ff, 0.85);
        w.strokeCircle(32, 0, 7);
        if (p.windup > 0) {
          w.lineStyle(2, 0xb9edff, 0.65);
          w.strokeCircle(32, 0, 11);
        }
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
          if (p.shieldBashLeft > 0) {
            const progress = 1 - p.shieldBashLeft / RULES.shieldBashWindup;
            w.lineStyle(3, 0xffdfa0, 0.9);
            w.beginPath();
            w.arc(0, 0, 32 + progress * 12, -RULES.shieldBashArc / 2, RULES.shieldBashArc / 2);
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
      v.hp.fillStyle(0x78cfff, 0.1);
      v.hp.fillCircle(v.x, v.y - 3, 25);
      v.hp.lineStyle(2, 0x9deaff, 0.8);
      v.hp.strokeCircle(v.x, v.y - 3, 25);
      if (p.magicShieldHits === 2) {
        v.hp.lineStyle(1, 0xe6faff, 0.55);
        v.hp.strokeCircle(v.x, v.y - 3, 29);
      }
    }
    if (p.hp > 0 && p.classId === 'guardian' && p.furyLeft > 0) {
      const pulse = (Math.sin(time * 0.012) + 1) / 2;
      v.hp.fillStyle(0x52101d, 0.12 + pulse * 0.08);
      v.hp.fillCircle(v.x, v.y - 3, 25 + pulse * 4);
      v.hp.lineStyle(2, 0xa82334, 0.65 + pulse * 0.25);
      v.hp.strokeCircle(v.x, v.y - 3, 27 + pulse * 5);
      for (let i = 0; i < 5; i++) {
        const angle = time * 0.0025 + (i * Math.PI * 2) / 5;
        const radius = 18 + ((time * 0.025 + i * 9) % 13);
        v.hp.fillStyle(i % 2 ? 0x61111f : 0xb52c36, 0.55);
        v.hp.fillCircle(
          v.x + Math.cos(angle) * radius,
          v.y - 5 + Math.sin(angle) * radius * 0.65,
          1.5 + pulse,
        );
      }
    }
    if (p.hp > 0 && p.classId === 'guardian' && p.dashLeft > 0) {
      v.hp.fillStyle(0x3a1019, 0.22);
      for (let i = 1; i <= 3; i++)
        v.hp.fillEllipse(v.x - p.dashX * i * 11, v.y - p.dashY * i * 11, 21 - i * 3, 8 - i);
    }
    if (p.hp > 0 && p.counterLeft > 0)
      this.drawCounterWard(
        v.hp,
        v.x,
        v.y,
        p.counterCharge >= RULES.counterChargeTime - 1e-8,
        Math.min(1, p.counterCharge / RULES.counterChargeTime),
        this.time.now,
      );
    if (p.hp > 0) {
      const left = v.x - (p.maxHp * 8 - 2) / 2;
      for (let i = 0; i < p.maxHp; i++) {
        v.hp.fillStyle(0x1a282c);
        v.hp.fillRect(left + i * 8, v.y - 25, 6, 3);
        const fill = Math.min(1, Math.max(0, p.hp - i));
        v.hp.fillStyle(COLORS[p.team]);
        v.hp.fillRect(left + i * 8, v.y - 25, 6 * fill, 3);
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
        aura: this.add.graphics().setDepth(3),
        x: z.x,
        y: z.y,
      };
      this.zombieVisuals.set(z.id, v);
    }
    const moving = Math.hypot(z.x - v.x, z.y - v.y) > 0.3;
    const smooth = 1 - Math.exp(-delta / 55);
    v.x += (z.x - v.x) * smooth;
    v.y += (z.y - v.y) * smooth;
    const rising = Math.min(1, z.rise / RULES.zombieRise);
    // Two uneven rhythms offset by slot keep a pack from lurching in step.
    const lurch = moving
      ? Math.sin(time * 0.009 + z.slot * 1.7) * 7 + Math.sin(time * 0.023 + z.slot) * 3
      : Math.sin(time * 0.003 + z.slot) * 2;
    const frame = moving ? Math.floor((time + z.slot * 90) / 170) % 2 : 0;
    const texture =
      z.kind === 'hat'
        ? `${z.team}-hat-${frame}`
        : z.kind === 'thrall'
          ? `${z.team}-${z.classId ?? 'guardian'}-undead-${frame}`
          : `${z.team}-zombie-${frame}`;
    v.body
      .setPosition(
        v.x,
        v.y + (moving ? Math.abs(Math.sin(time * 0.012 + z.slot)) * 2 : 0) + rising * 12,
      )
      .setTexture(texture)
      .setFlipX(Math.cos(z.angle) < 0)
      .setAngle(
        z.windup > 0
          ? Math.sin(time * 0.06) * 10
          : z.kind === 'hat'
            ? (moving ? Math.sin(time * 0.011) * 5 : Math.sin(time * 0.003) * 2) -
              (z.cast > 0 ? Math.cos(z.angle) * 6 : 0)
            : lurch,
      )
      .setScale(z.kind === 'hat' ? 1.15 : 1, (z.kind === 'hat' ? 1.15 : 1) * (1 - rising * 0.75))
      .setAlpha(Math.min(1, z.life / 1.5) * (1 - rising * 0.45));
    if (z.frozenLeft > 0) v.body.setTint(0x9fe8ff);
    else if (z.windup > 0) v.body.setTint(0xff6b5e);
    else v.body.clearTint();
    v.label?.setPosition(v.x, v.y - 34);
    // Guards glow red like the circle they keep to; the cursor squad glows violet.
    const squad =
      z.role === 'guard'
        ? { dark: 0x240b0b, glow: 0x8f2d2d, line: 0xff5a4a }
        : { dark: 0x1a0b24, glow: 0x6b2d8f, line: 0xb06cff };
    const commanded = z.owner === this.localId && this.predicted?.zombieAuto === false;
    const pulse = 0.5 + Math.sin(time * 0.006 + z.slot) * 0.5;
    v.aura.clear();
    v.aura.fillStyle(squad.dark, 0.45 + pulse * 0.15);
    v.aura.fillEllipse(v.x, v.y + 8, 30 + pulse * 6, 11 + pulse * 2);
    v.aura.fillStyle(squad.glow, (commanded ? 0.22 : 0.12) + pulse * 0.1);
    v.aura.fillEllipse(v.x, v.y + 6, 42, 16);
    if (commanded) {
      v.aura.lineStyle(1, squad.line, 0.35 + pulse * 0.3);
      v.aura.strokeEllipse(v.x, v.y + 8, 36, 13);
    }
    if (rising > 0) {
      if (z.kind === 'thrall')
        this.drawMandala(v.aura, v.x, v.y + 8, 32, time, 0.35 + rising * 0.55);
      v.aura.lineStyle(2, squad.line, 0.2 + rising * 0.6);
      v.aura.strokeEllipse(v.x, v.y + 8, 40 + (1 - rising) * 10, 16 + (1 - rising) * 4);
      for (let i = 0; i < 6; i++) {
        const a = time * 0.004 + (i * Math.PI) / 3;
        v.aura.lineBetween(
          v.x + Math.cos(a) * 12,
          v.y + 8 + Math.sin(a) * 5,
          v.x + Math.cos(a) * 20,
          v.y + 8 + Math.sin(a) * 8,
        );
      }
    }
    if (moving && Math.random() < delta / 240) {
      const mote = this.add
        .rectangle(v.x + (Math.random() - 0.5) * 16, v.y + 6, 2, 2, 0x3a1450, 0.85)
        .setDepth(3);
      this.tweens.add({
        targets: mote,
        y: mote.y - 16,
        alpha: 0,
        duration: 560,
        onComplete: () => mote.destroy(),
      });
    }
    v.hp.clear();
    if (rising > 0) {
      v.fx.clear();
      return;
    }
    const bars = Math.ceil(z.maxHp);
    const left = v.x - (bars * 8 - 2) / 2;
    for (let i = 0; i < bars; i++) {
      v.hp.fillStyle(0x1a282c);
      v.hp.fillRect(left + i * 8, v.y - 25, 6, 2);
      v.hp.fillStyle(z.kind === 'hat' ? 0xb06cff : COLORS[z.team]);
      v.hp.fillRect(left + i * 8, v.y - 25, 6 * Math.min(1, Math.max(0, z.hp - i)), 2);
    }
    if (z.windup > 0) {
      v.hp.lineStyle(1, 0xff5a4a, 0.55);
      v.hp.strokeCircle(v.x, v.y, RULES.zombieRange);
    }
    v.fx.clear();
    if (z.frozenLeft > 0) {
      v.fx.fillStyle(0xbff4ff, 0.28);
      v.fx.fillRoundedRect(v.x - 14, v.y - 26, 28, 36, 5);
      v.fx.lineStyle(1, 0xe8fbff, 0.8);
      v.fx.strokeRoundedRect(v.x - 14, v.y - 26, 28, 36, 5);
    }
    if (z.kind === 'sword') this.drawZombieSword(v.fx, z, v.x, v.y, time);
    if (z.kind === 'thrall') this.drawThrallSkills(v.fx, z, v.x, v.y, time);
    if (z.kind !== 'hat') return;
    if (z.cast > 0) {
      // Casting: a mandala under the mage in the color of the spell on its way.
      const progress = 1 - z.cast / RULES.hatCastTime;
      const ice = z.spell === 'ice';
      this.drawMandala(
        v.aura,
        v.x,
        v.y + 9,
        20 + progress * 16,
        time,
        0.4 + progress * 0.55,
        ice ? 0x7fd4ff : 0xff6a2c,
        ice ? 0xe6f8ff : 0xffd0a0,
      );
    }
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
    const ice = z.spell === 'ice';
    g.fillStyle(
      cast > 0 ? (ice ? 0x7fd4ff : 0xff8a3c) : recoil > 0 ? 0xd8fbff : 0xb06cff,
      0.25 + cast * 0.35,
    );
    g.fillCircle(top.x, top.y - 2, 5 + pulse * 2 + cast * 8);
    g.fillStyle(0xd6cfb3);
    g.fillCircle(top.x, top.y - 2, 3.5);
    g.fillStyle(0x1a1414);
    g.fillRect(top.x - 2, top.y - 3, 1, 1);
    g.fillRect(top.x + 1, top.y - 3, 1, 1);
    if (cast > 0) {
      // The staff and the casting hand glow with the spell being cast.
      g.fillStyle(ice ? 0xbff0ff : 0xffd36b, 0.95);
      g.fillCircle(top.x, top.y - 2, 2 + cast * 4);
      g.fillStyle(ice ? 0x9fe8ff : 0xff8a3c, 0.35);
      g.fillCircle(offHand.x, offHand.y, 3 + cast * 6);
      g.fillStyle(ice ? 0xe8fbff : 0xffe7b1, 0.95);
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
    if (!this.controls) return;
    this.updateCamera(delta);
    if (!this.snapshot) return;
    let s = this.snapshot;
    this.accumulator += Math.min(delta, 100);
    if (this.predicted && !this.controls.aimFromPointer) {
      // Touch aiming has no cursor: project the aim direction into the arena instead.
      const a = this.controls.angle;
      this.controls.aimX = Math.max(0, Math.min(RULES.width, this.predicted.x + Math.cos(a) * 150));
      this.controls.aimY = Math.max(
        0,
        Math.min(RULES.height, this.predicted.y + Math.sin(a) * 150),
      );
    }
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
            RULES.tick,
            MAPS[s.mapId].walls,
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
      v.aura.destroy();
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
      this.traps.lineStyle(1, color, trap.armLeft > 0 ? 0.16 : 0.3);
      this.traps.strokeCircle(trap.x, trap.y, RULES.trapRadius);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        this.traps.lineBetween(
          trap.x + Math.cos(a) * 16,
          trap.y + Math.sin(a) * 16,
          trap.x + Math.cos(a) * 10,
          trap.y + Math.sin(a) * 10,
        );
      }
      this.traps.fillStyle(color, 0.2);
      this.traps.fillCircle(trap.x, trap.y, 3);
    }
    // Graves of fallen rivals: a necromancer can raise them until they crumble.
    for (const g of s.graves) {
      const fade = Math.min(1, g.left / 2);
      this.traps.fillStyle(0x7dffb0, 0.1 * fade);
      this.traps.fillEllipse(g.x, g.y + 5, 28, 9);
      this.traps.fillStyle(0x6f6a5c, 0.85 * fade);
      this.traps.fillRoundedRect(g.x - 6, g.y - 12, 12, 16, { tl: 5, tr: 5, bl: 1, br: 1 });
      this.traps.lineStyle(1, 0x2c2a24, 0.9 * fade);
      this.traps.strokeRoundedRect(g.x - 6, g.y - 12, 12, 16, { tl: 5, tr: 5, bl: 1, br: 1 });
      this.traps.lineBetween(g.x, g.y - 9, g.x, g.y - 1);
      this.traps.lineBetween(g.x - 3, g.y - 6, g.x + 3, g.y - 6);
    }
    // A necromancer casting a raise: the mandala grows where the dead will rise.
    for (const q of s.players) {
      if (q.raiseCast <= 0) continue;
      const progress = 1 - q.raiseCast / RULES.raiseCast;
      this.drawMandala(
        this.traps,
        q.raiseX,
        q.raiseY + 8,
        16 + progress * 18,
        time,
        0.35 + progress * 0.6,
      );
      this.traps.lineStyle(1, 0x7dffb0, 0.25 + progress * 0.4);
      this.traps.lineBetween(q.x, q.y - 6, q.raiseX, q.raiseY);
    }
    this.arrows.clear();
    for (const a of s.arrows) {
      const age = s.paused ? 0 : Math.min((performance.now() - this.receivedAt) / 1000, 1 / 15);
      const next = {
        x: a.x + Math.cos(a.angle) * arrowMotion(a).speed * age,
        y: a.y + Math.sin(a.angle) * arrowMotion(a).speed * age,
      };
      const p = lineClear(a, next, MAPS[s.mapId].walls) ? next : a;
      const grow = 1 + (a.power ?? 0);
      if (a.reflected) {
        // Countered projectile: a golden halo, bigger when the counter was charged.
        this.arrows.fillStyle(0xffd36b, 0.18 + 0.1 * a.reflected);
        this.arrows.fillCircle(p.x, p.y, 7 + 5 * a.reflected);
      }
      if (a.blast) {
        // Zombie mage fireball: a rolling area of fire with a scorched ring on the ground.
        this.arrows.fillStyle(0xff4a1a, 0.12);
        this.arrows.fillCircle(p.x, p.y + 4, RULES.hatFireRadius + 4);
        this.arrows.lineStyle(2, 0xff8a3c, 0.35);
        this.arrows.strokeCircle(p.x, p.y + 4, RULES.hatFireRadius);
        this.drawBlaze(p, a.angle, 0.6, time, 0xff6a1f);
        continue;
      }
      if (a.gust) {
        this.drawWind(p, a.angle, time, true);
        continue;
      }
      if (a.slash) {
        this.drawSlash(p, a.angle, a.life);
        continue;
      }
      if (a.wind) {
        this.drawWind(p, a.angle, time, a.volley !== undefined);
        continue;
      }
      if (a.ice) {
        const dx = Math.cos(a.angle),
          dy = Math.sin(a.angle);
        const point = (along: number, across: number) => ({
          x: p.x + dx * along - dy * across,
          y: p.y + dy * along + dx * across,
        });
        const tail = point(-22, 0),
          tip = point(7, 0);
        this.arrows.lineStyle(5, 0x66d8ff, 0.16);
        this.arrows.lineBetween(tail.x, tail.y, p.x, p.y);
        this.arrows.lineStyle(2, 0xb6efff);
        const shaft = point(-15, 0);
        this.arrows.lineBetween(shaft.x, shaft.y, p.x, p.y);
        // Faceted crystal tip and swept-back ice fins, aligned with flight.
        this.arrows.fillStyle(0x62c9ef);
        this.arrows.fillPoints([tip, point(-2, -4), point(0, 0)], true);
        this.arrows.fillStyle(0xe7fbff);
        this.arrows.fillPoints([tip, point(0, 0), point(-2, 4)], true);
        this.arrows.fillStyle(0x8edfff);
        this.arrows.fillPoints([point(-9, 0), point(-17, -4), point(-15, 0), point(-17, 4)], true);
      } else if (a.element === 'ice') {
        const dx = Math.cos(a.angle),
          dy = Math.sin(a.angle);
        this.arrows.lineStyle(4, 0x9fe8ff, 0.3);
        this.arrows.lineBetween(p.x - dx * 16, p.y - dy * 16, p.x, p.y);
        this.arrows.fillStyle(0xdffaff);
        this.arrows.fillTriangle(
          p.x + dx * 7,
          p.y + dy * 7,
          p.x - dy * 4,
          p.y + dx * 4,
          p.x + dy * 4,
          p.y - dx * 4,
        );
        this.arrows.fillTriangle(
          p.x - dx * 5,
          p.y - dy * 5,
          p.x - dy * 4,
          p.y + dx * 4,
          p.x + dy * 4,
          p.y - dx * 4,
        );
      } else if ((a.classId === 'mage' || a.classId === 'necromancer') && (a.power ?? 0) > 0.05) {
        this.drawBlaze(
          p,
          a.angle,
          a.power!,
          time,
          a.classId === 'necromancer' ? 0xc26bff : 0xff6a1f,
        );
      } else if (a.classId === 'necromancer') {
        const size = grow * (a.element === 'fire' ? 0.6 : 1);
        this.arrows.lineStyle(6 * size, 0xff7a2f, 0.25);
        this.arrows.lineBetween(
          p.x - Math.cos(a.angle) * 18 * grow,
          p.y - Math.sin(a.angle) * 18 * grow,
          p.x,
          p.y,
        );
        this.arrows.fillStyle(0xff9a3c, 0.5);
        this.arrows.fillCircle(p.x, p.y, 8 * size);
        this.arrows.fillStyle(0xffe08a);
        this.arrows.fillCircle(p.x, p.y, 4 * size);
      } else if (a.classId === 'mage') {
        if (a.power) {
          this.arrows.fillStyle(0xff4a1a, 0.18);
          this.arrows.fillCircle(p.x, p.y, 16 * grow);
        }
        this.arrows.lineStyle(5 * grow, 0xff6326, 0.35);
        this.arrows.lineBetween(
          p.x - Math.cos(a.angle) * 16 * grow,
          p.y - Math.sin(a.angle) * 16 * grow,
          p.x,
          p.y,
        );
        this.arrows.fillStyle(0xff982c, 0.7);
        this.arrows.fillCircle(p.x, p.y, 7 * grow);
        this.arrows.fillStyle(0xffed9b);
        this.arrows.fillCircle(p.x, p.y, 3 * grow);
      } else {
        const hot = a.charged ? 1 : (a.power ?? 0);
        this.arrows.lineStyle(2 + hot * 2, hot > 0 ? 0xff842f : 0xe3cf96);
        this.arrows.lineBetween(
          p.x - Math.cos(a.angle) * 12,
          p.y - Math.sin(a.angle) * 12,
          p.x,
          p.y,
        );
        this.arrows.fillStyle(hot > 0 ? 0xffb24a : 0xf2e9cf);
        this.arrows.fillCircle(p.x, p.y, 2);
      }
    }
    this.aim.clear();
    if (this.controls.enabled && this.predicted) {
      const p = this.predicted,
        a = this.controls.angle;
      const targeting = this.controls.targetingAbility;
      if (targeting) this.drawBlueprint(p, targeting, a, time);
      else {
        this.aim.lineStyle(1, GOLD, 0.6);
        this.aim.lineBetween(
          p.x + Math.cos(a) * 22,
          p.y + Math.sin(a) * 22,
          p.x + Math.cos(a) * 45,
          p.y + Math.sin(a) * 45,
        );
        this.aim.strokeCircle(p.x + Math.cos(a) * 48, p.y + Math.sin(a) * 48, 3);
      }
      this.drawObjectiveIndicators(p);
      if (CLASSES[p.classId].summon && p.specialCharge >= RULES.overchargeTime) {
        // White twinkling perimeter: how far away the raising mandala can open.
        const twinkle = 0.5 + Math.sin(time * 0.025) * 0.5;
        const pointer = this.controls.aimFromPointer;
        const toward = pointer ? Math.atan2(this.controls.aimY - p.y, this.controls.aimX - p.x) : a;
        const reach = pointer
          ? Math.min(
              RULES.raiseRange,
              Math.hypot(this.controls.aimX - p.x, this.controls.aimY - p.y),
            )
          : 26;
        const spot = { x: p.x + Math.cos(toward) * reach, y: p.y + Math.sin(toward) * reach };
        const grave = s.graves
          .filter((g) => g.team !== p.team && distance(g, p) <= RULES.raiseRange)
          .sort((m, n) => distance(m, spot) - distance(n, spot))[0];
        const ready = !p.thrallAlive && (!!grave || (!!p.thrall && p.thrallCd <= 0));
        this.aim.lineStyle(2, 0xffffff, ready ? 0.3 + twinkle * 0.6 : 0.1 + twinkle * 0.15);
        this.aim.strokeCircle(p.x, p.y, RULES.raiseRange);
        for (let i = 0; i < 16; i++) {
          const around = time * 0.0006 + (i * Math.PI) / 8,
            glint = 0.5 + Math.sin(time * 0.013 + i * 2.3) * 0.5;
          this.aim.fillStyle(0xffffff, glint * (ready ? 0.95 : 0.3));
          this.aim.fillCircle(
            p.x + Math.cos(around) * RULES.raiseRange,
            p.y + Math.sin(around) * RULES.raiseRange,
            0.8 + glint * 1.6,
          );
        }
        if (ready) {
          const full = Math.min(
            1,
            (p.specialCharge - RULES.overchargeTime) / (RULES.raiseCharge - RULES.overchargeTime),
          );
          this.drawMandala(this.aim, spot.x, spot.y + 8, 28, time, 0.25 + full * 0.6);
          if (grave) {
            this.aim.lineStyle(1, 0x7dffb0, 0.2 + twinkle * 0.35);
            this.aim.lineBetween(grave.x, grave.y, spot.x, spot.y);
          }
        }
      }
      if (
        p.classId === 'archer' &&
        (p.windDash > 0 || p.specialCharge >= RULES.overchargeTime - 1e-8)
      ) {
        // Charged dash ready or in flight: gusts circle the archer, brighter once the shot is full too.
        this.aim.lineStyle(2, 0xd8fbff, p.shotCharge >= RULES.chargeTime - 1e-8 ? 0.85 : 0.35);
        for (let i = 0; i < 3; i++) {
          const spin = time * 0.012 + (i * Math.PI * 2) / 3;
          this.aim.beginPath();
          this.aim.arc(p.x, p.y - 4, 24, spin, spin + 1.2);
          this.aim.strokePath();
        }
      }
      const mine = s.zombies.filter((z) => z.owner === this.localId);
      const pulse = 0.5 + Math.sin(time * 0.008) * 0.5;
      // Red: the circle the summoned zombies guard, travelling with the necromancer.
      if (CLASSES[p.classId].summon && !p.zombieAuto && mine.some((z) => z.role === 'guard')) {
        const radius = RULES.zombieGuardRadius * (0.92 + pulse * 0.08);
        this.aim.fillStyle(0xff4a4a, 0.05 + pulse * 0.04);
        this.aim.fillCircle(p.x, p.y, radius);
        this.aim.lineStyle(1, 0xff4a4a, 0.3 + pulse * 0.25);
        this.aim.strokeCircle(p.x, p.y, radius);
      }
      // Violet: the mouse area that the zombie mage, its minions and the thrall follow.
      if (
        CLASSES[p.classId].summon &&
        this.controls.aimFromPointer &&
        !p.zombieAuto &&
        mine.length > 0
      ) {
        this.aim.fillStyle(0xb06cff, 0.05 + pulse * 0.04);
        this.aim.fillCircle(
          this.controls.aimX,
          this.controls.aimY,
          RULES.zombieAimRadius * (0.85 + pulse * 0.15),
        );
        this.aim.lineStyle(1, 0xb06cff, 0.3 + pulse * 0.25);
        this.aim.strokeCircle(
          this.controls.aimX,
          this.controls.aimY,
          RULES.zombieAimRadius * (0.85 + pulse * 0.15),
        );
      }
    }
  }

  private updateCamera(delta: number) {
    const camera = this.cameras.main;
    const width = Math.max(1, camera.width);
    const height = Math.max(1, camera.height);
    // Always contain the complete 16:9 arena. Cover zoom made wide phones crop routes and flags.
    const zoom = Math.min(width / RULES.width, height / RULES.height);
    const targetX = RULES.width / 2;
    const targetY = RULES.height / 2;
    const key = `${width}x${height}:contain`;
    const snap = key !== this.cameraKey;
    this.cameraKey = key;
    camera.setZoom(zoom).setRoundPixels(true);
    const blend = snap ? 1 : 1 - Math.exp(-delta / 95);
    camera.centerOn(
      Phaser.Math.Linear(camera.midPoint.x, targetX, blend),
      Phaser.Math.Linear(camera.midPoint.y, targetY, blend),
    );
  }

  private drawBlueprint(p: Player, abilityId: string, angle: number, time: number) {
    const spec = blueprintSpec(p, abilityId);
    if (!spec) return;
    const walls = MAPS[this.currentMapId].walls;
    const pulse = 0.72 + Math.sin(time * 0.012) * 0.12;
    const charge =
      abilityId === 'shot' || abilityId === 'sword'
        ? p.shotCharge / (p.classId === 'archer' ? RULES.chargeTime : RULES.overchargeTime)
        : abilityId === 'dash' || abilityId === 'summon'
          ? p.specialCharge / RULES.overchargeTime
          : abilityId === 'counter'
            ? p.counterCharge / RULES.counterChargeTime
            : 0;
    const ray = (offset = 0, radius = Math.max(1, spec.radius)) => ({
      angle: angle + offset,
      length: clipRay(p, angle + offset, spec.range, walls, radius),
    });
    const center = ray();
    const invalid = !spec.origin && center.length < spec.range - 3;
    const color = invalid ? 0xff6c68 : charge >= 1 ? 0x62e6ff : 0x79dce8;
    const bright = invalid ? 0xffb0a8 : 0xd9fbff;
    const alpha = Math.min(0.34, 0.14 + Math.max(0, charge) * 0.12) * pulse;
    const corridor = (bearing: number, length: number, radius: number) => {
      const nx = -Math.sin(bearing) * radius;
      const ny = Math.cos(bearing) * radius;
      const ex = p.x + Math.cos(bearing) * length;
      const ey = p.y + Math.sin(bearing) * length;
      this.aim.fillStyle(color, alpha);
      this.aim.fillPoints(
        [
          { x: p.x + nx, y: p.y + ny },
          { x: ex + nx, y: ey + ny },
          { x: ex - nx, y: ey - ny },
          { x: p.x - nx, y: p.y - ny },
        ],
        true,
      );
      this.aim.lineStyle(1.2, bright, 0.68);
      this.aim.lineBetween(p.x, p.y, ex, ey);
      for (let distance = 60; distance < length; distance += 60) {
        const x = p.x + Math.cos(bearing) * distance;
        const y = p.y + Math.sin(bearing) * distance;
        this.aim.lineStyle(1, bright, 0.26);
        this.aim.lineBetween(
          x - Math.sin(bearing) * 5,
          y + Math.cos(bearing) * 5,
          x + Math.sin(bearing) * 5,
          y - Math.cos(bearing) * 5,
        );
      }
      this.aim.lineStyle(1.5, bright, 0.75);
      this.aim.strokeCircle(ex, ey, Math.max(3, radius));
    };
    if (spec.kind === 'line' || spec.kind === 'dash')
      corridor(angle, center.length, Math.max(4, spec.radius));
    else if (spec.kind === 'triple')
      for (const offset of spec.offsets ?? [0]) {
        const branch = ray(offset);
        corridor(branch.angle, branch.length, Math.max(3, spec.radius));
      }
    else if (spec.kind === 'cone' || spec.kind === 'defense') {
      const arc = spec.arc ?? Math.PI / 2;
      const samples = 12;
      const points: { x: number; y: number }[] = [{ x: p.x, y: p.y }];
      for (let index = 0; index <= samples; index++) {
        const bearing = angle - arc / 2 + (arc * index) / samples;
        const length = clipRay(p, bearing, spec.range, walls, 1);
        points.push({
          x: p.x + Math.cos(bearing) * length,
          y: p.y + Math.sin(bearing) * length,
        });
      }
      this.aim.fillStyle(color, spec.kind === 'defense' ? alpha * 0.65 : alpha);
      this.aim.fillPoints(points, true);
      this.aim.lineStyle(1.4, bright, 0.7);
      this.aim.strokePoints(points, true);
      for (let index = 2; index < points.length - 1; index += 3)
        this.aim.lineBetween(p.x, p.y, points[index].x, points[index].y);
    } else if (spec.kind === 'circle') {
      this.aim.fillStyle(color, alpha * 0.8);
      this.aim.fillCircle(p.x, p.y, spec.radius);
      this.aim.lineStyle(1.4, bright, 0.72);
      this.aim.strokeCircle(p.x, p.y, spec.radius);
      this.aim.lineStyle(1, bright, 0.2);
      this.aim.strokeCircle(p.x, p.y, spec.radius * 0.6);
    } else if (spec.kind === 'placement') {
      const pointerDistance = this.controls.aimFromPointer
        ? Math.min(spec.range, Math.hypot(this.controls.aimX - p.x, this.controls.aimY - p.y))
        : spec.range;
      const length = clipRay(
        p,
        angle,
        pointerDistance,
        walls,
        Math.max(1, spec.radius * 0.15),
      );
      const x = p.x + Math.cos(angle) * length;
      const y = p.y + Math.sin(angle) * length;
      const valid = length >= pointerDistance - 3;
      const placementColor = valid ? color : 0xff6c68;
      this.aim.lineStyle(1, placementColor, 0.55);
      this.aim.lineBetween(p.x, p.y, x, y);
      this.aim.fillStyle(placementColor, alpha);
      this.aim.fillCircle(x, y, spec.radius);
      this.aim.lineStyle(1.5, valid ? bright : 0xffc0b8, 0.8);
      this.aim.strokeCircle(x, y, spec.radius);
      this.aim.lineStyle(1, valid ? bright : 0xffc0b8, 0.3);
      this.aim.lineBetween(x - spec.radius, y, x + spec.radius, y);
      this.aim.lineBetween(x, y - spec.radius, x, y + spec.radius);
    }
  }

  private drawObjectiveIndicators(p: Player) {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const view = this.cameras.main.worldView;
    const margin = 22 / this.cameras.main.zoom;
    for (const flag of this.snapshot?.flags ?? []) {
      if (Phaser.Geom.Rectangle.Contains(view, flag.x, flag.y)) continue;
      const x = Phaser.Math.Clamp(flag.x, view.left + margin, view.right - margin);
      const y = Phaser.Math.Clamp(flag.y, view.top + margin, view.bottom - margin);
      const bearing = Math.atan2(flag.y - p.y, flag.x - p.x);
      const size = 8 / this.cameras.main.zoom;
      this.aim.fillStyle(COLORS[flag.team], 0.9);
      this.aim.fillTriangle(
        x + Math.cos(bearing) * size,
        y + Math.sin(bearing) * size,
        x + Math.cos(bearing + 2.45) * size,
        y + Math.sin(bearing + 2.45) * size,
        x + Math.cos(bearing - 2.45) * size,
        y + Math.sin(bearing - 2.45) * size,
      );
      this.aim.lineStyle(1, 0xffffff, 0.6);
      this.aim.strokeCircle(x, y, size * 1.35);
    }
  }

}
