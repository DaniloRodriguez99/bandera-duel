import { KIT, WAVE_COLORS, chargeTier, type Player, type SkillId } from '@bandera/shared';

/**
 * The faces of a chain's card: a sword silhouette in the plane of the cut that comes next, so the
 * button says which technique a press (or a hold) will throw. The trail takes the colour of the
 * charge through `--face-tint`.
 */

/** A sword pointing along +x, centred on the origin, 50 units long. */
const SWORD =
  '<circle cx="-22" cy="0" r="3.2" fill="#c9a24a" stroke="#1b1206" stroke-width="1.2"/>' +
  '<rect x="-20" y="-2.2" width="9" height="4.4" rx="1.4" fill="#5a3a1c" stroke="#1b1206" stroke-width="1.2"/>' +
  '<rect x="-11.5" y="-8.5" width="3.6" height="17" rx="1.4" fill="#d8b25a" stroke="#1b1206" stroke-width="1.2"/>' +
  '<path d="M-7.6 -3.2 L17 -3.2 L25 0 L17 3.2 L-7.6 3.2 Z" fill="#eef3f6" stroke="#10151a" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path d="M-6 0 L16 0" stroke="#8fa3b0" stroke-width="1.1"/>';

const frame = (inner: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">' +
  '<defs><radialGradient id="face-bg" cx="50%" cy="38%" r="72%"><stop offset="0" stop-color="#2a3440"/>' +
  '<stop offset="1" stop-color="#07090c"/></radialGradient></defs>' +
  '<rect width="64" height="64" rx="7" fill="url(#face-bg)"/>' +
  inner +
  '<rect x="1" y="1" width="62" height="62" rx="6.5" fill="none" stroke="var(--face-tint, #9fdcff)" stroke-opacity=".45" stroke-width="2"/>' +
  '</svg>';

/**
 * A horizontal cut seen from above: the blade lies flat, the crescent it drew runs across the top
 * of the card, thin where it started and full where the blade is now.
 */
const horizontal = (mirror: boolean) =>
  frame(
    `<g transform="translate(32 0) scale(${mirror ? -1 : 1} 1) translate(-32 0)">` +
      // The sweep: from the right edge round to the left, where the blade arrives.
      '<path d="M54 40 C52 18 30 10 9 24 C27 17 44 22 50 40 Z" fill="var(--face-tint, #9fdcff)" opacity=".9"/>' +
      '<path d="M54 40 C52 18 30 10 9 24" fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="1.4"/>' +
      // Speed lines behind the leading end.
      '<path d="M16 30 L6 32 M19 35 L9 38" stroke="var(--face-tint, #9fdcff)" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>' +
      `<g transform="translate(31 45) rotate(186)">${SWORD}</g>` +
    '</g>',
  );

/**
 * The descending cut: the blade brought down from over the shoulder, diagonally, onto the ground:
 * a streak along its path and the crack where it lands.
 */
const descending = frame(
  // The streak it leaves, from high on the right to the ground on the left.
  '<path d="M52 6 C44 20 30 36 12 54 C26 34 40 22 58 12 Z" fill="var(--face-tint, #9fdcff)" opacity=".9"/>' +
    '<path d="M52 6 C44 20 30 36 12 54" fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="1.4"/>' +
    // The ground, cracked where the blow lands.
    '<path d="M4 57 L60 57" stroke="#6c7a86" stroke-width="1.6" opacity=".7"/>' +
    '<path d="M12 57 L8 50 M12 57 L18 50 M12 57 L6 61 M12 57 L20 61" stroke="var(--face-tint, #9fdcff)" stroke-width="1.8" stroke-linecap="round"/>' +
    `<g transform="translate(33 32) rotate(128)">${SWORD}</g>`,
);

/** Each chain's faces, one per step, in order. */
const FACES: Partial<Record<SkillId, readonly string[]>> = {
  'guardian.sword': [horizontal(false), horizontal(true), descending],
};

export const hasFaces = (id: SkillId | undefined): id is SkillId => !!id && !!FACES[id];

/** Which step of its chain the skill's next use is: the one a hold is charging, or a press would throw. */
export const pendingStep = (p: Pick<Player, 'combo'>, id: SkillId) => p.combo % KIT[id].chain;

/** The face of the step that comes next. */
export const faceOf = (p: Pick<Player, 'combo'>, id: SkillId) => FACES[id]![pendingStep(p, id)];

/**
 * The colour of what comes next: the charge tier it has reached while held, violet while awake, the
 * lightning of the blade at rest.
 */
export function faceTint(p: Pick<Player, 'chargeSkill' | 'chargeT' | 'empowered'>, id: SkillId) {
  const tint = p.chargeSkill === id ? chargeTier(KIT[id].charge, p.chargeT).tier.tint : undefined;
  if (tint) return WAVE_COLORS[tint].glow;
  return p.empowered === 'awaken' ? WAVE_COLORS.violet.glow : WAVE_COLORS.lightning.glow;
}

/** Puts the face of the coming step on an icon holder, redrawing only when the step changes. */
export function showFace(holder: HTMLElement, p: Player, id: SkillId) {
  const step = String(pendingStep(p, id));
  if (holder.dataset.face !== step) {
    holder.dataset.face = step;
    holder.innerHTML = faceOf(p, id);
  }
  holder.style.setProperty('--face-tint', faceTint(p, id));
}
