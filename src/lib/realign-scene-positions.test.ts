import { describe, expect, it } from "vitest";
import {
  clampPitch,
  realignByAnchor,
  shortestYawDelta,
  wrapYaw,
} from "./realign-scene-positions";

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;

describe("wrapYaw", () => {
  it("wraps past a full turn instead of growing without bound", () => {
    expect(wrapYaw(TWO_PI + 0.5)).toBeCloseTo(0.5, 10);
  });

  it("wraps negatives into the positive range", () => {
    expect(wrapYaw(-0.5)).toBeCloseTo(TWO_PI - 0.5, 10);
  });

  it("leaves an in-range value alone", () => {
    expect(wrapYaw(3)).toBeCloseTo(3, 10);
  });
});

describe("clampPitch", () => {
  it("stops at the pole rather than flipping to the far side", () => {
    // Pitch is not cyclic. Wrapping it would read as a marker teleporting.
    expect(clampPitch(HALF_PI + 1)).toBeCloseTo(HALF_PI, 10);
    expect(clampPitch(-HALF_PI - 1)).toBeCloseTo(-HALF_PI, 10);
  });
});

describe("shortestYawDelta", () => {
  it("takes the short way across the seam", () => {
    // 6.2 -> 0.1 is a small nudge forwards, not a near-full turn backwards.
    const d = shortestYawDelta(6.2, 0.1);
    expect(d).toBeGreaterThan(0);
    expect(Math.abs(d)).toBeLessThan(0.5);
  });

  it("takes the short way in the other direction too", () => {
    const d = shortestYawDelta(0.1, 6.2);
    expect(d).toBeLessThan(0);
    expect(Math.abs(d)).toBeLessThan(0.5);
  });

  it("is a plain difference when no seam is involved", () => {
    expect(shortestYawDelta(1, 1.5)).toBeCloseTo(0.5, 10);
  });
});

describe("realignByAnchor", () => {
  const placements = [
    { id: "anchor", yaw: 1.0, pitch: 0.0 },
    { id: "b", yaw: 2.0, pitch: 0.2 },
    { id: "c", yaw: 3.0, pitch: -0.1 },
  ];

  it("lands the anchor exactly where the creator put it", () => {
    const r = realignByAnchor({
      anchor: { before: { yaw: 1.0, pitch: 0.0 }, after: { yaw: 1.5, pitch: 0.1 } },
      placements,
    });
    const a = r.moved.find((m) => m.id === "anchor")!;
    expect(a.yaw).toBeCloseTo(1.5, 10);
    expect(a.pitch).toBeCloseTo(0.1, 10);
  });

  it("preserves the spacing between every pair", () => {
    // The whole promise of the feature: relative geometry is untouched.
    const r = realignByAnchor({
      anchor: { before: { yaw: 1.0, pitch: 0.0 }, after: { yaw: 1.5, pitch: 0.1 } },
      placements,
    });
    const b = r.moved.find((m) => m.id === "b")!;
    const c = r.moved.find((m) => m.id === "c")!;
    expect(shortestYawDelta(b.yaw, c.yaw)).toBeCloseTo(1.0, 10);
    expect(c.pitch - b.pitch).toBeCloseTo(-0.3, 10);
  });

  it("moves everything by the same offset, not proportionally to position", () => {
    // A scale would move distant markers further. It must not.
    const r = realignByAnchor({
      anchor: { before: { yaw: 1.0, pitch: 0 }, after: { yaw: 1.5, pitch: 0 } },
      placements,
    });
    for (const m of r.moved) {
      const original = placements.find((p) => p.id === m.id)!;
      expect(shortestYawDelta(original.yaw, m.yaw)).toBeCloseTo(0.5, 10);
    }
  });

  it("wraps markers that cross the seam", () => {
    const r = realignByAnchor({
      anchor: { before: { yaw: 0, pitch: 0 }, after: { yaw: 0.2, pitch: 0 } },
      placements: [{ id: "edge", yaw: TWO_PI - 0.1, pitch: 0 }],
    });
    expect(r.moved[0]!.yaw).toBeCloseTo(0.1, 10);
  });

  it("takes the short way round rather than dragging everything backwards", () => {
    // Anchor nudged across the seam: a naive difference would be ~-6.1 rad and
    // would shove every other marker most of the way round the sphere.
    const r = realignByAnchor({
      anchor: { before: { yaw: 6.2, pitch: 0 }, after: { yaw: 0.1, pitch: 0 } },
      placements: [{ id: "b", yaw: 3.0, pitch: 0 }],
    });
    expect(Math.abs(r.delta.yaw)).toBeLessThan(0.5);
    expect(r.moved[0]!.yaw).toBeCloseTo(3.0 + r.delta.yaw, 10);
  });

  it("clamps at the pole and REPORTS it, because spacing is then broken", () => {
    const r = realignByAnchor({
      anchor: { before: { yaw: 0, pitch: 0 }, after: { yaw: 0, pitch: 1.4 } },
      placements: [
        { id: "low", yaw: 0, pitch: 0 },
        { id: "high", yaw: 1, pitch: 1.0 },
      ],
    });
    expect(r.clampedCount).toBe(1);
    expect(r.moved.find((m) => m.id === "high")!.pitchClamped).toBe(true);
    expect(r.moved.find((m) => m.id === "high")!.pitch).toBeCloseTo(HALF_PI, 10);
  });

  it("does not flag a marker that was already at the pole and did not move", () => {
    // It was not damaged by this operation, so warning about it is noise.
    const r = realignByAnchor({
      anchor: { before: { yaw: 0, pitch: 0 }, after: { yaw: 0.3, pitch: 0 } },
      placements: [{ id: "top", yaw: 0, pitch: HALF_PI }],
    });
    expect(r.clampedCount).toBe(0);
  });

  it("is a no-op when the anchor did not move", () => {
    const r = realignByAnchor({
      anchor: { before: { yaw: 1, pitch: 0.2 }, after: { yaw: 1, pitch: 0.2 } },
      placements,
    });
    for (const m of r.moved) {
      const original = placements.find((p) => p.id === m.id)!;
      expect(m.yaw).toBeCloseTo(original.yaw, 10);
      expect(m.pitch).toBeCloseTo(original.pitch, 10);
    }
    expect(r.clampedCount).toBe(0);
  });

  it("handles an empty scene without throwing", () => {
    const r = realignByAnchor({
      anchor: { before: { yaw: 0, pitch: 0 }, after: { yaw: 1, pitch: 0 } },
      placements: [],
    });
    expect(r.moved).toEqual([]);
  });
});
