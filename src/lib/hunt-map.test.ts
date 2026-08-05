import { describe, expect, it } from "vitest";
import {
  bearing,
  bearingWords,
  buildProjection,
  formatDistance,
  scaleBarFor,
} from "./hunt-map";

const INDY = { lat: 39.7684, lng: -86.1581 };

describe("buildProjection", () => {
  it("returns null with nothing to draw", () => {
    expect(buildProjection([])).toBeNull();
    expect(buildProjection([{ lat: NaN, lng: 0 }])).toBeNull();
  });

  it("fits every point inside the box", () => {
    const pts = [INDY, { lat: 39.78, lng: -86.14 }, { lat: 39.75, lng: -86.17 }];
    const p = buildProjection(pts, { width: 300, height: 300, pad: 20 })!;
    for (const pt of pts) {
      const { x, y } = p.project(pt);
      expect(x).toBeGreaterThanOrEqual(19.9);
      expect(x).toBeLessThanOrEqual(280.1);
      expect(y).toBeGreaterThanOrEqual(19.9);
      expect(y).toBeLessThanOrEqual(280.1);
    }
  });

  it("puts north up", () => {
    const p = buildProjection([INDY, { lat: 39.78, lng: -86.1581 }])!;
    const south = p.project(INDY);
    const north = p.project({ lat: 39.78, lng: -86.1581 });
    // SVG y grows downward, so the northern point must have the SMALLER y.
    expect(north.y).toBeLessThan(south.y);
  });

  it("puts east right", () => {
    const p = buildProjection([INDY, { lat: 39.7684, lng: -86.14 }])!;
    expect(p.project({ lat: 39.7684, lng: -86.14 }).x).toBeGreaterThan(p.project(INDY).x);
  });

  it("does not divide by zero on a single point", () => {
    const p = buildProjection([INDY], { width: 200, height: 200 })!;
    const { x, y } = p.project(INDY);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
    // Centred, give or take rounding.
    expect(x).toBeCloseTo(100, 0);
    expect(y).toBeCloseTo(100, 0);
  });

  it("does not divide by zero when every point is identical", () => {
    const p = buildProjection([INDY, INDY, INDY])!;
    expect(Number.isFinite(p.project(INDY).x)).toBe(true);
    expect(p.metresPerUnit).toBeGreaterThan(0);
  });

  it("uses one scale for both axes, so shapes are not distorted", () => {
    // A square in ground terms should stay square-ish on screen. At ~40N a degree of longitude is
    // about 0.77 of a degree of latitude, so this is the case a naive lat/lng-as-x/y map gets wrong.
    const dLat = 0.01;
    const dLng = 0.01 / Math.cos(39.7684 * (Math.PI / 180));
    const p = buildProjection(
      [INDY, { lat: INDY.lat + dLat, lng: INDY.lng }, { lat: INDY.lat, lng: INDY.lng + dLng }],
      { width: 400, height: 400, pad: 0 },
    )!;
    const o = p.project(INDY);
    const n = p.project({ lat: INDY.lat + dLat, lng: INDY.lng });
    const e = p.project({ lat: INDY.lat, lng: INDY.lng + dLng });
    const northLen = Math.abs(o.y - n.y);
    const eastLen = Math.abs(e.x - o.x);
    // Equal ground distances should render within a few percent of each other.
    expect(Math.abs(northLen - eastLen) / Math.max(northLen, eastLen)).toBeLessThan(0.05);
  });

  it("reports a positive ground scale", () => {
    const p = buildProjection([INDY, { lat: 39.78, lng: -86.14 }], { width: 300, height: 300 })!;
    expect(p.metresPerUnit).toBeGreaterThan(0);
    expect(Number.isFinite(p.metresPerUnit)).toBe(true);
  });
});

describe("scaleBarFor", () => {
  it("picks the largest round step that fits", () => {
    const p = buildProjection([INDY, { lat: 39.78, lng: -86.14 }], { width: 300, height: 300 })!;
    const bar = scaleBarFor(p, 100);
    expect(bar).not.toBeNull();
    expect(bar!.units).toBeLessThanOrEqual(100);
    expect(bar!.metres).toBeGreaterThan(0);
  });

  it("returns null when even the smallest step will not fit", () => {
    const p = buildProjection([INDY, { lat: 45, lng: -80 }], { width: 300, height: 300 })!;
    expect(scaleBarFor(p, 0.0001)).toBeNull();
  });
});

describe("formatDistance", () => {
  it("uses metres below a kilometre", () => {
    expect(formatDistance(450)).toBe("450 m");
    expect(formatDistance(0)).toBe("0 m");
  });
  it("uses one decimal in the single-digit kilometres", () => {
    expect(formatDistance(2340)).toBe("2.3 km");
  });
  it("drops the decimal for long distances", () => {
    expect(formatDistance(48_000)).toBe("48 km");
  });
  it("survives nonsense", () => {
    expect(formatDistance(NaN)).toBe("");
  });
});

describe("bearing", () => {
  it("is 0 due north", () => {
    expect(bearing(INDY, { lat: 39.9, lng: -86.1581 })).toBeCloseTo(0, 0);
  });
  it("is 90 due east", () => {
    expect(bearing(INDY, { lat: 39.7684, lng: -86.0 })).toBeCloseTo(90, 0);
  });
  it("is 180 due south", () => {
    expect(bearing(INDY, { lat: 39.6, lng: -86.1581 })).toBeCloseTo(180, 0);
  });
  it("is 270 due west", () => {
    expect(bearing(INDY, { lat: 39.7684, lng: -86.3 })).toBeCloseTo(270, 0);
  });
  it("always returns 0..360", () => {
    const b = bearing(INDY, { lat: 39.6, lng: -86.3 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe("bearingWords", () => {
  it("names the cardinals", () => {
    expect(bearingWords(0)).toBe("north");
    expect(bearingWords(90)).toBe("east");
    expect(bearingWords(180)).toBe("south");
    expect(bearingWords(270)).toBe("west");
  });
  it("names the intercardinals", () => {
    expect(bearingWords(45)).toBe("northeast");
    expect(bearingWords(225)).toBe("southwest");
  });
  it("wraps past 360 and below 0", () => {
    expect(bearingWords(360)).toBe("north");
    expect(bearingWords(-90)).toBe("west");
  });
});
