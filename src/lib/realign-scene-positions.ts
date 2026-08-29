/**
 * Move every hotspot and link in a scene by the same offset, derived from one
 * the creator has re-placed by hand.
 *
 * THE PROBLEM THIS SOLVES. Replacing a scene's panorama keeps its hotspots and
 * link arrows at their old yaw/pitch. If the new photograph was taken from the
 * same spot but with the camera pointing elsewhere, every marker is wrong by
 * the SAME amount — so re-placing them one by one is repetitive work that a
 * single measurement can do instead. BAM's framing: set one, and the others
 * follow.
 *
 * IT IS A TRANSLATION, NOT A SCALE. Relative distances between markers are
 * preserved exactly. That is correct when the two photographs share a camera
 * position and differ only in heading, which is the ordinary re-shoot case. It
 * is NOT correct if the camera moved, or the lens changed the projection — no
 * rigid offset can fix those, and this function does not pretend to. Anything
 * that still looks wrong afterwards has to be placed by hand, which is the
 * pre-existing workflow rather than a regression.
 *
 * Units are RADIANS, matching what is stored (verified against production
 * rows: yaw ~0..2π, pitch ~-π/2..π/2) and what Photo Sphere Viewer expects.
 */

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;

export type Placement = { id: string; yaw: number; pitch: number };

export type RealignResult = {
  moved: (Placement & { pitchClamped: boolean })[];
  /**
   * How many markers hit the pole and could not take the full offset.
   *
   * Surfaced rather than swallowed: those are precisely the ones whose spacing
   * is no longer preserved, so the creator needs to know to check them.
   */
  clampedCount: number;
  delta: { yaw: number; pitch: number };
};

/**
 * Normalise a yaw into [0, 2π).
 *
 * Yaw is cyclic, so an offset that carries a marker past 2π must wrap rather
 * than grow without bound — a stored yaw of 7.5 would be rendered by PSV, but
 * every later comparison and the creator's own reading of the number would be
 * wrong.
 */
export function wrapYaw(yaw: number): number {
  const wrapped = yaw % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

/**
 * Clamp a pitch into [-π/2, π/2].
 *
 * Pitch is NOT cyclic: straight up is the end of the range, not a wrap point.
 * Letting it exceed π/2 would flip a marker to the opposite side of the sphere,
 * which reads as a marker teleporting rather than moving.
 */
export function clampPitch(pitch: number): number {
  return Math.min(HALF_PI, Math.max(-HALF_PI, pitch));
}

/**
 * The shortest signed angular distance from `from` to `to`, in [-π, π].
 *
 * Shortest-path matters: dragging a marker from 0.1 to 6.2 radians is a small
 * nudge backwards across the seam, not a near-full turn forwards. Taking the
 * naive difference would shove every other marker most of the way around the
 * sphere.
 */
export function shortestYawDelta(from: number, to: number): number {
  const raw = (to - from) % TWO_PI;
  if (raw > Math.PI) return raw - TWO_PI;
  if (raw < -Math.PI) return raw + TWO_PI;
  return raw;
}

export function realignByAnchor(input: {
  /** Where the anchor was, and where the creator put it. */
  anchor: { before: { yaw: number; pitch: number }; after: { yaw: number; pitch: number } };
  /** Everything in the scene, INCLUDING the anchor — it lands on `after`. */
  placements: readonly Placement[];
}): RealignResult {
  const delta = {
    yaw: shortestYawDelta(input.anchor.before.yaw, input.anchor.after.yaw),
    pitch: input.anchor.after.pitch - input.anchor.before.pitch,
  };

  const moved = input.placements.map((p) => {
    const rawPitch = p.pitch + delta.pitch;
    const pitch = clampPitch(rawPitch);
    return {
      id: p.id,
      yaw: wrapYaw(p.yaw + delta.yaw),
      pitch,
      // Compared against the raw value rather than the input: a marker already
      // sitting at the pole before the move has not been damaged by it.
      pitchClamped: Math.abs(rawPitch - pitch) > 1e-9,
    };
  });

  return {
    moved,
    clampedCount: moved.filter((m) => m.pitchClamped).length,
    delta,
  };
}
