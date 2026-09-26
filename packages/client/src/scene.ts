import Phaser from 'phaser';
import { ELEMENT_COLORS, ELEMENT_CORES, hex } from '@bandera/shared/rpg/colors';
import { Settlement, drawAltar, drawProp, drawSettlementGround } from './village';
import { MONSTER_DISPLAY, MONSTER_ORIGIN_Y, makeMonsterTextures, monsterTexture } from './monsters';
import {
  RULES,
  MOB_STATS,
  CLASSES,
  CLASS_IDS,
  DEFAULT_CLASS,
  MAPS,
  ARENA_BOUNDS,
  TEAMS,
  TEAM_NAMES,
  TEAM_ICONS,
  CHARACTER_SKINS,
  layout,
  projectileStats,
  arrowMotion,
  chargePower,
  distance,
  movePlayer,
  movementInput,
  resolveSlotInput,
  newPlayer,
  lineClear,
  blinkTarget,
  wet,
  type Snapshot,
  type Player,
  type Team,
  type Base,
  type Bounds,
  type Rect,
  type Vec,
  type Terrain,
  type Zombie,
  type Input,
  type MapId,
  type Mob,
  type MobKind,
} from '@bandera/shared';
import { zone, type ZoneId } from '@bandera/shared/rpg/zones';
import { TILE, TILES, roadPaths, tileColor, tileMap, worldTerrain, type TileKind } from '@bandera/shared/rpg/terrain';
import { SHRINE_WARD, worldInput, type ChestView, type Weapon } from '@bandera/shared/world';

