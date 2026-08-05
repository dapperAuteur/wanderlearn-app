import { describe, expect, it } from "vitest";
import {
  analyzeHunt,
  answerMatches,
  deriveMode,
  evaluateStops,
  haversineMeters,
  holdsAllKeys,
  isWithinRadius,
  keysAfter,
  normalizeAnswer,
  type HuntStopInput,
} from "./hunts";

function stop(over: Partial<HuntStopInput> & { id: string; sortOrder: number }): HuntStopInput {
  return {
    title: `Stop ${over.sortOrder}`,
    unlockKind: "open",
    unlockRadiusM: 40,
    ...over,
  };
}

describe("haversineMeters", () => {
  it("is zero for the same point", () => {
    expect(haversineMeters({ lat: 39.77, lng: -86.16 }, { lat: 39.77, lng: -86.16 })).toBe(0);
  });

  it("matches a known short distance", () => {
    // One degree of latitude is ~111.2km; a thousandth of a degree is ~111m.
    const d = haversineMeters({ lat: 39.77, lng: -86.16 }, { lat: 39.771, lng: -86.16 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });

  it("is symmetric", () => {
    const a = { lat: 39.77, lng: -86.16 };
    const b = { lat: 39.78, lng: -86.15 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe("isWithinRadius", () => {
  const here = { lat: 39.77, lng: -86.16 };

  it("is false when the stop has no position", () => {
    expect(isWithinRadius({ geoLat: null, geoLng: null, unlockRadiusM: 40 }, here)).toBe(false);
  });

  it("unlocks inside the radius", () => {
    expect(isWithinRadius({ geoLat: 39.77, geoLng: -86.16, unlockRadiusM: 40 }, here)).toBe(true);
  });

  it("does not unlock well outside it", () => {
    expect(isWithinRadius({ geoLat: 39.775, geoLng: -86.16, unlockRadiusM: 40 }, here)).toBe(false);
  });

  it("widens the radius by the device's own reported accuracy", () => {
    // ~111m away: outside a 40m radius, but inside 40m + 100m of reported error. A visitor standing
    // in the right place on a bad GPS fix must not be locked out.
    const far = { geoLat: 39.771, geoLng: -86.16, unlockRadiusM: 40 };
    expect(isWithinRadius(far, here, 0)).toBe(false);
    expect(isWithinRadius(far, here, 100)).toBe(true);
  });

  it("ignores a negative accuracy rather than shrinking the radius", () => {
    const s = { geoLat: 39.77, geoLng: -86.16, unlockRadiusM: 40 };
    expect(isWithinRadius(s, here, -1000)).toBe(true);
  });
});

describe("normalizeAnswer / answerMatches", () => {
  it("forgives case, padding, inner whitespace and accents", () => {
    expect(normalizeAnswer("  Café   Noir ")).toBe("cafe noir");
  });

  it("matches any accepted variant", () => {
    expect(answerMatches("Lorraine Motel", ["the lorraine motel", "lorraine motel"])).toBe(true);
  });

  it("rejects an empty answer even when an empty variant was configured", () => {
    expect(answerMatches("   ", ["", "x"])).toBe(false);
  });

  it("rejects when nothing is configured", () => {
    expect(answerMatches("anything", null)).toBe(false);
    expect(answerMatches("anything", [])).toBe(false);
  });
});

describe("holdsAllKeys", () => {
  it("is true when nothing is required", () => {
    expect(holdsAllKeys([], null)).toBe(true);
    expect(holdsAllKeys([], [])).toBe(true);
  });

  it("requires every key, not just one", () => {
    expect(holdsAllKeys(["a"], ["a", "b"])).toBe(false);
    expect(holdsAllKeys(["a", "b"], ["a", "b"])).toBe(true);
  });
});

describe("evaluateStops", () => {
  const stops = [
    stop({ id: "s1", sortOrder: 1 }),
    stop({ id: "s2", sortOrder: 2, unlockKind: "answer", answers: ["yes"] }),
    stop({ id: "s3", sortOrder: 3, unlockKind: "geo", geoLat: 39.77, geoLng: -86.16 }),
  ];

  it("offers only the first stop at the start", () => {
    const r = evaluateStops(stops, { unlocked: [], keys: [] });
    expect(r.get("s1")).toEqual({ state: "ready" });
    expect(r.get("s2")).toEqual({ state: "locked", reason: "sequence" });
    expect(r.get("s3")).toEqual({ state: "locked", reason: "sequence" });
  });

  it("advances one stop at a time", () => {
    const r = evaluateStops(stops, { unlocked: ["s1"], keys: [] });
    expect(r.get("s1")).toEqual({ state: "done" });
    expect(r.get("s2")).toEqual({ state: "needs-answer" });
    expect(r.get("s3")).toEqual({ state: "locked", reason: "sequence" });
  });

  it("asks for a position before it can judge distance", () => {
    const r = evaluateStops(stops, { unlocked: ["s1", "s2"], keys: [], position: null });
    expect(r.get("s3")).toEqual({ state: "needs-position" });
  });

  it("reports how far away the visitor is", () => {
    const r = evaluateStops(stops, {
      unlocked: ["s1", "s2"],
      keys: [],
      position: { lat: 39.775, lng: -86.16 },
    });
    const s3 = r.get("s3");
    expect(s3?.state).toBe("too-far");
    if (s3?.state === "too-far") expect(s3.metres).toBeGreaterThan(400);
  });

  it("unlocks a geo stop when the visitor arrives", () => {
    const r = evaluateStops(stops, {
      unlocked: ["s1", "s2"],
      keys: [],
      position: { lat: 39.77, lng: -86.16 },
    });
    expect(r.get("s3")).toEqual({ state: "ready" });
  });

  it("names the missing keys rather than just refusing", () => {
    const keyed = [stop({ id: "k1", sortOrder: 1, unlockKind: "keys", requiredKeys: ["red", "blue"] })];
    const r = evaluateStops(keyed, { unlocked: [], keys: ["red"] });
    expect(r.get("k1")).toEqual({ state: "needs-keys", missing: ["blue"] });
  });

  it("surfaces a geo stop whose scene was never placed", () => {
    const bad = [stop({ id: "b1", sortOrder: 1, unlockKind: "geo" })];
    const r = evaluateStops(bad, { unlocked: [], keys: [], position: { lat: 1, lng: 1 } });
    expect(r.get("b1")).toEqual({ state: "unplaced" });
  });

  it("does not depend on the input array being pre-sorted", () => {
    const shuffled = [stops[2], stops[0], stops[1]];
    const r = evaluateStops(shuffled, { unlocked: [], keys: [] });
    expect(r.get("s1")).toEqual({ state: "ready" });
    expect(r.get("s3")).toEqual({ state: "locked", reason: "sequence" });
  });
});

describe("keysAfter", () => {
  it("collects keys from completed stops and hotspots, without duplicates", () => {
    const stops = [
      stop({ id: "s1", sortOrder: 1, grantsKey: "red" }),
      stop({ id: "s2", sortOrder: 2, grantsKey: "blue" }),
    ];
    expect(keysAfter(stops, ["s1"], ["red", "green"]).sort()).toEqual(["green", "red"]);
    expect(keysAfter(stops, ["s1", "s2"]).sort()).toEqual(["blue", "red"]);
  });
});

describe("analyzeHunt", () => {
  it("flags an empty hunt", () => {
    const p = analyzeHunt({ allowRemoteFallback: true, stops: [] });
    expect(p).toHaveLength(1);
    expect(p[0].code).toBe("no-stops");
  });

  it("flags a geo stop whose scene has no position, as an error", () => {
    const p = analyzeHunt({
      allowRemoteFallback: true,
      stops: [{ ...stop({ id: "a", sortOrder: 1, unlockKind: "geo" }), sceneId: "sc1" }],
    });
    expect(p.some((x) => x.code === "geo-stop-unplaced" && x.level === "error")).toBe(true);
  });

  it("flags an answer stop with no accepted answers", () => {
    const p = analyzeHunt({
      allowRemoteFallback: true,
      stops: [{ ...stop({ id: "a", sortOrder: 1, unlockKind: "answer" }), sceneId: "sc1" }],
    });
    expect(p.some((x) => x.code === "answer-stop-no-answers" && x.level === "error")).toBe(true);
  });

  it("catches a key nothing grants, which is the unfinishable-hunt case", () => {
    const p = analyzeHunt({
      allowRemoteFallback: true,
      stops: [
        { ...stop({ id: "a", sortOrder: 1 }), sceneId: "sc1" },
        {
          ...stop({ id: "b", sortOrder: 2, unlockKind: "keys", requiredKeys: ["vault"] }),
          sceneId: "sc2",
        },
      ],
    });
    expect(p.some((x) => x.code === "unobtainable-key")).toBe(true);
  });

  it("accepts a key granted by an EARLIER stop", () => {
    const p = analyzeHunt({
      allowRemoteFallback: true,
      stops: [
        { ...stop({ id: "a", sortOrder: 1, grantsKey: "vault" }), sceneId: "sc1" },
        {
          ...stop({ id: "b", sortOrder: 2, unlockKind: "keys", requiredKeys: ["vault"] }),
          sceneId: "sc2",
        },
      ],
    });
    expect(p.some((x) => x.code === "unobtainable-key")).toBe(false);
  });

  it("rejects a key granted only LATER, because order is what makes it obtainable", () => {
    const p = analyzeHunt({
      allowRemoteFallback: true,
      stops: [
        {
          ...stop({ id: "a", sortOrder: 1, unlockKind: "keys", requiredKeys: ["vault"] }),
          sceneId: "sc1",
        },
        { ...stop({ id: "b", sortOrder: 2, grantsKey: "vault" }), sceneId: "sc2" },
      ],
    });
    expect(p.some((x) => x.code === "unobtainable-key")).toBe(true);
  });

  it("accepts a key granted by a hotspot anywhere in the destination", () => {
    const p = analyzeHunt({
      allowRemoteFallback: true,
      hotspotKeys: ["vault"],
      stops: [
        {
          ...stop({ id: "a", sortOrder: 1, unlockKind: "keys", requiredKeys: ["vault"] }),
          sceneId: "sc1",
        },
      ],
    });
    expect(p.some((x) => x.code === "unobtainable-key")).toBe(false);
  });

  it("warns about a radius smaller than GPS can resolve", () => {
    const p = analyzeHunt({
      allowRemoteFallback: true,
      stops: [
        {
          ...stop({ id: "a", sortOrder: 1, unlockKind: "geo", geoLat: 1, geoLng: 1, unlockRadiusM: 10 }),
          sceneId: "sc1",
        },
      ],
    });
    expect(p.some((x) => x.code === "tiny-radius" && x.level === "warning")).toBe(true);
  });

  it("warns when an on-site hunt has no remote fallback", () => {
    const p = analyzeHunt({
      allowRemoteFallback: false,
      stops: [
        {
          ...stop({ id: "a", sortOrder: 1, unlockKind: "geo", geoLat: 1, geoLng: 1 }),
          sceneId: "sc1",
        },
      ],
    });
    expect(p.some((x) => x.code === "onsite-no-fallback")).toBe(true);
  });

  it("puts errors before warnings", () => {
    const p = analyzeHunt({
      allowRemoteFallback: false,
      stops: [
        {
          ...stop({ id: "a", sortOrder: 1, unlockKind: "geo", unlockRadiusM: 5 }),
          sceneId: "sc1",
        },
      ],
    });
    expect(p[0].level).toBe("error");
    expect(p.at(-1)?.level).toBe("warning");
  });

  it("reports nothing for a healthy hunt", () => {
    const p = analyzeHunt({
      allowRemoteFallback: true,
      stops: [
        { ...stop({ id: "a", sortOrder: 1, grantsKey: "vault" }), sceneId: "sc1" },
        {
          ...stop({ id: "b", sortOrder: 2, unlockKind: "answer", answers: ["yes"] }),
          sceneId: "sc2",
        },
        {
          ...stop({ id: "c", sortOrder: 3, unlockKind: "keys", requiredKeys: ["vault"] }),
          sceneId: "sc3",
        },
      ],
    });
    expect(p).toEqual([]);
  });
});

describe("deriveMode", () => {
  it("is onsite when any stop needs the visitor to be there", () => {
    expect(deriveMode([{ unlockKind: "open" }, { unlockKind: "geo" }])).toBe("onsite");
  });

  it("is virtual otherwise", () => {
    expect(deriveMode([{ unlockKind: "open" }, { unlockKind: "answer" }])).toBe("virtual");
  });
});
