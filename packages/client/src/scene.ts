import Phaser from 'phaser';
import {
  RULES,
  CLASSES,
  CLASS_IDS,
  DEFAULT_CLASS,
  WALLS,
  HOMES,
  SPAWNS,
  TEAMS,
  movePlayer,
  newPlayer,
  lineClear,
  type Snapshot,
  type Player,
  type Input,
} from '@bandera/shared';
import { Controls } from './input.js';
import { sound } from './audio.js';
import { CLASS_ART, palette } from './art.js';

const BLUE = 0x73bbef,
  RED = 0xee8b79,
  GOLD = 0xf3ce86;
export class Arena extends Phaser.Scene {
  controls!: Controls;
  localId = '';
  snapshot?: Snapshot;
  predicted?: Player;
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
  private arrows!: Phaser.GameObjects.Graphics;
  private aim!: Phaser.GameObjects.Graphics;
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
    this.makeTextures();
    this.flags = this.add.graphics().setDepth(5);
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
    this.paintFlags(
      TEAMS.map(
        (team) =>
          ({ ...HOMES[team], team, status: 'home', carrier: null }) as Snapshot['flags'][number],
      ),
    );
    for (const team of TEAMS) this.drawPlayer(newPlayer(`preview-${team}`, '', team), false, 0);
  }
  private makeTextures() {
    for (const [team,color,light] of [['blue','#548cb7','#8cc5e7'],['red','#b66558','#efa08b']] as const)
      for (const classId of CLASS_IDS) for(let frame=0;frame<2;frame++) {
        const data=CLASS_ART[classId].map((row,i)=>frame===1&&i>=13?row.slice(0,3)+row.slice(3,13).split('').reverse().join('')+row.slice(13):row);
        this.textures.generate(`${team}-${classId}-${frame}`, { data,pixelWidth:2,palette:palette(color,light) as Phaser.Types.Create.Palette });
      }
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
    for (const team of TEAMS) {
      const color = team === 'blue' ? BLUE : RED,
        h = HOMES[team],
        sp = SPAWNS[team];
      g.fillStyle(color, 0.1);
      g.fillRoundedRect(team === 'blue' ? 28 : 764, 214, 168, 112, 10);
      g.lineStyle(2, color, 0.45);
      g.strokeCircle(h.x, h.y, 38);
      g.lineStyle(1, color, 0.17);
      g.strokeCircle(h.x, h.y, 45);
      this.add
        .text(h.x, 326, team === 'blue' ? '◆  AZUR' : '✚  CARMESÍ', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: team === 'blue' ? '#8cc5e7' : '#efa08b',
          letterSpacing: 2,
        })
        .setOrigin(0.5);
      g.fillStyle(color, 0.18);
      g.fillCircle(sp.x, sp.y, 19);
    }
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
    if (first) {
      for (const [key, v] of this.visuals) {
        v.body.destroy();
        v.name.destroy();
        v.shadow.destroy();
        v.hp.destroy();
        v.weapon.destroy();
        this.visuals.delete(key);
      }
    }
    const own = snapshot.players.find((p) => p.id === id);
    if (own) {
      this.controls.configure(own.classId);
      if(first)this.controls.angle=own.angle;
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
    this.controls.enabled = snapshot.phase === 'playing' && !snapshot.paused && !!own?.hp;
    if (!this.controls.enabled) this.controls.clear();
    if (first) this.lastEvent = snapshot.events.at(-1)?.id ?? 0;
    for (const e of snapshot.events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      sound(e.kind);
      if (e.kind === 'sword') {
        const slash = this.add.graphics().setDepth(15);
        slash.lineStyle(4, 0xffe7b1, 0.9);
        slash.beginPath();
        const stats=CLASSES[e.classId??DEFAULT_CLASS];
        slash.arc(e.x,e.y,stats.meleeRange,(e.angle??0)-stats.meleeArc/2,(e.angle??0)+stats.meleeArc/2);
        slash.strokePath();
        this.tweens.add({
          targets: slash,
          alpha: 0,
          duration: 180,
          onComplete: () => slash.destroy(),
        });
      } else {
        const color = e.kind==='block'?GOLD:e.team === 'blue' ? BLUE : RED;
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
      if (e.kind === 'capture') {
        const pulse = this.add
          .rectangle(480, 270, 960, 540, e.team === 'blue' ? BLUE : RED, 0.2)
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
  reset() {
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
      const color = f.team === 'blue' ? BLUE : RED;
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
      } else {
        g.fillRect(x + 10, y - 24, 3, 10);
        g.fillRect(x + 6, y - 20, 11, 3);
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
        body: this.add.sprite(p.x, p.y, `${p.team}-${p.classId}-0`).setOrigin(0.5, 0.7).setDepth(10),
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
      .setAlpha(p.hp<=0?.2:p.dashInvulnerable?.45:p.invuln>0?.55+Math.sin(time*.025)*.25:1);
    if (p.hitFlash > 0) v.body.setTintFill(0xffe6ba);
    else v.body.clearTint();
    v.shadow.setPosition(v.x, v.y + 8);
    v.name.setPosition(v.x, v.y - 34).setText(local ? `${p.name} · VOS` : p.name);
    const stats=CLASSES[p.classId], w=v.weapon;
    w.clear();w.setPosition(v.x,v.y);w.setRotation(p.angle);
    if(p.hp>0){
      if(p.classId==='archer') {
        w.lineStyle(2,GOLD);w.beginPath();w.arc(9,0,15,-Math.PI/2,Math.PI/2);w.strokePath();
        w.lineStyle(1,0xdad6bd);w.lineBetween(9,-15,9,15);
        if(p.windup>0){w.fillStyle(0xe3e5d5);w.fillRect(12,-2,14,3);}
      } else if(p.classId==='mage') {
        w.lineStyle(4,0x796452);w.lineBetween(8,0,30,0);
        w.fillStyle(0x8edcff);w.fillCircle(32,0,6);w.lineStyle(2,0xe8f7ff,.85);w.strokeCircle(32,0,7);
        if(p.windup>0){w.lineStyle(2,0xb9edff,.65);w.strokeCircle(32,0,11);}
      } else {
        const wind=p.windup>0?Math.min(1,p.windup/stats.windup):0;
        w.setRotation(p.angle-wind*.9);
        w.fillStyle(0xe3e5d5);w.fillRect(11,-2,p.classId==='vanguard'?43:23,p.classId==='vanguard'?5:3);
        w.fillStyle(GOLD);w.fillRect(12,-7,3,14);w.fillStyle(0x77634b);w.fillRect(6,-2,7,4);
        if(p.classId==='guardian'){
          w.setRotation(p.angle);w.fillStyle(p.guarding?GOLD:0x738b86);w.fillPoints([{x:14,y:-11},{x:24,y:-8},{x:24,y:8},{x:14,y:11},{x:9,y:0}],true);
          w.lineStyle(2,0x435955);w.lineBetween(17,-7,17,7);w.lineBetween(12,0,22,0);
          if(p.guarding){w.lineStyle(3,GOLD,.8);w.beginPath();w.arc(0,0,31,-RULES.guardArc/2,RULES.guardArc/2);w.strokePath();}
        }
      }
    }
    v.hp.clear();
    if (p.hp > 0) {
      const left=v.x-(p.maxHp*8-2)/2;
      for (let i=0;i<p.maxHp;i++) {
        v.hp.fillStyle(0x1a282c);v.hp.fillRect(left+i*8,v.y-25,6,3);
        const fill=Math.min(1,Math.max(0,p.hp-i));
        v.hp.fillStyle(p.team==='blue'?BLUE:RED);v.hp.fillRect(left+i*8,v.y-25,6*fill,3);
      }
      if(p.windup>0){v.hp.lineStyle(1,GOLD,.45);v.hp.beginPath();v.hp.arc(v.x,v.y,stats.meleeRange,p.swingAngle-stats.meleeArc/2,p.swingAngle+stats.meleeArc/2);v.hp.strokePath();}
      if(p.dashInvulnerable){v.hp.lineStyle(2,0xc0eafa,.65);v.hp.strokeEllipse(v.x,v.y,35,40);}
      if (local) {
        v.hp.lineStyle(1, GOLD, 0.6);
        v.hp.strokeEllipse(v.x, v.y + 9, 32, 12);
      }
    } else {
      v.name.setText(`${p.name} · ${Math.ceil(p.respawnLeft)}`);
    }
  }
  update(time: number, delta: number) {
    if (!this.controls || !this.snapshot) return;
    const s = this.snapshot;
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator >= 1000 / 30) {
      this.accumulator -= 1000 / 30;
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
          ? { ...p, x: this.predicted.x, y: this.predicted.y, angle: this.controls.angle, guarding:this.predicted.guarding, guardLeft:this.predicted.guardLeft, dashInvulnerable:this.predicted.dashInvulnerable, windup:this.predicted.windup }
          : p,
        p.id === this.localId,
        time,
        delta,
      );
    const flags = s.flags.map((f) => {
      const carrier = f.carrier ? this.visuals.get(f.carrier) : undefined;
      return carrier ? { ...f, x: carrier.x, y: carrier.y } : f;
    });
    this.paintFlags(flags);
    this.arrows.clear();
    for (const a of s.arrows) {
      const age = s.paused ? 0 : Math.min((performance.now() - this.receivedAt) / 1000, 1 / 15);
      const next = {
        x: a.x + Math.cos(a.angle) * RULES.arrowSpeed * age,
        y: a.y + Math.sin(a.angle) * RULES.arrowSpeed * age,
      };
      const p = lineClear(a, next) ? next : a;
      if(a.classId==='mage') {
        this.arrows.lineStyle(5,0x78cfff,.22);
        this.arrows.lineBetween(p.x-Math.cos(a.angle)*16,p.y-Math.sin(a.angle)*16,p.x,p.y);
        this.arrows.fillStyle(0x8edcff,.45);this.arrows.fillCircle(p.x,p.y,7);
        this.arrows.fillStyle(0xe8f7ff);this.arrows.fillCircle(p.x,p.y,3);
      } else {
        this.arrows.lineStyle(2, 0xe3cf96);
        this.arrows.lineBetween(p.x - Math.cos(a.angle) * 12, p.y - Math.sin(a.angle) * 12, p.x, p.y);
        this.arrows.fillStyle(0xf2e9cf);
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
    }
  }
}