const CHEST_COLOR: Record<ChestView['tier'], number> = { comun: 0xc9a36b, raro: 0x56b8ff, legendario: 0xffc84d };
import { Controls } from './input.js';
import { blueprintSpec, clipRay } from './targeting.js';
import { sound } from './audio.js';
import {
  CLASS_ART,
  ZOMBIE_ART,
  HAT_ZOMBIE_ART,
  PVE_MOB_ART,
  palette,
  zombiePalette,
  hatPalette,
  undeadPalette,
  pveMobPalette,
  characterSkinArt,
  MOB_FAMILY_ART,
  MOB_FAMILY_SCALE,
  LOOK_ART,
  LOOK_WEAPON,
  mobFamilyPalette,
} from './art.js';
import { MOB_FAMILIES, formName } from '@bandera/shared/rpg/mobs';
import type { MobFamilyId } from '@bandera/shared/rpg/zones';
import type { WeaponLook } from '@bandera/shared/rpg/weapons';

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
  onPlayerContext: ((player: Player, clientX: number, clientY: number) => void) | null = null;
  controls!: Controls;
  localId = '';
  snapshot?: Snapshot;
  predicted?: Player;
  localStep?: (input: Input) => void;
  /** The world character's weapon, from its sheet. It decides what a click predicts. */
  weapon: Weapon | null = null;
  /** Whether the world character can ride water, from its sheet; prediction must agree with the server. */
  surfer = false;
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
  private mobs!: Phaser.GameObjects.Graphics;
  private holes!: Phaser.GameObjects.Graphics;
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
  private mobVisuals = new Map<
    string,
    { body: Phaser.GameObjects.Sprite; hp: Phaser.GameObjects.Graphics; fx: Phaser.GameObjects.Graphics; x: number; y: number }
  >();
  private pending: Input[] = [];
  private seq = 0;
  private accumulator = 0;
  private lastEvent = 0;
  private phase = '';
  private receivedAt = 0;
  private currentMapId: MapId = 'courtyard';
  /** Empty while playing a match; the zone being painted while in the world. */
  private currentZoneId = '';
  /** The moving life of the zone's settlement (villagers, fire, altar glow), when it has one. */
  private settlement?: Settlement;
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private duelRings!: Phaser.GameObjects.Graphics;
  private longPress?: { timer: number; x: number; y: number; pointer: number };
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
    this.mobs = this.add.graphics().setDepth(8);
    this.holes = this.add.graphics().setDepth(7);
    this.aim = this.add.graphics().setDepth(4);
    this.duelRings = this.add.graphics().setDepth(3);
    this.controls = new Controls();
    this.controls.screenToWorld = (x, y) => this.screenToWorld(x, y);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !this.predicted) return;
      this.controls.angle = Math.atan2(p.worldY - this.predicted.y, p.worldX - this.predicted.x);
      const b = this.bounds();
      this.controls.aimX = Math.max(b.minX, Math.min(b.maxX, p.worldX));
      this.controls.aimY = Math.max(b.minY, Math.min(b.maxY, p.worldY));
      this.controls.aimFromPointer = true;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !this.controls.enabled) return;
      // Use the button that triggered this event. `rightButtonDown()` also stays true
      // while a left click is pressed during guard and would swallow that attack.
      if (p.button === 1) this.controls.tertiary();
      else if (p.button === 2 && this.currentZoneId && this.contextPlayer(p)) {
        const target = this.contextPlayer(p)!;
        this.onPlayerContext?.(target, (p.event as MouseEvent).clientX, (p.event as MouseEvent).clientY);
      }
      else if (p.button === 2) this.controls.secondary(true);
      else this.controls.primary();
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch || !this.currentZoneId) return;
      this.longPress = { pointer: p.id, x: p.x, y: p.y, timer: window.setTimeout(() => {
        const target = this.contextPlayer(p);
        if (target) this.onPlayerContext?.(target, (p.event as PointerEvent).clientX, (p.event as PointerEvent).clientY);
        this.longPress = undefined;
      }, 500) };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.longPress?.pointer === p.id && Math.hypot(p.x - this.longPress.x, p.y - this.longPress.y) > 10) {
        clearTimeout(this.longPress.timer); this.longPress = undefined;
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.longPress?.pointer === p.id) { clearTimeout(this.longPress.timer); this.longPress = undefined; }
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
    makeMonsterTextures(this);
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
    // World bearers: one sprite per weapon look, recoloured per team like the duel classes.
    for (const team of TEAMS)
      for (const look of Object.keys(LOOK_ART) as WeaponLook[])
        for (let frame = 0; frame < 2; frame++)
          this.textures.generate(`${team}-look-${look}-${frame}`, {
            data: LOOK_ART[look].map((row, i) =>
              frame === 1 && i >= 13 ? row.slice(0, 3) + row.slice(3, 13).split('').reverse().join('') + row.slice(13) : row,
            ),
            pixelWidth: 2,
            palette: palette(CLOTH[team], LIGHT[team]) as Phaser.Types.Create.Palette,
          });
    for (const team of TEAMS)
      for (const classId of CLASS_IDS)
      for (const skin of CHARACTER_SKINS[classId])
        for (let frame=0;frame<2;frame++) {
          const data=characterSkinArt(classId,skin.id).map((row,i)=>frame===1&&i>=13?row.slice(0,3)+row.slice(3,13).split('').reverse().join('')+row.slice(13):row);
          this.textures.generate(`${team}-${classId}-${skin.id}-${frame}`,{data,pixelWidth:2,palette:palette(skin.cloth,skin.light) as Phaser.Types.Create.Palette});
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
    for (const family of Object.keys(MOB_FAMILY_ART) as MobFamilyId[])
      for (let frame = 0; frame < 2; frame++)
        this.textures.generate(`mob-${family}-${frame}`, {
          data: stride(MOB_FAMILY_ART[family], 12, frame),
          pixelWidth: 2,
          palette: mobFamilyPalette(family) as Phaser.Types.Create.Palette,
        });
    for (const kind of Object.keys(PVE_MOB_ART) as MobKind[])
      for (let frame = 0; frame < 2; frame++)
        this.textures.generate(`pve-${kind}-${frame}`, {
          data: stride(PVE_MOB_ART[kind], kind === 'wolf' ? 11 : 12, frame),
          pixelWidth: 2,
          palette: pveMobPalette(kind) as Phaser.Types.Create.Palette,
        });
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
  /** The stonework of a wall, shared by the arena and the world. */
  private wall(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.fillStyle(0x0e1c20, 0.6);
    g.fillRect(x + 6, y + 9, w, h);
    g.fillStyle(0x313e42);
    g.fillRect(x, y, w, h);
    for (let row = 0; row < h; row += 14)
      for (let col = 0; col < w; col += 26) {
        g.fillStyle((row + col) % 3 ? 0x626e69 : 0x56635f);
        g.fillRect(x + col + 1, y + row + 1, Math.min(24, w - col - 2), Math.min(12, h - row - 2));
        g.fillStyle(0x899084, 0.55);
        g.fillRect(x + col + 2, y + row + 1, Math.min(22, w - col - 3), 2);
      }
    g.fillStyle(0x9ca08b, 0.55);
    g.fillRect(x, y, w, 3);
    g.fillStyle(0x1f2e31);
    g.fillRect(x, y + h - 6, w, 6);
  }

  /** What the camera shows right now, in world units, for the minimap's frame. */
  viewRect() {
    const view = this.cameras?.main?.worldView;
    return view ? { x: view.x, y: view.y, w: view.width, h: view.height } : null;
  }

  private contextPlayer(pointer: Phaser.Input.Pointer) {
    if (!this.snapshot) return undefined;
    return this.snapshot.players
      .filter((p) => p.id !== this.localId && p.hp > 0 && distance(p, { x: pointer.worldX, y: pointer.worldY }) <= 30)
      .sort((a, b) => distance(a, { x: pointer.worldX, y: pointer.worldY }) - distance(b, { x: pointer.worldX, y: pointer.worldY }))[0];
  }

  private paintDuels(snapshot: Snapshot) {
    this.duelRings.clear();
    const duels = (snapshot as Snapshot & { duels?: { x: number; y: number; radius: number; phase: string; countdown: number }[] }).duels ?? [];
    for (const duel of duels) {
      this.duelRings.lineStyle(4, duel.phase === 'countdown' ? 0xffd36a : 0xff5a6e, 0.8);
      this.duelRings.strokeCircle(duel.x, duel.y, duel.radius);
      this.duelRings.fillStyle(0xff5a6e, 0.035); this.duelRings.fillCircle(duel.x, duel.y, duel.radius);
    }
  }

  /** The play area: the arena's fixed rectangle, or the bounds of the zone being played. */
  private bounds(): Bounds {
    const zoneId = (this.snapshot as (Snapshot & { zoneId?: ZoneId }) | undefined)?.zoneId;
    return zoneId ? zone(zoneId).terrain.bounds : ARENA_BOUNDS;
  }

  /** What bodies collide with: the zone's terrain in the world, the map's walls in a match. */
  private terrain(): Rect[] | Terrain {
    const zoneId = (this.snapshot as (Snapshot & { zoneId?: ZoneId }) | undefined)?.zoneId;
    // The same ground the server moves this body on: water included, unless the character surfs.
    return zoneId ? worldTerrain(zoneId, this.surfer) : MAPS[this.snapshot?.mapId ?? this.currentMapId].walls;
  }

  /**
   * The input the server will actually apply. In the world the class kit is gone, so predicting a
   * guardian's dash on Space would snap the body forward and back on every press.
   */
  private shape(input: Input): Input {
    const world = !!(this.snapshot as (Snapshot & { zoneId?: ZoneId }) | undefined)?.zoneId;
    return world ? worldInput(input, this.weapon ?? 'espada') : input;
  }

  /**
   * A zone is painted plainly on purpose: ground, its walls and a border. The arena's decoration
   * (the stone cross, the lanes, the central ring, the torches) is furniture for a 960x540 room,
   * and running its noise grid over eight million pixels would cost a frame for nothing.
   */
  private drawZone(zoneId: ZoneId) {
    this.currentZoneId = zoneId;
    this.currentMapId = 'courtyard';
    this.mapObjects.forEach((object) => object.destroy());
    this.mapObjects = [];
    const definition = zone(zoneId);
    const theme = definition.theme;
    const b = definition.terrain.bounds;
    const width = b.maxX + b.minX;
    const height = b.maxY + b.minY;
    // Drawn off the display list and baked below: tens of thousands of shapes replayed every frame
    // took the world from 44 to 5 frames per second.
    const g = this.make.graphics({}, false);
    // The ground, from the same tile picture the minimap draws. The biome's base colour first, then
    // every other kind as a rounded, slightly oversized blob in layers, so edges read as organic
    // shores and meadows instead of a checkerboard.
    const map = tileMap(zoneId);
    const kind = (col: number, row: number) => TILES[map.tiles[row * map.cols + col]];
    const base = theme === 'ceniza' ? 'ash' : theme === 'bosque' ? 'grass' : 'grass';
    g.fillStyle(tileColor(theme, base));
    g.fillRect(0, 0, width, height);
    const layers: TileKind[][] = [
      ['grassLight', 'grassDark', 'moss', 'ashDark', 'dirt', 'flowers'],
      ['sand'],
      ['water'],
      ['waterDeep'],
    ];
    for (const layer of layers)
      for (let row = 0; row < map.rows; row++)
        for (let col = 0; col < map.cols; col++) {
          const name = kind(col, row);
          if (!layer.includes(name)) continue;
          const paint = name === 'flowers' ? (theme === 'bosque' ? 'grass' : 'grassLight') : name;
          g.fillStyle(tileColor(theme, paint));
          g.fillRoundedRect(col * TILE - 8, row * TILE - 8, TILE + 16, TILE + 16, 18);
        }
    // Worn roads as strokes: a dark margin, the packed earth, and pebbles along it.
    const roadColor = tileColor(theme, theme === 'ceniza' ? 'dirt' : 'road');
    for (const path of roadPaths(zoneId)) {
      for (const [widthPx, color, alpha] of [[46, 0x2a1f12, 0.35], [34, roadColor, 1]] as const) {
        g.lineStyle(widthPx, color, alpha);
        g.beginPath();
        g.moveTo(path[0].x, path[0].y);
        for (const point of path.slice(1)) g.lineTo(point.x, point.y);
        g.strokePath();
        g.fillStyle(color, alpha);
        for (const point of path) g.fillCircle(point.x, point.y, widthPx / 2);
      }
    }
    // Texture on top: tufts, flowers, ripples and embers, placed by a fixed hash so they never move.
    const speck = (col: number, row: number, salt: number) => (((col * 73856093) ^ (row * 19349663) ^ salt) >>> 0) % 1000;
    for (let row = 0; row < map.rows; row++)
      for (let col = 0; col < map.cols; col++) {
        const name = kind(col, row);
        const x = col * TILE;
        const y = row * TILE;
        const n = speck(col, row, 17);
        if ((name === 'grass' || name === 'grassDark' || name === 'grassLight' || name === 'moss') && n < 260) {
          g.fillStyle(0x000000, 0.14);
          g.fillTriangle(x + (n % 30), y + 30, x + (n % 30) + 3, y + 22 - ((n >> 3) % 6), x + (n % 30) + 6, y + 30);
          g.fillStyle(0xffffff, 0.07);
          g.fillRect(x + ((n >> 2) % 32), y + ((n >> 4) % 32), 4, 2);
        } else if (name === 'flowers') {
          for (let i = 0; i < 5; i++) {
            g.fillStyle([0xf4e27a, 0xe98bb0, 0xffffff, 0xb59cff][(n + i) % 4]);
            g.fillCircle(x + ((n * (i + 3)) % 34) + 3, y + ((n * (i + 7)) % 34) + 3, 2.5);
          }
        } else if ((name === 'water' || name === 'waterDeep') && n < 300) {
          g.fillStyle(0xffffff, 0.16);
          g.fillRect(x + (n % 24), y + ((n >> 3) % 30), 14, 2);
        } else if (name === 'ember') {
          g.fillStyle(0xff8a3a, 0.8);
          g.fillCircle(x + 18, y + 20, 4);
          g.fillStyle(0xffd27a, 0.7);
          g.fillCircle(x + 18, y + 20, 1.5);
        }
      }
    // A settlement's ground goes under everything that stands on it.
    drawSettlementGround(g, definition);
    // Buildings are drawn as themselves; every other obstacle as what the biome makes solid.
    const built = new Set((definition.props ?? []).filter((p) => p.solid).map((p) => `${p.x},${p.y},${p.w},${p.h}`));
    for (const prop of (definition.props ?? []).filter((p) => !p.solid && p.kind !== 'estandarte')) drawProp(g, prop);
    for (const w of definition.terrain.walls) {
      if (built.has(`${w.x},${w.y},${w.w},${w.h}`)) continue;
      if (theme === 'bosque') this.grove(g, w.x, w.y, w.w, w.h);
      else if (theme === 'ceniza') this.ruin(g, w.x, w.y, w.w, w.h);
      else if (theme === 'cienaga') this.deadGrove(g, w.x, w.y, w.w, w.h);
      else this.boulder(g, w.x, w.y, w.w, w.h);
    }
    const edge = b.minX;
    for (const [x, y, w, h] of [[0, 0, width, edge], [0, b.maxY, width, edge], [0, edge, edge, b.maxY - edge], [b.maxX, edge, edge, b.maxY - edge]])
      if (theme === 'bosque') this.grove(g, x, y, w, h);
      else this.wall(g, x, y, w, h);
    // Solid buildings, top to bottom so a lower roof overlaps the wall behind it; banners last.
    for (const prop of (definition.props ?? []).filter((p) => p.solid).sort((a, b) => a.y + a.h - (b.y + b.h))) drawProp(g, prop);
    for (const prop of (definition.props ?? []).filter((p) => p.kind === 'estandarte')) drawProp(g, prop);
    // The altar: where you are born, where you revive and where the world saves you.
    drawAltar(g, definition.shrine);
    // Portals: a swirl of light where the zone lets you through.
    for (const portal of definition.portals) {
      const a = portal.area;
      g.fillStyle(0x7c5cff, 0.18);
      g.fillRoundedRect(a.x, a.y, a.w, a.h, 12);
      g.lineStyle(3, 0xb9a4ff, 0.7);
      g.strokeRoundedRect(a.x, a.y, a.w, a.h, 12);
    }
    // In the wild, the ring inside which nobody can hurt anybody.
    if (definition.pvp === 'wild')
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
        g.lineStyle(2, 0x9fd8b0, 0.22);
        g.beginPath();
        g.arc(definition.shrine.x, definition.shrine.y, SHRINE_WARD, a, a + Math.PI / 48);
        g.strokePath();
      }
    this.bake(g, width, height);
    this.settlement?.destroy();
    this.settlement = new Settlement(this, definition);
  }

  /**
   * Turns a static drawing into textures, once. Chunks of 1024 px keep every texture under the
   * size any GPU accepts; each frame then draws a dozen images instead of re-tessellating the zone.
   */
  private bake(g: Phaser.GameObjects.Graphics, width: number, height: number) {
    const CHUNK = 1024;
    for (let y = 0; y < height; y += CHUNK)
      for (let x = 0; x < width; x += CHUNK) {
        const w = Math.min(CHUNK, width - x);
        const h = Math.min(CHUNK, height - y);
        const texture = this.add.renderTexture(x, y, w, h).setOrigin(0, 0).setDepth(g.depth);
        texture.draw(g, -x, -y);
        this.mapObjects.push(texture);
      }
    g.destroy();
  }

  /** A forest's obstacle: a thicket of canopies you cannot walk through. */
  private grove(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.fillStyle(0x0b1f10);
    g.fillRect(x, y, w, h);
    const step = 34;
    for (let ty = y + 10; ty < y + h; ty += step)
      for (let tx = x + 10 + (((ty - y) / step) % 2) * 16; tx < x + w; tx += step) {
        const r = 22 + (((tx * 7 + ty * 13) >>> 0) % 7);
        g.fillStyle(0x000000, 0.3);
        g.fillCircle(tx + 5, ty + 7, r);
        g.fillStyle(((tx + ty) >>> 0) % 3 ? 0x1f5a25 : 0x2a6b2c);
        g.fillCircle(tx, ty, r);
        g.fillStyle(0x4a8f3e, 0.55);
        g.fillCircle(tx - r * 0.3, ty - r * 0.35, r * 0.45);
      }
  }

  /** A world projectile drawn as its element, whatever engine class carries it. */
  private drawElementShot(p: Vec, angle: number, element: string, grow: number, time: number) {
    const g = this.arrows;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    switch (element) {
      case 'rayo': {
        // A jagged bolt that flickers: never the same zigzag two frames in a row.
        g.lineStyle(7 * grow, hex(ELEMENT_COLORS.rayo), 0.35);
        g.lineBetween(p.x - dx * 30, p.y - dy * 30, p.x, p.y);
        g.lineStyle(2.5 * grow, hex(ELEMENT_CORES.rayo), 1);
        g.beginPath();
        g.moveTo(p.x - dx * 30, p.y - dy * 30);
        for (let i = 1; i <= 4; i++) {
          const jitter = (Math.sin(time * 0.09 + i * 12.9) * 6) * grow;
          g.lineTo(p.x - dx * (30 - i * 7.5) + nx * jitter, p.y - dy * (30 - i * 7.5) + ny * jitter);
        }
        g.strokePath();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(p.x, p.y, 3.5 * grow);
        return;
      }
      case 'hielo': {
        g.fillStyle(0x7dd8ff, 0.3);
        g.fillCircle(p.x, p.y, 9 * grow);
        g.fillStyle(0xdff8ff, 1);
        g.fillTriangle(p.x + dx * 10 * grow, p.y + dy * 10 * grow, p.x + nx * 5 * grow, p.y + ny * 5 * grow, p.x - nx * 5 * grow, p.y - ny * 5 * grow);
        g.fillStyle(0x7dd8ff, 1);
        g.fillTriangle(p.x - dx * 8 * grow, p.y - dy * 8 * grow, p.x + nx * 5 * grow, p.y + ny * 5 * grow, p.x - nx * 5 * grow, p.y - ny * 5 * grow);
        return;
      }
      case 'tierra': {
        g.fillStyle(0x000000, 0.25);
        g.fillCircle(p.x + 3, p.y + 4, 7 * grow);
        g.fillStyle(0x8a6a44, 1);
        g.fillCircle(p.x, p.y, 7 * grow);
        g.fillStyle(0xb8966a, 1);
        g.fillCircle(p.x - 2, p.y - 2, 3 * grow);
        return;
      }
      case 'viento': {
        g.lineStyle(3 * grow, 0xd8fbff, 0.7);
        for (const side of [-1, 1]) {
          g.beginPath();
          g.arc(p.x - dx * 8, p.y - dy * 8, 12 * grow, angle + side * 0.9 - 0.5, angle + side * 0.9 + 0.5);
          g.strokePath();
        }
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(p.x, p.y, 3 * grow);
        return;
      }
      case 'sombra': {
        g.fillStyle(0x2a1440, 0.55);
        g.fillCircle(p.x - dx * 10, p.y - dy * 10, 8 * grow);
        g.fillStyle(hex(ELEMENT_COLORS.sombra), 0.9);
        g.fillCircle(p.x, p.y, 8 * grow);
        g.fillStyle(0x12081c, 1);
        g.fillCircle(p.x, p.y, 4 * grow);
        return;
      }
      case 'luz': {
        g.fillStyle(0xfff1a8, 0.35);
        g.fillCircle(p.x, p.y, 12 * grow);
        g.fillStyle(0xffffff, 1);
        for (let i = 0; i < 4; i++) {
          const a = time * 0.01 + (i * Math.PI) / 2;
          g.fillTriangle(p.x + Math.cos(a) * 10 * grow, p.y + Math.sin(a) * 10 * grow, p.x + Math.cos(a + 1.3) * 3, p.y + Math.sin(a + 1.3) * 3, p.x + Math.cos(a - 1.3) * 3, p.y + Math.sin(a - 1.3) * 3);
        }
        return;
      }
      case 'fisico': {
        g.fillStyle(0x6b5a44, 1);
        g.fillCircle(p.x, p.y, 5 * grow);
        g.lineStyle(2, 0x3a2e22, 0.8);
        g.strokeCircle(p.x, p.y, 5 * grow);
        return;
      }
      default: {
        // Fire: an ember with a tail.
        g.fillStyle(0xff4a1a, 0.35);
        g.fillCircle(p.x - dx * 9, p.y - dy * 9, 7 * grow);
        g.fillStyle(0xff7a2f, 1);
        g.fillCircle(p.x, p.y, 8 * grow);
        g.fillStyle(0xffe08a, 1);
        g.fillCircle(p.x + dx * 2, p.y + dy * 2, 4 * grow);
      }
    }
  }

  /** The swamp's obstacle: grey, leafless trees standing in black water. */
  private deadGrove(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.fillStyle(0x0f1712, 0.9);
    g.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 16);
    const step = 38;
    for (let ty = y + 14; ty < y + h; ty += step)
      for (let tx = x + 14 + (((ty - y) / step) % 2) * 18; tx < x + w; tx += step) {
        const seed = ((tx * 13 + ty * 7) >>> 0) % 5;
        g.lineStyle(7, 0x4a4a40);
        g.lineBetween(tx, ty + 14, tx + seed - 2, ty - 16);
        g.lineStyle(3, 0x5c5a4e);
        g.lineBetween(tx + seed - 2, ty - 6, tx + 12, ty - 18);
        g.lineBetween(tx, ty - 2, tx - 11, ty - 14);
        g.lineStyle(2, 0x6b695c);
        g.lineBetween(tx + 12, ty - 18, tx + 16, ty - 26);
      }
  }

  /** A valley's obstacle: a rounded outcrop of stone. */
  private boulder(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    if (w > 400 || h > 400) return this.wall(g, x, y, w, h);
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x + 8, y + 12, w, h, Math.min(w, h) * 0.35);
    g.fillStyle(0x6b6f69);
    g.fillRoundedRect(x, y, w, h, Math.min(w, h) * 0.35);
    g.fillStyle(0x8d918a);
    g.fillRoundedRect(x + w * 0.12, y + h * 0.1, w * 0.6, h * 0.45, Math.min(w, h) * 0.25);
    g.fillStyle(0x4f534e);
    g.fillRoundedRect(x + w * 0.2, y + h * 0.62, w * 0.7, h * 0.3, Math.min(w, h) * 0.15);
  }

  /** Ash fields: what is left of a house after the fire. */
  private ruin(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.fillStyle(0x000000, 0.35);
    g.fillRect(x + 8, y + 10, w, h);
    g.fillStyle(0x2c2420);
    g.fillRect(x, y, w, h);
    for (let py = y + 4; py < y + h - 4; py += 18) {
      g.fillStyle((py - y) % 36 ? 0x3d302a : 0x4a3a30);
      g.fillRect(x + 4, py, w - 8, 12);
    }
    g.fillStyle(0xff7a2f, 0.35);
    g.fillRect(x + w * 0.3, y + h * 0.4, Math.max(6, w * 0.12), 6);
  }

  private drawMap(mapId: MapId) {
    this.currentZoneId = '';
    this.settlement?.destroy();
    this.settlement = undefined;
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
    const wall = (x: number, y: number, w: number, h: number) => this.wall(g, x, y, w, h);
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
    // A world snapshot carries its zone; a match snapshot only ever has a map.
    const zoneId = (snapshot as Snapshot & { zoneId?: ZoneId }).zoneId;
    if (zoneId) {
      if (zoneId !== this.currentZoneId) {
        this.drawZone(zoneId);
        this.layoutKey = '';
        // Each zone is its own World with its own event counter. Without resetting the watermark,
        // crossing a portal would silently skip every effect of the new zone until its ids caught up.
        this.lastEvent = snapshot.events.at(-1)?.id ?? 0;
      }
    } else if (snapshot.mapId !== this.currentMapId) {
      this.drawMap(snapshot.mapId);
      this.layoutKey = '';
    }
    const was = this.snapshot,
      first = !was;
    this.snapshot = snapshot;
    this.paintDuels(snapshot);
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
      if (snapshot.phase !== this.phase && (snapshot.phase === 'rewards' || this.phase === 'rewards'))
        this.controls.clearCombat();
      this.predicted = { ...own };
      if ((snapshot.phase === 'playing' || snapshot.phase === 'rewards') && !snapshot.paused)
        for (const input of this.pending)
          movePlayer(
            this.predicted,
            snapshot.phase === 'rewards' ? movementInput(input) : resolveSlotInput(this.predicted, this.shape(input)),
            snapshot.flags.some((f) => f.carrier === id),
            RULES.tick,
            this.terrain(),
          );
    }
    this.phase = snapshot.phase;
    this.controls.enabled =
      (snapshot.phase === 'playing' || snapshot.phase === 'rewards') && !snapshot.paused && !!own?.hp && own.stunLeft <= 0;
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

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    const screenX = Math.max(0, Math.min(this.scale.width, (clientX - rect.left) * this.scale.width / rect.width));
    const screenY = Math.max(0, Math.min(this.scale.height, (clientY - rect.top) * this.scale.height / rect.height));
    const point = this.cameras.main.getWorldPoint(screenX, screenY);
    const bounds = this.bounds();
    return { x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)), y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)) };
  }
  /** A five-pointed seal inside its ring, drawn into the given graphics. */
  /** A spinning rune circle marking where the blink will land. */
  private blinkSeal(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    time: number,
    color: number,
    alpha = 0.9,
  ) {
    const spin = time * 0.004;
    g.lineStyle(2, color, alpha);
    g.strokeEllipse(x, y, radius * 2, radius * 0.8);
    g.lineStyle(2, color, alpha);
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3;
      g.lineBetween(
        x + Math.cos(a) * radius * 0.55,
        y + Math.sin(a) * radius * 0.22,
        x + Math.cos(a) * radius,
        y + Math.sin(a) * radius * 0.4,
      );
    }
    g.lineStyle(1, color, alpha * 0.6);
    g.strokeCircle(x, y, radius);
  }
  private spellEffect(e: Snapshot['events'][number]) {
    if (e.kind === 'imbue') {
      // An imbued weapon's blow: sparks of the affinity's colour, and a crackle over a stunned head.
      const tint = e.color ? Phaser.Display.Color.HexStringToColor(e.color).color : hex(ELEMENT_COLORS.rayo);
      this.fade(this.add.circle(e.x, e.y - 4, 7).setStrokeStyle(2, tint, 0.95).setDepth(17), { scale: 3 }, 300);
      for (let i = 0; i < 6; i++) {
        const a = (e.angle ?? 0) + (i - 2.5) * 0.45;
        const spark = this.add.graphics().setDepth(17);
        spark.lineStyle(2, tint, 1);
        spark.lineBetween(e.x, e.y - 4, e.x + Math.cos(a) * 9, e.y - 4 + Math.sin(a) * 9);
        this.fade(spark, { x: Math.cos(a) * 14, y: Math.sin(a) * 14 }, 260);
      }
      if (e.power) {
        const bolt = this.add.graphics().setDepth(18);
        bolt.lineStyle(2, tint, 1);
        bolt.beginPath();
        bolt.moveTo(e.x - 8, e.y - 34);
        [[-3, -28], [-6, -24], [2, -20], [-1, -16]].forEach(([dx, dy]) => bolt.lineTo(e.x + dx, e.y + dy));
        bolt.moveTo(e.x + 8, e.y - 34);
        [[4, -29], [8, -25], [2, -21]].forEach(([dx, dy]) => bolt.lineTo(e.x + dx, e.y + dy));
        bolt.strokePath();
        this.fade(bolt, { y: -4 }, 420);
      }
    } else if (e.kind === 'fireRain') {
      const radius = e.radius ?? 140;
      const field = this.add.circle(e.x, e.y, radius, 0xff6728, 0.13)
        .setStrokeStyle(2, 0xffb35f, 0.75).setDepth(15);
      this.fade(field, { scale: 1.08 }, 650);
      for (let i = 0; i < 22; i++) {
        const angle = i * 2.39996;
        const spread = radius * Math.sqrt((i + 0.5) / 22);
        const x = e.x + Math.cos(angle) * spread;
        const y = e.y + Math.sin(angle) * spread;
        const ember = this.add.rectangle(x + 15, y - 65 - i % 4 * 12, 3, 9, i % 3 ? 0xff8a35 : 0xffdc82)
          .setRotation(0.22).setDepth(18);
        this.tweens.add({
          targets: ember, x, y, alpha: 0, scaleY: 0.25,
          delay: i % 5 * 35, duration: 380,
          onComplete: () => ember.destroy(),
        });
      }
    } else if (e.kind === 'explosion') {
      const blackHole = e.skillId === 'mage.blackHole';
      const radius = blackHole ? RULES.blackHoleBurstRadius : RULES.explosionRadius * (0.6 + 0.4 * (e.power ?? 1));
      // A world skill brings its own colour: a lightning burst is not a fireball.
      const tint = blackHole ? 0x36105a : e.color ? Phaser.Display.Color.HexStringToColor(e.color).color : 0xff7a2f;
      const ring = blackHole ? 0xd185ff : e.color ? Phaser.Display.Color.HexStringToColor(e.color).lighten(25).color : 0xffe08a;
      if (blackHole) this.fade(this.add.circle(e.x,e.y,32,0x05020c,0.9).setDepth(18),{scale:0.1},180);
      this.fade(
        this.add.circle(e.x, e.y, 10, tint, 0.6).setDepth(16),
        { scale: radius / 10 },
        380,
      );
      this.fade(
        this.add.circle(e.x, e.y, 8).setStrokeStyle(3, ring, 0.95).setDepth(16),
        { scale: 6 },
        460,
      );
    } else if (e.kind === 'disintegrate') {
      const height = e.power === 2 ? 18 : 30;
      const silhouette = this.add.ellipse(e.x, e.y - height / 2, 15, height, 0x3b2351, 0.86).setDepth(18);
      this.fade(silhouette, { scaleX: 0.15, scaleY: 0.3, y: e.y - height }, 500);
      for (let i = 0; i < 22; i++) {
        const angle = i * 2.399;
        const spread = 8 + (i % 6) * 4;
        const shard = this.add.rectangle(e.x + Math.cos(angle) * 6, e.y - height / 2 + Math.sin(angle) * 9, 2 + i % 3, 2 + i % 2, i % 3 ? 0xb47ae5 : 0xe8c8ff, 0.9).setDepth(19);
        this.fade(shard, { x: shard.x + Math.cos(angle) * spread, y: shard.y + Math.sin(angle) * spread - 13, scale: 0.1 }, 500 + i % 5 * 45);
      }
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
    } else if (e.kind === 'blackhole') {
      this.fade(this.add.circle(e.x,e.y,12).setStrokeStyle(3,0xb866ff,0.85).setDepth(16),{scale:5},450);
    } else if (e.kind === 'blink') {
      const tx = e.tx ?? e.x;
      const ty = e.ty ?? e.y;
      // A violet wisp at the origin and a violet ring where the mage rematerialises.
      this.fade(this.add.circle(e.x, e.y, 12, 0xb9a4ff, 0.55).setDepth(8), { scale: 2.6 }, 280);
      this.fade(
        this.add.circle(tx, ty, 9).setStrokeStyle(3, 0xb9a4ff, 0.9).setDepth(16),
        { scale: 2.8 },
        320,
      );
      this.fade(this.add.circle(tx, ty, 14, 0xb9a4ff, 0.28).setDepth(7), { scale: 1.6 }, 260);
      const bearing = Math.atan2(ty-e.y,tx-e.x);
      for(let i=0;i<10;i++){
        const a=bearing+(i-4.5)*0.26;
        const from=this.add.rectangle(e.x,e.y,3,3,i%2?0x8e57e9:0xd1b9ff,0.9).setDepth(17);
        this.fade(from,{x:e.x+Math.cos(a)*(12+i*2),y:e.y+Math.sin(a)*(12+i*2)},250);
        const to=this.add.rectangle(tx+Math.cos(a)*(12+i),ty+Math.sin(a)*(12+i),3,3,i%2?0x8e57e9:0xd1b9ff,0.8).setDepth(17);
        this.fade(to,{x:tx,y:ty},320);
      }
      // Snap the teleported body so it never slides across the gap.
      if (e.playerId) {
        const v = this.visuals.get(e.playerId);
        if (v) {
          v.x = tx;
          v.y = ty;
        }
      }
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
      // A world skill brings its own colour: an electrified dagger is not a red rage.
      const inner = e.color ? Phaser.Display.Color.HexStringToColor(e.color).darken(40).color : 0x621522;
      const outer = e.color ? Phaser.Display.Color.HexStringToColor(e.color).color : 0xc83d43;
      this.fade(this.add.circle(e.x, e.y - 3, 17, inner, 0.42).setDepth(9), { scale: 2.8 }, 520);
      this.fade(
        this.add
          .circle(e.x, e.y - 3, 18)
          .setStrokeStyle(4, outer, 0.85)
          .setDepth(16),
        { scale: 3.2 },
        620,
      );
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        this.fade(
          this.add
            .circle(e.x + Math.cos(angle) * 10, e.y + Math.sin(angle) * 10, 3, e.color ? outer : 0x9f2634, 0.8)
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
    const look = p.look as WeaponLook | undefined;
    const texture = (frame: number) =>
      look && LOOK_ART[look]
        ? `${p.team}-look-${look}-${frame}`
        : CHARACTER_SKINS[p.classId].some((s) => s.id === p.skinId)
          ? `${p.team}-${p.classId}-${p.skinId}-${frame}`
          : `${p.team}-${p.classId}-${frame}`;
    // What is in the hand follows the weapon's look in the world, and the class in a match.
    const hand =
      look && LOOK_WEAPON[look]
        ? LOOK_WEAPON[look]
        : p.classId === 'archer'
          ? 'bow'
          : p.classId === 'necromancer'
            ? 'skull'
            : p.classId === 'mage'
              ? 'staff'
              : p.classId === 'guardian'
                ? 'shield'
                : 'sword';
    let v = this.visuals.get(p.id);
    if (!v) {
      v = {
        body: this.add
          .sprite(p.x, p.y, texture(0))
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
      .setTexture(texture(moving ? Math.floor(time / 110) % 2 : 0))
      .setFlipX(Math.cos(p.angle) < 0)
      .setScale(p.shotCharge>0||p.specialCharge>0?1+Math.sin(time*.018)*.045:1);
    const actionAngle=p.hp<=0?90:p.frozenLeft>0?Math.sin(time*.045)*5:p.dashLeft>0?Math.cos(p.angle)*-9:p.windup>0?Math.cos(p.angle)*6:0;
    v.body
      .setAngle(actionAngle)
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
    if (p.hp > 0 && p.imbue) {
      // The weapon carries an affinity: a glow and a crackle along the blade, in its colour.
      const tint = Phaser.Display.Color.HexStringToColor(p.imbue).color;
      const reach = hand === 'dagger' ? 27 : hand === 'bow' || hand === 'shield' ? 24 : 34;
      w.fillStyle(tint, 0.22 + 0.12 * Math.sin(time * 0.02));
      w.fillCircle(reach * 0.65, 0, 10);
      w.lineStyle(2, tint, 0.95);
      w.beginPath();
      w.moveTo(10, 0);
      for (let i = 1; i <= 5; i++) w.lineTo(10 + ((reach - 10) * i) / 5, Math.sin(time * 0.05 + i * 2.3) * 4);
      w.strokePath();
    }
    if (p.hp > 0) {
      if (hand === 'dagger') {
        // A short blade held low: it lunges forward while the strike winds up.
        const wind = p.windup > 0 ? Math.min(1, p.windup / Math.max(0.01, stats.windup)) : 0;
        const lunge = 6 * (1 - wind) * (p.windup > 0 ? 1 : 0);
        w.fillStyle(0x3a2e22);
        w.fillRect(6 + lunge, -2, 6, 4);
        w.fillStyle(GOLD);
        w.fillRect(11 + lunge, -5, 2, 10);
        w.fillStyle(0xe3e5d5);
        w.fillTriangle(13 + lunge, -2.5, 13 + lunge, 2.5, 26 + lunge, 0);
        w.lineStyle(1, 0x9aa3ab);
        w.lineBetween(14 + lunge, 0, 24 + lunge, 0);
      } else if (hand === 'bow') {
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
      } else if (hand === 'skull') {
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
      } else if (hand === 'staff') {
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
        const long = hand === 'sword' && (look === 'espadachin' || p.classId === 'vanguard');
        w.fillRect(11, -2, long ? 43 : 23, long ? 5 : 3);
        w.fillStyle(GOLD);
        w.fillRect(12, -7, 3, 14);
        w.fillStyle(0x77634b);
        w.fillRect(6, -2, 7, 4);
        if (hand === 'shield') {
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
  /**
   * A world monster: its own sprite and size, one health bar with its name and level, and the sign
   * of whatever it is winding up drawn on the ground where it will land.
   */
  private drawMonster(
    z: Zombie,
    v: { body: Phaser.GameObjects.Sprite; hp: Phaser.GameObjects.Graphics; fx: Phaser.GameObjects.Graphics; label?: Phaser.GameObjects.Text; aura: Phaser.GameObjects.Graphics; x: number; y: number },
    texture: string,
    moving: boolean,
    time: number,
    rising: number,
  ) {
    const family = z.family!;
    const scale = MOB_FAMILY_SCALE[family] * (1 + Math.min(0.35, (z.level - 1) * 0.012));
    const bob = moving ? Math.abs(Math.sin(time * (family === 'espiritu_ceniza' ? 0.02 : 0.012) + z.slot)) * 2 : 0;
    const hover = family === 'espiritu_ceniza' ? Math.sin(time * 0.006 + z.slot) * 4 - 6 : 0;
    const painted = scale * MONSTER_DISPLAY;
    v.body
      .setTexture(texture)
      .setOrigin(0.5, MONSTER_ORIGIN_Y)
      .setPosition(v.x, v.y + 6 + bob + hover + rising * 12)
      .setFlipX(Math.cos(z.angle) < 0)
      .setAngle(z.skill ? Math.sin(time * 0.05) * 6 : moving ? Math.sin(time * 0.01 + z.slot) * 3 : 0)
      .setScale(painted, painted * (1 - rising * 0.75))
      .setAlpha(Math.min(1, z.life / 1.5) * (1 - rising * 0.45));
    const color = z.skill ? Phaser.Display.Color.HexStringToColor(z.skill.color).color : 0xffffff;
    if (z.frozenLeft > 0) v.body.setTint(0x9fe8ff);
    else if (z.skill) v.body.setTint(Math.floor(time / 90) % 2 ? color : 0xffffff);
    else if (z.windup > 0) v.body.setTint(0xff6b5e);
    else v.body.clearTint();
    const top = v.y - 22 * scale - 14;
    v.label
      ?.setText(z.skill ? z.skill.name : `${formName(family, z.level)} ${z.level}`)
      .setColor(z.skill ? z.skill.color : '#ffe2c8')
      .setPosition(v.x, top - 8);
    v.aura.clear();
    v.aura.fillStyle(0x000000, 0.28);
    v.aura.fillEllipse(v.x, v.y + 8 * scale, 30 * scale, 10 * scale);
    if (family === 'espiritu_ceniza') {
      v.aura.fillStyle(0xff7a2f, 0.18 + Math.sin(time * 0.01) * 0.06);
      v.aura.fillCircle(v.x, v.y - 4, 22);
    }
    v.hp.clear();
    if (rising <= 0) {
      const width = 34 * Math.max(1, scale * 0.9);
      v.hp.fillStyle(0x140a08, 0.9);
      v.hp.fillRect(v.x - width / 2 - 1, top - 1, width + 2, 5);
      v.hp.fillStyle(MOB_FAMILIES[family].undead ? 0x9fbf5a : 0xd9453a);
      v.hp.fillRect(v.x - width / 2, top, width * Math.max(0, Math.min(1, z.hp / z.maxHp)), 3);
    }
    v.fx.clear();
    const sign = z.skill;
    if (!sign) return;
    const progress = 1 - sign.left / Math.max(0.01, sign.total);
    const pulse = 0.5 + Math.sin(time * 0.02) * 0.5;
    if (sign.kind === 'nova') {
      v.fx.fillStyle(color, 0.12 + 0.1 * pulse);
      v.fx.fillCircle(sign.x, sign.y, sign.radius);
      v.fx.fillStyle(color, 0.28);
      v.fx.fillCircle(sign.x, sign.y, sign.radius * progress);
      v.fx.lineStyle(3, color, 0.85);
      v.fx.strokeCircle(sign.x, sign.y, sign.radius);
    } else if (sign.kind === 'bolt' || sign.kind === 'charge') {
      const width = sign.kind === 'charge' ? 26 : 4;
      v.fx.lineStyle(width, color, 0.18 + 0.12 * pulse);
      v.fx.lineBetween(v.x, v.y, sign.x, sign.y);
      v.fx.lineStyle(2, color, 0.9);
      v.fx.lineBetween(v.x, v.y, v.x + (sign.x - v.x) * progress, v.y + (sign.y - v.y) * progress);
      v.fx.strokeCircle(sign.x, sign.y, 10 + 6 * pulse);
    } else {
      v.fx.lineStyle(3, color, 0.9);
      v.fx.strokeCircle(v.x, v.y, 18 + progress * 30);
      v.fx.lineStyle(1, color, 0.5);
      v.fx.strokeCircle(v.x, v.y, 10 + progress * 50);
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
          z.kind === 'thrall' || z.family
            ? this.add
                .text(z.x, z.y - 34, z.family ? '' : `☠ ${z.name ?? ''}`, {
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: z.family ? '#ffe2c8' : '#c9ffd8',
                  stroke: z.family ? '#2a0e08' : '#10241a',
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
    const texture = z.family
      ? monsterTexture(z.family, z.level, frame)
      : z.kind === 'hat'
        ? `${z.team}-hat-${frame}`
        : z.kind === 'thrall'
          ? `${z.team}-${z.classId ?? 'guardian'}-undead-${frame}`
          : `${z.team}-zombie-${frame}`;
    if (z.family) return this.drawMonster(z, v, texture, moving, time, rising);
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
  private drawPveMob(m: Mob, time: number, delta: number) {
    let v = this.mobVisuals.get(m.id);
    if (!v) {
      v = {
        body: this.add.sprite(m.x, m.y, `pve-${m.kind}-0`).setOrigin(0.5, 0.72).setDepth(10),
        hp: this.add.graphics().setDepth(13),
        fx: this.add.graphics().setDepth(9),
        x: m.x,
        y: m.y,
      };
      this.mobVisuals.set(m.id, v);
    }
    const moving = Math.hypot(m.x - v.x, m.y - v.y) > 0.25;
    const smooth = 1 - Math.exp(-delta / 55);
    v.x += (m.x - v.x) * smooth;
    v.y += (m.y - v.y) * smooth;
    const seed = Number(m.id.slice(1)) || 0;
    const pulse = 0.5 + Math.sin(time * 0.008 + seed) * 0.5;
    const frame = moving ? Math.floor((time + seed * 73) / (m.kind === 'wolf' ? 115 : 175)) % 2 : 0;
    const baseScale = m.boss ? 1.75 : m.kind === 'brute' ? 1.38 : m.kind === 'wolf' ? 1.08 : 1;
    const appearing = Math.max(0, Math.min(1, 1 - m.spawnLeft / 0.8));
    const bob = moving ? Math.abs(Math.sin(time * (m.kind === 'wolf' ? 0.018 : 0.011) + seed)) * 2 : pulse;
    v.body
      .setTexture(`pve-${m.kind}-${frame}`)
      .setPosition(v.x, v.y + bob + (1 - appearing) * 10)
      .setFlipX(Math.cos(m.angle) < 0)
      .setAngle(m.kind === 'wolf' ? Math.sin(time * 0.012 + seed) * 3 : moving ? Math.sin(time * 0.009 + seed) * 5 : 0)
      .setScale(baseScale, baseScale * Math.max(0.25, appearing))
      .setAlpha(0.3 + appearing * 0.7);
    if (m.frozenLeft > 0) v.body.setTint(0x9fe8ff);
    else if (m.windup > 0) v.body.setTint(0xff8068);
    else if (m.elite) v.body.setTint(0xffd083);
    else v.body.clearTint();

    const radius = MOB_STATS[m.kind].radius;
    v.fx.clear();
    v.fx.fillStyle(0x050706, 0.35);
    v.fx.fillEllipse(v.x, v.y + 11, radius * 2.25, radius * 0.72);
    if (m.spawnLeft > 0) {
      v.fx.lineStyle(2, m.boss ? 0xd58cff : 0xe65b4f, 0.4 + appearing * 0.55);
      v.fx.strokeCircle(v.x, v.y, radius * (1.8 - appearing * 0.45));
      for (let i = 0; i < 5; i++) {
        const angle = time * 0.004 + i * Math.PI * 0.4;
        v.fx.fillStyle(m.boss ? 0xc26ce0 : 0xc84036, 0.4 + pulse * 0.3);
        v.fx.fillRect(v.x + Math.cos(angle) * radius, v.y + Math.sin(angle) * radius * 0.45, 2, 2);
      }
    }
    if (m.elite) {
      v.fx.lineStyle(2, 0xf0b556, 0.55 + pulse * 0.35);
      v.fx.strokeEllipse(v.x, v.y + 7, radius * 2.4, radius * 0.82);
    }
    if (m.boss) {
      v.fx.fillStyle(0x6b267c, 0.1 + pulse * 0.08);
      v.fx.fillCircle(v.x, v.y - 4, 36 + pulse * 3);
      v.fx.lineStyle(2, 0xc879df, 0.45 + pulse * 0.3);
      v.fx.strokeCircle(v.x, v.y - 4, 34 + pulse * 2);
    }
    if (m.windup > 0) {
      const reach = MOB_STATS[m.kind].range;
      v.fx.fillStyle(0xe95445, 0.12 + pulse * 0.08);
      v.fx.slice(v.x, v.y, reach + radius, m.angle - 0.62, m.angle + 0.62, false);
      v.fx.fillPath();
      v.fx.lineStyle(1, 0xffa17f, 0.65);
      v.fx.beginPath();
      v.fx.arc(v.x, v.y, reach + radius, m.angle - 0.62, m.angle + 0.62);
      v.fx.strokePath();
    }
    const dx = Math.cos(m.angle), dy = Math.sin(m.angle);
    if (m.kind === 'skeleton') {
      const handX = v.x + dx * 7, handY = v.y - 5 + dy * 4;
      v.fx.lineStyle(2, 0x6b4930, 1);
      v.fx.beginPath();
      v.fx.arc(handX + dx * 7, handY + dy * 7, 10, m.angle - Math.PI / 2, m.angle + Math.PI / 2);
      v.fx.strokePath();
      v.fx.lineStyle(1, 0xd7c6a4, 0.9);
      v.fx.lineBetween(handX - dy * 9, handY + dx * 9, handX + dy * 9, handY - dx * 9);
    } else if (m.kind === 'brute' || m.boss) {
      const handX = v.x + dx * 8, handY = v.y - 4 + dy * 8;
      const length = m.boss ? 30 : 23;
      v.fx.lineStyle(m.boss ? 5 : 4, 0x2b211d, 1);
      v.fx.lineBetween(handX, handY, handX + dx * length, handY + dy * length);
      v.fx.fillStyle(m.boss ? 0xa95bc2 : 0x777d74, 1);
      v.fx.fillCircle(handX + dx * length, handY + dy * length, m.boss ? 7 : 5);
    }
    v.hp.clear();
    if (!m.boss && m.spawnLeft <= 0) {
      const width = m.kind === 'brute' ? 38 : 30;
      v.hp.fillStyle(0x111817, 0.95);
      v.hp.fillRect(v.x - width / 2, v.y - 31 * baseScale, width, 4);
      v.hp.fillStyle(m.elite ? 0xf0b556 : 0xd95a4f, 1);
      v.hp.fillRect(v.x - width / 2, v.y - 31 * baseScale, width * Math.max(0, m.hp / m.maxHp), 4);
    }
  }
  update(time: number, delta: number) {
    if (!this.controls) return;
    this.settlement?.update(time, delta);
    this.updateCamera(delta);
    if (!this.snapshot) return;
    let s = this.snapshot;
    this.holes.clear();
    for(const hole of s.blackHoles ?? []){
      const spin=time*0.002+hole.id;
      const pulse=0.5+0.5*Math.sin(time*0.006+hole.id);
      const radius=hole.currentRadius??hole.radius;
      const core=8+14*Math.min(1,radius/hole.radius);
      if(hole.traveling){
        const a=Math.atan2(hole.targetY-hole.y,hole.targetX-hole.x);
        this.holes.lineStyle(3,0x9c62d0,0.44);this.holes.lineBetween(hole.x-Math.cos(a)*22,hole.y-Math.sin(a)*22,hole.x,hole.y);
        this.holes.lineStyle(1,0xd29cfa,0.45);this.holes.strokeCircle(hole.targetX,hole.targetY,12+pulse*3);
      }
      this.holes.fillStyle(0x12071e,0.12);this.holes.fillCircle(hole.x,hole.y,radius);
      this.holes.lineStyle(2,0x8c4ac9,0.45+pulse*0.2);this.holes.strokeCircle(hole.x,hole.y,radius);
      this.holes.fillStyle(0x030208,0.92);this.holes.fillCircle(hole.x,hole.y,core);
      this.holes.lineStyle(3,0xb657ed,0.86);this.holes.strokeCircle(hole.x,hole.y,core+3+pulse*3);
      for(let i=0;i<12;i++){
        const a=spin+i*Math.PI*2/12;
        const travel=((time*0.06+i*31)%Math.max(1,radius-26))+26;
        const r=radius-travel+22;
        this.holes.fillStyle(i%3?0x9856da:0xd69cff,0.55);
        this.holes.fillRect(hole.x+Math.cos(a)*r,hole.y+Math.sin(a)*r,3,3);
      }
    }
    for(const caster of s.players)if(caster.blackHoleCast>0||caster.blackHoleTelegraph){
      const x=caster.blackHoleTelegraph?.x??caster.blackHoleX,y=caster.blackHoleTelegraph?.y??caster.blackHoleY;
      // Mark the impact point without covering the eventual pull radius during the cast.
      const markerRadius=23+Math.sin(time*0.006)*2;
      this.holes.fillStyle(0x180b27,0.36);this.holes.fillCircle(x,y,markerRadius);
      this.holes.lineStyle(2,0xb96afa,0.8);this.holes.strokeCircle(x,y,markerRadius);
      this.holes.lineStyle(1,0xd8a8ff,0.55);this.holes.strokeCircle(x,y,markerRadius*0.5);
      this.holes.fillStyle(0x08030f,0.85);this.holes.fillCircle(x,y,4);
      this.blinkSeal(this.holes,caster.x,caster.y,18,time,0x9f55df,0.8);
    }
    if(this.controls.worldAimDragging&&this.controls.aimX>=0){
      this.blinkSeal(this.holes,this.controls.aimX,this.controls.aimY,20,time,0xc278f5,0.9);
    }
    this.accumulator += Math.min(delta, 100);
    if (this.predicted && !this.controls.aimFromPointer) {
      // Touch aiming has no cursor: project the aim direction into the arena instead.
      const a = this.controls.angle;
      const b = this.bounds();
      this.controls.aimX = Math.max(
        b.minX,
        Math.min(b.maxX, this.predicted.x + Math.cos(a) * 150),
      );
      this.controls.aimY = Math.max(
        b.minY,
        Math.min(b.maxY, this.predicted.y + Math.sin(a) * 150),
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
        const rawInput = this.controls.read(++this.seq);
        const input = s.phase === 'rewards' ? movementInput(rawInput) : rawInput;
        this.send(input);
        this.pending.push(input);
        if (this.pending.length > 90) this.pending.shift();
        // Predicting against the arena's walls in a zone clamped the body at x 940 every frame,
        // and every snapshot then yanked it back to where the server had it.
        if (this.predicted)
          movePlayer(
            this.predicted,
            this.shape(input),
            s.flags.some((f) => f.carrier === this.localId),
            RULES.tick,
            this.terrain(),
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
    this.mobs.clear();
    for (const mob of s.mobs) this.drawPveMob(mob, time, delta);
    // Monster projectiles of the world: a glowing orb in its skill's colour, with a short tail.
    for (const shot of (s as Snapshot & { mobShots?: { x: number; y: number; angle: number; color: string; radius: number }[] }).mobShots ?? []) {
      const color = Phaser.Display.Color.HexStringToColor(shot.color).color;
      const dx = Math.cos(shot.angle);
      const dy = Math.sin(shot.angle);
      this.mobs.lineStyle(shot.radius, color, 0.25);
      this.mobs.lineBetween(shot.x - dx * 26, shot.y - dy * 26, shot.x, shot.y);
      this.mobs.fillStyle(color, 0.35);
      this.mobs.fillCircle(shot.x, shot.y, shot.radius + 4);
      this.mobs.fillStyle(color, 1);
      this.mobs.fillCircle(shot.x, shot.y, shot.radius * 0.7);
      this.mobs.fillStyle(0xffffff, 0.8);
      this.mobs.fillCircle(shot.x - dx * 1.5, shot.y - dy * 1.5, shot.radius * 0.3);
    }
    for(const shot of s.mobProjectiles){const dx=Math.cos(shot.angle),dy=Math.sin(shot.angle);this.mobs.lineStyle(3,0xe9e4cf,.9);this.mobs.lineBetween(shot.x-dx*10,shot.y-dy*10,shot.x,shot.y);this.mobs.fillStyle(0xd25d45);this.mobs.fillTriangle(shot.x+dx*4,shot.y+dy*4,shot.x-dy*3,shot.y+dx*3,shot.x+dy*3,shot.y-dx*3);}
    for (const [id, v] of this.mobVisuals) {
      if (s.mobs.some((mob) => mob.id === id)) continue;
      v.body.destroy();
      v.hp.destroy();
      v.fx.destroy();
      this.mobVisuals.delete(id);
    }
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
    // Someone riding water: a board of light under the feet and foam trailing behind.
    const zoneHere = (s as Snapshot & { zoneId?: ZoneId }).zoneId;
    if (zoneHere) {
      const ground = worldTerrain(zoneHere);
      for (const q of s.players) {
        const at = q.id === this.localId && this.predicted ? this.predicted : q;
        if (q.hp <= 0 || !wet(at.x, at.y + 6, 2, ground)) continue;
        const bob = Math.sin(time * 0.012 + at.x * 0.01) * 1.5;
        this.traps.fillStyle(0xffffff, 0.35);
        this.traps.fillEllipse(at.x - Math.cos(q.angle) * 14, at.y + 12, 34, 10);
        this.traps.fillStyle(0x9fe8ff, 0.9);
        this.traps.fillEllipse(at.x, at.y + 10 + bob, 30, 9);
        this.traps.lineStyle(2, 0xffffff, 0.8);
        this.traps.strokeEllipse(at.x, at.y + 10 + bob, 30, 9);
      }
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
    // World chests: coloured by tier, lid shut while ready, dimmed and open while they come back,
    // and a ring filling up while somebody opens one.
    for (const chest of (s as Snapshot & { chests?: ChestView[] }).chests ?? []) {
      const color = CHEST_COLOR[chest.tier];
      const alpha = chest.ready ? 1 : 0.4;
      if (chest.tier === 'legendario' && chest.ready) {
        this.traps.fillStyle(color, 0.12 + 0.08 * Math.sin(time * 0.004));
        this.traps.fillCircle(chest.x, chest.y, 30);
      }
      this.traps.fillStyle(0x000000, 0.25 * alpha);
      this.traps.fillEllipse(chest.x, chest.y + 10, 30, 8);
      this.traps.fillStyle(0x4a3220, alpha);
      this.traps.fillRoundedRect(chest.x - 11, chest.y - 4, 22, 14, 2);
      this.traps.fillStyle(color, alpha);
      if (chest.ready) this.traps.fillRoundedRect(chest.x - 12, chest.y - 10, 24, 8, { tl: 5, tr: 5, bl: 0, br: 0 });
      else this.traps.fillRect(chest.x - 12, chest.y - 16, 24, 4);
      this.traps.fillRect(chest.x - 2, chest.y - 4, 4, 5);
      this.traps.lineStyle(1, 0x1a120a, 0.8 * alpha);
      this.traps.strokeRoundedRect(chest.x - 11, chest.y - 4, 22, 14, 2);
      if (chest.progress > 0) {
        this.traps.lineStyle(3, color, 0.95);
        this.traps.beginPath();
        this.traps.arc(chest.x, chest.y, 22, -Math.PI / 2, -Math.PI / 2 + chest.progress * Math.PI * 2);
        this.traps.strokePath();
      }
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
      const p = lineClear(a, next, this.terrain()) ? next : a;
      const grow = 1 + (a.power ?? 0);
      if (a.worldElement) {
        this.drawElementShot(p, a.angle, a.worldElement, grow, time);
        continue;
      }
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
      } else if ((a.skillId === 'mage.fireball' || a.skillId === 'necromancer.fire' || a.classId === 'mage' || a.classId === 'necromancer') && (a.power ?? 0) > 0.05) {
        this.drawBlaze(
          p,
          a.angle,
          a.power!,
          time,
          a.skillId === 'necromancer.fire' || (!a.skillId&&a.classId === 'necromancer') ? 0xc26bff : 0xff6a1f,
        );
      } else if (a.skillId === 'necromancer.fire' || (!a.skillId&&a.classId === 'necromancer')) {
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
      } else if (a.skillId === 'mage.fireball' || (!a.skillId&&a.classId === 'mage')) {
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
    if (this.controls.enabled && this.predicted && s.phase === 'playing') {
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
    const b = this.bounds();
    const world = b !== ARENA_BOUNDS;
    // In a match: always contain the complete 16:9 arena. Cover zoom made wide phones crop routes
    // and flags. In the world: follow the character, showing at most one arena's worth of ground,
    // which is exactly the interest rectangle the server sends — see any more and entities would
    // appear out of thin air at the edge of the screen.
    const zoom = world
      ? Math.max(width / RULES.width, height / RULES.height)
      : Math.min(width / RULES.width, height / RULES.height);
    const me =
      this.predicted ?? this.snapshot?.players.find((p) => p.id === this.localId) ?? undefined;
    let targetX = RULES.width / 2;
    let targetY = RULES.height / 2;
    if (world && me) {
      // Clamped so the camera never looks past the edge of the zone. When the zone is narrower
      // than the screen the two limits cross, so the larger one wins and it simply centres.
      const halfWidth = width / zoom / 2;
      const halfHeight = height / zoom / 2;
      const minX = b.minX + halfWidth;
      const maxX = Math.max(minX, b.maxX - halfWidth);
      const minY = b.minY + halfHeight;
      const maxY = Math.max(minY, b.maxY - halfHeight);
      targetX = Math.min(Math.max(me.x, minX), maxX);
      targetY = Math.min(Math.max(me.y, minY), maxY);
    }
    const key = `${width}x${height}:${world ? 'follow' : 'contain'}`;
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
    const walls = this.terrain();
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
    } else if (spec.kind === 'blink') {
      const aimDist = p.aimX >= 0 && p.aimY >= 0 ? Math.hypot(p.aimX - p.x, p.aimY - p.y) : 0;
      const hasAim = aimDist > 1;
      const blinkAngle = hasAim ? Math.atan2(p.aimY - p.y, p.aimX - p.x) : angle;
      const range = hasAim ? aimDist : spec.range;
      const to = blinkTarget(p, blinkAngle, range, walls);
      this.aim.lineStyle(1, 0xb9a4ff, 0.2);
      this.aim.lineBetween(p.x, p.y, to.x, to.y);
      this.blinkSeal(this.aim, to.x, to.y, 16 + pulse * 2, time, 0xb9a4ff, 0.82);
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
