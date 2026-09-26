import {
  CLASSES,
  MAPS,
  RULES,
  blocked,
  blackHoleStats,
  blinkReach,
  chargePower,
  projectileStats,
  type MapId,
  type Player,
  type Rect,
  type Terrain,
  type Vec,
} from '@bandera/shared';

export type BlueprintKind = 'line' | 'triple' | 'dash' | 'blink' | 'singularity' | 'cone' | 'circle' | 'placement' | 'defense';

export interface BlueprintSpec {
  kind: BlueprintKind;
  range: number;
  radius: number;
  arc?: number;
  offsets?: number[];
  origin?: boolean;
}

function shotPower(p: Player) {
  if (p.classId === 'archer') return Math.min(1, p.shotCharge / RULES.chargeTime);
  return chargePower(p.shotCharge);
}

export function blueprintSpec(p: Player, abilityId: string): BlueprintSpec | null {
  const stats = CLASSES[p.classId];
  if (abilityId === 'shot') {
    const power = shotPower(p);
    const projectile = projectileStats(p.classId, p.classId === 'archer' && power >= 1, power);
    return { kind: 'line', range: projectile.speed * projectile.life, radius: projectile.radius };
  }
  if (abilityId === 'volley') {
    const projectile = projectileStats('archer', false, p.shotCharge >= RULES.overchargeTap ? RULES.volleyChargedPower : 0);
    return {
      kind: 'triple',
      range: projectile.speed * projectile.life,
      radius: projectile.radius,
      offsets: [-RULES.volleyAngle, 0, RULES.volleyAngle],
    };
  }
  if (abilityId === 'dash') {
    // The reach grows with the hold; even a tap waits for the minimum charge, so show that one.
    if (p.classId === 'mage')
      return { kind: 'blink', range: blinkReach(Math.max(p.blinkCharge, RULES.mageBlinkMinCharge)), radius: RULES.radius };
    const duration =
      p.classId === 'guardian'
        ? RULES.guardianDashDuration
        : RULES.dashDuration *
          (1 + 0.8 * chargePower(p.specialCharge)) *
          (p.classId === 'vanguard' ? RULES.vanguardDash : 1);
    return {
      kind: 'dash',
      range: duration * (p.classId === 'guardian' ? RULES.guardianDashSpeed : RULES.dashSpeed),
      radius: RULES.radius,
    };
  }
  if (abilityId === 'black-hole') {
    const hole = blackHoleStats(p.blackHoleCharge);
    return { kind: 'singularity', range: hole.range, radius: hole.burstRadius };
  }
  if (abilityId === 'sword') {
    const power = chargePower(p.shotCharge);
    return {
      kind: 'cone',
      range: stats.meleeRange * (1 + 0.3 * power),
      radius: 0,
      arc: stats.meleeArc * (1 + 0.2 * power),
    };
  }
  if (abilityId === 'dagger')
    return { kind: 'cone', range: stats.meleeRange, radius: 0, arc: stats.meleeArc };
  if (abilityId === 'ice') {
    const projectile = projectileStats('mage');
    return { kind: 'line', range: projectile.speed * projectile.life, radius: projectile.radius };
  }
  if (abilityId === 'shield-bash')
    return { kind: 'cone', range: RULES.shieldBashRange, radius: 0, arc: RULES.shieldBashArc };
  if (abilityId === 'slash') {
    const slash = projectileStats('vanguard');
    return { kind: 'line', range: slash.speed * slash.life, radius: slash.radius };
  }
  if (abilityId === 'guard')
    return { kind: 'defense', range: Math.max(54, stats.meleeRange), radius: 0, arc: RULES.guardArc };
  if (abilityId === 'counter') return { kind: 'circle', range: 34, radius: 34, origin: true };
  if (abilityId === 'trap')
    return { kind: 'circle', range: RULES.trapRadius, radius: RULES.trapRadius, origin: true };
  if (abilityId === 'magic-shield') return { kind: 'circle', range: 30, radius: 30, origin: true };
  if (abilityId === 'summon') {
    if (p.specialCharge >= RULES.overchargeTime)
      return { kind: 'placement', range: RULES.raiseRange, radius: 28 };
    return {
      kind: 'circle',
      range: RULES.zombieFlankRadius + RULES.zombieRadius,
      radius: RULES.zombieFlankRadius + RULES.zombieRadius,
      origin: true,
    };
  }
  if (abilityId === 'mark')
    return { kind: 'placement', range: 150, radius: RULES.zombieMarkPick };
  return null;
}

export function clipRay(origin: Vec, angle: number, range: number, walls: Rect[] | Terrain, radius = 1) {
  const step = 3;
  for (let distance = step; distance <= range; distance += step) {
    const x = origin.x + Math.cos(angle) * distance;
    const y = origin.y + Math.sin(angle) * distance;
    if (blocked(x, y, radius, walls)) return Math.max(0, distance - step);
  }
  return range;
}

export function previewRange(origin: Vec, angle: number, range: number, mapId: MapId, radius = 1) {
  return clipRay(origin, angle, range, MAPS[mapId].walls, radius);
}
