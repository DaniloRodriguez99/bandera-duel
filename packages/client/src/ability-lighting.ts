import { arrowMotion, playerVisibleTo, wavePoint, WAVE_COLORS, type Arrow, type GameEvent, type Snapshot, type Vec } from '@bandera/shared';
import { ELEMENT_COLORS, hex } from '@bandera/shared/rpg/colors';
import type { EffectLighting } from './torch-effects';

interface TrackedLight { x: number; y: number; color: number; radius: number; intensity: number; seen: number }
interface View { x: number; y: number; width: number; height: number }
const LIMIT = 32;
const FADE = 160;
const element = (name: string) => Object.hasOwn(ELEMENT_COLORS, name) ? hex(ELEMENT_COLORS[name as keyof typeof ELEMENT_COLORS]) : undefined;
const colorValue = (color?: string) => color && /^#[0-9a-f]{6}$/i.test(color) ? hex(color) : undefined;
const luminousColors = new Set([
  ...Object.entries(ELEMENT_COLORS).filter(([name]) => name !== 'fisico' && name !== 'tierra').map(([, color]) => color.toLowerCase()),
  ...Object.entries(WAVE_COLORS).filter(([name]) => name !== 'steel').map(([, colors]) => colors.glow.toLowerCase()),
]);

/** Tracks only existing luminous combat entities. Never changes authoritative state. */
export class AbilityLightingController {
  private lights = new Map<string, TrackedLight>();
  private previous?: Snapshot;
  private receivedAt = 0;
  private view?: View;
  private sampler?: (arrow: Arrow) => Vec;
  private destroyed = false;
  constructor(private lighting: EffectLighting) {}
  get diagnostics() { return [...this.lights].map(([id, light]) => ({ id, ...light })); }
  setView(view: View) { this.view = view; }
  /** Supply the scene's exact rendered projectile position when prediction differs. */
  setProjectileSampler(sampler?: (arrow: Arrow) => Vec) { this.sampler = sampler; }
  private visible(x: number, y: number, radius: number) {
    const v = this.view;
    return Number.isFinite(x) && Number.isFinite(y) && (!v || (x + radius >= v.x && x - radius <= v.x + v.width && y + radius >= v.y && y - radius <= v.y + v.height));
  }
  sync(snapshot: Snapshot, now = performance.now()) {
    if (this.destroyed) return;
    if (snapshot !== this.previous) { this.previous = snapshot; this.receivedAt = now; }
    const age = snapshot.paused ? 0 : Math.max(0, Math.min((now - this.receivedAt) / 1000, 1 / 15));
    const seen = new Set<string>();
    const add = (id: string, x: number, y: number, color: number, radius: number, intensity: number) => {
      if (!this.visible(x, y, radius)) return;
      id = 'ability:' + id;
      if (!this.lights.has(id) && this.lights.size >= LIMIT) return;
      const light = { x, y, color, radius, intensity, seen: now };
      this.lights.set(id, light); seen.add(id);
      this.lighting.setLight(id, { x, y, color, radius, intensity, falloff: 1.8 });
    };
    for (const a of snapshot.arrows) {
      let color: number | undefined;
      if (a.worldElement) color = a.worldElement === 'fisico' || a.worldElement === 'tierra' ? undefined : element(a.worldElement);
      else if (a.ice || a.element === 'ice') color = 0x91dfff;
      else if (a.element === 'fire' || a.classId === 'mage') color = 0xff8438;
      else if (a.classId === 'necromancer') color = 0x9b3b71;
      else if (a.wind || a.gust) color = 0xa3e9d5;
      if (color === undefined || a.life <= 0) continue;
      const p = this.sampler?.(a) ?? { x: a.x + Math.cos(a.angle) * arrowMotion(a).speed * age, y: a.y + Math.sin(a.angle) * arrowMotion(a).speed * age };
      add('projectile:' + a.id, p.x, p.y, color, 48 + Math.min(1, a.power ?? 0) * 28, .65);
    }
    for (const h of snapshot.blackHoles) if (h.left > 0) add('hole:' + h.id, h.x, h.y, 0x9863d9, Math.min(125, 48 + h.currentRadius), .75);
    for (const w of snapshot.waves) {
      if (w.tint === 'steel') continue;
      const travel = Math.min(w.range, w.travelled + w.speed * age);
      const p = wavePoint(w, travel, 0);
      add('wave:' + w.id, p.x, p.y, hex(WAVE_COLORS[w.tint].glow), Math.min(110, 45 + w.halfWidth), .75);
    }
    for (const p of snapshot.players) {
      if (p.hp <= 0 || p.eliminated || (snapshot.perspective && !playerVisibleTo(snapshot, p, snapshot.perspective))) continue;
      // Only existing magical weapon glow/empowered states illuminate an idle bearer.
      const imbueColor = p.imbue && luminousColors.has(p.imbue.toLowerCase()) ? colorValue(p.imbue) : undefined;
      const weaponColor = imbueColor ?? (p.furyLeft > 0 ? p.empowered === 'awaken' ? hex(WAVE_COLORS.violet.glow)
        : p.empowered === 'reinforce' ? hex(WAVE_COLORS.scarlet.glow) : undefined : undefined);
      if (weaponColor !== undefined) add('weapon:' + p.id, p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18, weaponColor, 46, .4);
      let color: number | undefined;
      const charge = Math.max(p.blackHoleCharge, p.blinkCharge, p.shotCharge, p.chargeT);
      if (charge <= 0) continue;
      if (p.blackHoleCharge > 0 || p.blinkCharge > 0) color = 0x9863d9;
      else if (p.chargeSkill.startsWith('guardian.')) color = 0x69bfff;
      else if (p.chargeSkill.startsWith('vanguard.') && p.chargeT > .22) color = 0xe54e38;
      else if (p.classId === 'mage') color = 0xff8438;
      else if (p.classId === 'necromancer') color = 0x9b3b71;
      if (color !== undefined) add('charge:' + p.id, p.x + Math.cos(p.angle) * 9, p.y - 10 + Math.sin(p.angle) * 9, color, 40 + Math.min(1, charge) * 20, .45);
    }
    for (const [id, light] of this.lights) {
      if (seen.has(id)) continue;
      const fade = 1 - (now - light.seen) / FADE;
      if (fade <= 0 || !this.visible(light.x, light.y, light.radius)) { this.lighting.removeLight(id); this.lights.delete(id); }
      else this.lighting.setLight(id, { ...light, intensity: light.intensity * fade, falloff: 1.8 });
    }
  }
  event(e: GameEvent) {
    if (this.destroyed || !this.visible(e.x, e.y, 100)) return;
    let color: number | undefined;
    if (['explosion', 'fireRain'].includes(e.kind)) color = 0xff8438;
    else if (['freeze', 'icecone'].includes(e.kind)) color = 0x91dfff;
    else if (['blackhole', 'blink', 'disintegrate', 'mandala'].includes(e.kind)) color = 0x9863d9;
    else if (['shock'].includes(e.kind) || (e.kind === 'dash' && e.classId === 'guardian')) color = 0x69bfff;
    else if (['bond', 'drain', 'bondBreak', 'raise'].includes(e.kind)) color = 0x9b3b71;
    else if (e.kind === 'wind') color = 0xa3e9d5;
    else if (e.kind === 'cast' || e.kind === 'shot') {
      if (e.classId === 'mage') color = 0xff8438;
      else if (e.classId === 'necromancer') color = 0x9b3b71;
      else if (e.color && luminousColors.has(e.color.toLowerCase())) color = colorValue(e.color);
    } else if (e.kind === 'hit' && e.color && luminousColors.has(e.color.toLowerCase())) color = colorValue(e.color);
    else if (e.kind === 'slash' || (e.kind === 'swing' && (e.power ?? 0) > 0)) {
      if (e.classId === 'guardian') color = 0x69bfff;
      else if (e.classId === 'vanguard') color = 0xe54e38;
    }
    if (color !== undefined) this.lighting.flash(e.x, e.y, colorValue(e.color) ?? color);
  }
  clear() {
    for (const id of this.lights.keys()) this.lighting.removeLight(id);
    this.lights.clear(); this.previous = undefined;
  }
  destroy() { if (this.destroyed) return; this.clear(); this.destroyed = true; this.sampler = undefined; }
}
