import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRateLimitForTests,
  ATTRIBUTION,
  cacheKeyFor,
  parseNominatimResponse,
  searchPlaces,
  type Place,
} from "./nominatim";

/**
 * These guard POLICY compliance, not just correctness. Nominatim's terms are
 * binding on us — exceeding one request per second, skipping the cache, or
 * sending a default User-Agent are violations, not performance bugs.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const row = (over: Record<string, unknown> = {}) => ({
  osm_id: 12345,
  display_name: "Elmina Castle, Komenda, Ghana",
  lat: "5.0847",
  lon: "-1.3489",
  ...over,
});

function harness(over: Partial<Parameters<typeof searchPlaces>[1]> = {}) {
  const cache = new Map<string, Place[]>();
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [row()],
  } as unknown as Response);
  return {
    cache,
    fetchImpl,
    deps: {
      now: () => 1_000_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cacheGet: async (k: string) => cache.get(k) ?? null,
      cacheSet: async (k: string, p: Place[]) => void cache.set(k, p),
      ...over,
    },
  };
}

beforeEach(() => __resetRateLimitForTests());

describe("parseNominatimResponse", () => {
  it("reads a well-formed row", () => {
    expect(parseNominatimResponse([row()])).toEqual([
      { osmId: "12345", displayName: "Elmina Castle, Komenda, Ghana", lat: 5.0847, lng: -1.3489 },
    ]);
  });

  it("drops a row with no coordinates rather than storing NaN", () => {
    // Number(undefined) is NaN, which does not throw — it would be stored and
    // render as a pin in the Atlantic.
    expect(parseNominatimResponse([row({ lat: undefined, lon: undefined })])).toEqual([]);
  });

  it("drops a row whose coordinates are not numeric", () => {
    expect(parseNominatimResponse([row({ lat: "not-a-number" })])).toEqual([]);
  });

  it("drops a row with no osm_id or no display_name", () => {
    expect(parseNominatimResponse([row({ osm_id: null })])).toEqual([]);
    expect(parseNominatimResponse([row({ display_name: null })])).toEqual([]);
  });

  it("survives a non-array body without throwing", () => {
    expect(parseNominatimResponse({ error: "nope" })).toEqual([]);
    expect(parseNominatimResponse(null)).toEqual([]);
  });
});

describe("cacheKeyFor", () => {
  it("collapses case and whitespace so the cache actually hits", () => {
    // Caching is a policy obligation; a key that misses on trivial variation
    // is a compliance problem, not just a slow path.
    expect(cacheKeyFor("  Elmina   Castle ")).toBe(cacheKeyFor("elmina castle"));
  });
});

describe("searchPlaces", () => {
  it("returns a cached result without calling Nominatim at all", async () => {
    const h = harness();
    h.cache.set("elmina castle", [
      { osmId: "1", displayName: "Elmina Castle", lat: 1, lng: 2 },
    ]);
    const res = await searchPlaces("Elmina Castle", h.deps);
    expect(res).toMatchObject({ ok: true, fromCache: true });
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  it("sends an identifying User-Agent — a library default would violate the policy", async () => {
    const h = harness();
    await searchPlaces("elmina", h.deps);
    const headers = h.fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/Wanderlust/);
    expect(headers["User-Agent"]).not.toMatch(/^node|^undici|^got/i);
  });

  it("refuses a second live request inside one second", async () => {
    const h = harness();
    await searchPlaces("first place", h.deps);
    const second = await searchPlaces("second place", h.deps);
    expect(second).toEqual({ ok: false, reason: "rate_limited" });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("allows the next request once a second has passed", async () => {
    const h = harness();
    await searchPlaces("first place", h.deps);
    const later = await searchPlaces("second place", { ...h.deps, now: () => 1_001_000 });
    expect(later).toMatchObject({ ok: true });
    expect(h.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("still serves a CACHED answer while rate-limited", async () => {
    // A cache hit costs Nominatim nothing. Refusing it because someone else
    // just searched would punish a visitor for a limit they are not using.
    const h = harness();
    await searchPlaces("first place", h.deps);
    h.cache.set("known", [{ osmId: "9", displayName: "Known", lat: 0, lng: 0 }]);
    const res = await searchPlaces("known", h.deps);
    expect(res).toMatchObject({ ok: true, fromCache: true });
  });

  it("caches an empty result so a misspelling is not retried forever", async () => {
    const h = harness({
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch,
    });
    await searchPlaces("qqqq", h.deps);
    expect(h.cache.get("qqqq")).toEqual([]);
  });

  it("rejects an empty query before touching the cache or the network", async () => {
    const h = harness();
    expect(await searchPlaces("   ", h.deps)).toEqual({ ok: false, reason: "empty_query" });
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  it("reports upstream failure instead of throwing", async () => {
    const h = harness({
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch,
    });
    expect(await searchPlaces("anything", h.deps)).toEqual({ ok: false, reason: "upstream_error" });
  });

  it("reports upstream failure when the request rejects (timeout, DNS)", async () => {
    const h = harness({
      fetchImpl: vi.fn().mockRejectedValue(new Error("aborted")) as unknown as typeof fetch,
    });
    expect(await searchPlaces("anything", h.deps)).toEqual({ ok: false, reason: "upstream_error" });
  });

  it("bounds the request with a timeout signal", async () => {
    const h = harness();
    await searchPlaces("elmina", h.deps);
    expect(h.fetchImpl.mock.calls[0]?.[1]).toHaveProperty("signal");
  });

  it("exports the ODbL attribution so no call site has to remember it", () => {
    expect(ATTRIBUTION).toMatch(/OpenStreetMap/);
  });
});
