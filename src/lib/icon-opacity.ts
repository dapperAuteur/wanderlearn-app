/**
 * How visible a tour's scene-link arrows and hotspot pins are.
 *
 * TWO LEVELS, like transition audio: the tour sets a default and a scene may
 * override it. A gallery with pale walls needs stronger arrows than a dim
 * interior, and that is a per-room judgement, not a per-tour one.
 *
 * THERE IS A FLOOR, AND IT IS NOT NEGOTIABLE.
 *
 * A scene-link arrow IS the way a visitor moves. At 0% it is invisible, the
 * link becomes untraversable, and the tour has a dead end that no warning
 * catches — precisely the failure the "not placed" warning exists to prevent,
 * reintroduced through a slider. So the value is clamped rather than trusted.
 *
 * Deliberately unlike the audio case, where silence IS a legitimate choice: a
 * quiet doorway is still a doorway, but an invisible arrow is not an arrow.
 * A creator who wants a link hidden should gate it with `requiresKeys` or
 * delete it — both of which say what they mean.
 */

/** Below this, an arrow stops being findable against a busy panorama. */
export const MIN_OPACITY_PERCENT = 25;
export const MAX_OPACITY_PERCENT = 100;
export const DEFAULT_OPACITY_PERCENT = 100;

/**
 * Clamp a stored or typed value into the usable range.
 *
 * Handles null (not set), out-of-range numbers, and NaN — which `Number("")`
 * produces and which would otherwise reach CSS as `opacity: NaN` and be
 * dropped silently, leaving the creator's change apparently ignored.
 */
export function clampOpacity(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (Number.isNaN(value)) return null;
  return Math.min(MAX_OPACITY_PERCENT, Math.max(MIN_OPACITY_PERCENT, Math.round(value)));
}

/**
 * The opacity to actually render with: the scene's if it set one, else the
 * tour's, else fully opaque.
 *
 * The specific beats the general, and both are clamped — a value that predates
 * the floor (or was written directly to the database) must not slip past it.
 */
export function resolveOpacityPercent(input: {
  scene: number | null | undefined;
  tour: number | null | undefined;
}): number {
  return (
    clampOpacity(input.scene) ?? clampOpacity(input.tour) ?? DEFAULT_OPACITY_PERCENT
  );
}

/** Percent → the 0..1 CSS/PSV wants. */
export function opacityToFraction(percent: number): number {
  return clampOpacity(percent)! / 100;
}
