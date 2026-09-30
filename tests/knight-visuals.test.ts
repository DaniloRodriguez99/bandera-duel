import { describe, expect, it } from 'vitest';
import { KNIGHT_SWORD_CHARGE, MOVES, WAVE_COLORS, newPlayer, type Player } from '@bandera/shared';
import { bladePose, onScreen } from '../packages/client/src/combat-fx';
import { faceOf, faceTint, pendingStep } from '../packages/client/src/combo-icons';

const knight = (change: Partial<Player> = {}): Player => ({
  ...newPlayer('k', 'K', 'blue', 'guardian'),
  x: 300,
  y: 300,
  angle: 0,
  ...change,
});
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

describe('el ícono del corte que sigue', () => {
  it('cambia con la cadena: dos cortes horizontales opuestos y el descendente', () => {
    const faces = [0, 1, 2].map((combo) => faceOf(knight({ combo }), 'guardian.sword'));
    expect(new Set(faces).size).toBe(3);
    expect([0, 1, 2, 3].map((combo) => pendingStep(knight({ combo }), 'guardian.sword'))).toEqual([0, 1, 2, 0]);
    // The opposite cuts are one drawing mirrored; the descending one is its own.
    expect(faces[1]).toContain('scale(-1 1)');
    expect(faces[0]).not.toContain('scale(-1 1)');
    expect(faces[2]).toContain('rotate(128)');
  });

  it('se tiñe con el estado de la carga, violeta despierto y de relámpago en reposo', () => {
    expect(faceTint(knight(), 'guardian.sword')).toBe(WAVE_COLORS.lightning.glow);
    expect(faceTint(knight({ empowered: 'awaken' }), 'guardian.sword')).toBe(WAVE_COLORS.violet.glow);
    const tiers = KNIGHT_SWORD_CHARGE.tiers;
    const held = (tier: number) => knight({ chargeSkill: 'guardian.sword', chargeT: tiers[tier].at + 0.01 });
    expect(faceTint(held(3), 'guardian.sword')).toBe(WAVE_COLORS[tiers[3].tint!].glow);
    expect(faceTint(held(4), 'guardian.sword')).toBe(WAVE_COLORS.crimson.glow);
  });
});

describe('el Tajo Descendente se ve en diagonal', () => {
  const finisher = MOVES['guardian.sword:2:0'];
  const strike = finisher.strikes[0];
  const at = (seconds: number, aim = 0) =>
    bladePose(knight({ move: 'guardian.sword:2:0', moveT: seconds, moveAngle: aim, angle: aim }), 0);
  const turn = (angle: number, aim: number) => wrap(angle - aim);

  it('sube por encima del hombro de la mano de la espada, en alto, y cae a lo largo de la puntería', () => {
    // Aiming up the screen, the sword hand is to the east.
    const aim = -Math.PI / 2;
    const raised = at(strike.start - 1e-6, aim);
    expect(turn(raised.angle, aim)).toBeGreaterThan(Math.PI / 2);
    expect(raised.lift).toBeGreaterThan(0.5);
    // Halfway down it crosses that side, not the front or the back: a slanted fall.
    const falling = at((strike.start + strike.end) / 2, aim);
    expect(turn(falling.angle, aim)).toBeGreaterThan(0.2);
    expect(turn(falling.angle, aim)).toBeLessThan(Math.PI / 2);
    // Landed: along the aim, at full length, on the ground.
    const landed = at(strike.end, aim);
    expect(Math.abs(turn(landed.angle, aim))).toBeLessThan(0.2);
    expect(landed.length).toBeGreaterThan(1);
    expect(landed.lift).toBe(0);
  });

  it('si la mano de la espada da a la cámara, baja por el otro hombro, donde su altura se ve', () => {
    // Aiming east the sword hand is to the south, toward the camera: it comes over the left.
    expect(turn(at(strike.start - 1e-6, 0).angle, 0)).toBeLessThan(-Math.PI / 2);
    expect(turn(at(strike.start - 1e-6, Math.PI).angle, Math.PI)).toBeGreaterThan(Math.PI / 2);
  });

  it('en alto se dibuja de pie sobre la cabeza, y en el suelo, tendida', () => {
    for (const aim of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const raised = onScreen(at(strike.start - 1e-6, aim));
      expect(Math.sin(raised.angle)).toBeLessThan(-0.5);
      expect(raised.length).toBeGreaterThan(0.5);
      const landed = onScreen(at(strike.end, aim));
      expect(Math.abs(wrap(landed.angle - aim))).toBeLessThan(0.3);
    }
    // A horizontal cut is drawn as it is.
    const flat = bladePose(knight({ move: 'guardian.sword:0:0', moveT: 0.15, moveAngle: 0 }), 0);
    expect(onScreen(flat)).toEqual({ angle: flat.angle, length: flat.length });
  });

  it('deja en el aire el camino de su caída: desde encima de la cabeza hasta el suelo frente a él', () => {
    const pose = at(strike.end);
    expect(pose.streak).not.toBeNull();
    const first = pose.streak![0];
    const last = pose.streak!.at(-1)!;
    expect(first.y).toBeLessThan(300 - 25);
    expect(Math.abs(first.x - 300)).toBeLessThan(30);
    expect(last.x).toBeGreaterThan(300 + 80);
    expect(Math.abs(last.y - 300)).toBeLessThan(20);
    // Horizontal cuts leave no such streak.
    const flat = bladePose(knight({ move: 'guardian.sword:0:0', moveT: MOVES['guardian.sword:0:0'].strikes[0].end, moveAngle: 0 }), 0);
    expect(flat.streak).toBeNull();
    // It fades a moment after the landing, and is gone before the move ends.
    expect(at(finisher.duration).streak).toBeNull();
  });
});
