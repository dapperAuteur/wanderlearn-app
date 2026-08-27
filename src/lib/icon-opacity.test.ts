import { describe, expect, it } from "vitest";
import {
  clampOpacity,
  MIN_OPACITY_PERCENT,
  opacityToFraction,
  resolveOpacityPercent,
} from "./icon-opacity";

describe("clampOpacity", () => {
  it("refuses to return anything below the floor", () => {
    // An arrow at 0% is invisible, which makes the link untraversable — the
    // exact failure the "not placed" warning exists to catch, reintroduced
    // through a slider.
    expect(clampOpacity(0)).toBe(MIN_OPACITY_PERCENT);
    expect(clampOpacity(5)).toBe(MIN_OPACITY_PERCENT);
    expect(clampOpacity(-40)).toBe(MIN_OPACITY_PERCENT);
  });

  it("caps at fully opaque", () => {
    expect(clampOpacity(140)).toBe(100);
  });

  it("passes a normal value through, rounded", () => {
    expect(clampOpacity(60)).toBe(60);
    expect(clampOpacity(60.4)).toBe(60);
  });

  it("returns null for unset rather than inventing a default", () => {
    // null has to stay distinguishable from a real value, or a scene could
    // never say "inherit the tour's".
    expect(clampOpacity(null)).toBeNull();
    expect(clampOpacity(undefined)).toBeNull();
  });

  it("returns null for NaN instead of letting it reach CSS", () => {
    // `opacity: NaN` is dropped silently by CSS, so the creator's change looks
    // ignored rather than wrong — the worst kind of failure to debug.
    // Number("abc") is NaN; note that Number("") is 0, not NaN, which is why
    // an empty input clamps to the floor instead (asserted below).
    expect(clampOpacity(Number("abc"))).toBeNull();
  });

  it("treats an empty input as zero, and therefore clamps it to the floor", () => {
    // Number("") === 0. An emptied slider must not produce an invisible arrow.
    expect(clampOpacity(Number(""))).toBe(MIN_OPACITY_PERCENT);
  });
});

describe("resolveOpacityPercent", () => {
  it("prefers the scene's value over the tour's", () => {
    expect(resolveOpacityPercent({ scene: 50, tour: 90 })).toBe(50);
  });

  it("falls back to the tour when the scene says nothing", () => {
    expect(resolveOpacityPercent({ scene: null, tour: 70 })).toBe(70);
  });

  it("is fully opaque when neither is set", () => {
    expect(resolveOpacityPercent({ scene: null, tour: null })).toBe(100);
  });

  it("clamps a bad TOUR value too, not just the scene's", () => {
    // Values can predate the floor, or be written straight to the database.
    expect(resolveOpacityPercent({ scene: null, tour: 0 })).toBe(MIN_OPACITY_PERCENT);
  });

  it("clamps a bad scene value rather than falling through to the tour", () => {
    // Falling through would silently ignore a deliberate (if unusable) choice
    // and show the tour default instead, which is harder to debug than a clamp.
    expect(resolveOpacityPercent({ scene: 1, tour: 90 })).toBe(MIN_OPACITY_PERCENT);
  });
});

describe("opacityToFraction", () => {
  it("converts percent to the 0..1 PSV and CSS want", () => {
    expect(opacityToFraction(100)).toBe(1);
    expect(opacityToFraction(50)).toBe(0.5);
  });

  it("never returns a fraction below the floor", () => {
    expect(opacityToFraction(0)).toBe(MIN_OPACITY_PERCENT / 100);
  });
});
