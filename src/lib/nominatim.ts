/**
 * Place lookup against Nominatim / OpenStreetMap.
 *
 * THE POLICY IS THE DESIGN. Checked against
 * https://operations.osmfoundation.org/policies/nominatim/ rather than assumed,
 * because three of its rules rule out the obvious implementation:
 *
 *   1. "Autocomplete is strictly forbidden... you must not implement such a
 *      service on the client side using the API." So the UI is
 *      search-on-submit — one request per deliberate press — not type-ahead.
 *   2. Absolute maximum of ONE request per second, globally. Not per visitor.
 *      That is why this is a server-side module with a shared gate rather than
 *      a fetch from the browser.
 *   3. "Results must be cached on your side." Mandatory, not advisory.
 *
 * Plus: a real identifying User-Agent (library defaults are explicitly
 * insufficient), and ODbL attribution displayed wherever the data appears —
 * exported here as ATTRIBUTION so no call site has to remember the wording.
 *
 * Wanderlust's primary function is not geocoding, so the public API is
 * legitimate use. If place search ever gets heavy, the upgrade path is
 * self-hosting or a commercial provider — both of which also permit
 * autocomplete, at which point rule 1 relaxes.
 */

export const ATTRIBUTION = "© OpenStreetMap contributors";

/** Required by the policy; a library default would be a violation. */
const USER_AGENT = "Wanderlust/1.0 (https://wanderlust.witus.online)";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

/** The policy's hard ceiling. One request per second, across everyone. */
export const MIN_REQUEST_INTERVAL_MS = 1000;

export type Place = {
  /** OSM's stable identifier for the place. Stored so we never re-query. */
  osmId: string;
  /** Nominatim's formatted name, e.g. "Elmina Castle, Komenda…, Ghana". */
  displayName: string;
  lat: number;
  lng: number;
};

export type LookupResult =
  | { ok: true; places: Place[]; fromCache: boolean }
  | { ok: false; reason: "rate_limited" | "upstream_error" | "empty_query" };

/**
 * Normalises a query for cache lookup.
 *
 * Case and surrounding whitespace should not produce a second upstream call
 * for the same place — caching is a policy obligation, so a cache that misses
 * on "Elmina Castle" vs "elmina castle " is a compliance problem, not just a
 * slow path.
 */
export function cacheKeyFor(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Shape Nominatim's JSON into ours, dropping anything unusable. */
export function parseNominatimResponse(body: unknown): Place[] {
  if (!Array.isArray(body)) return [];
  const places: Place[] = [];
  for (const row of body) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const osmId = r.osm_id === undefined || r.osm_id === null ? null : String(r.osm_id);
    const displayName = typeof r.display_name === "string" ? r.display_name : null;
    // Nominatim returns lat/lon as STRINGS. Number() on a missing value gives
    // NaN rather than throwing, so both are checked explicitly — a NaN
    // coordinate stored on a passport is a pin in the Atlantic.
    const lat = typeof r.lat === "string" ? Number(r.lat) : NaN;
    const lng = typeof r.lon === "string" ? Number(r.lon) : NaN;
    if (!osmId || !displayName || Number.isNaN(lat) || Number.isNaN(lng)) continue;
    places.push({ osmId, displayName, lat, lng });
  }
  return places;
}

/**
 * The shared once-per-second gate.
 *
 * Deliberately a module-level timestamp rather than a per-request one: the
 * limit is on the API as a whole, so two visitors searching at the same moment
 * must not each get their own allowance.
 *
 * Refuses rather than queues. A queue under load would hold requests open for
 * as long as the queue is deep and turn a rate limit into a hanging page; a
 * refusal is honest and the UI can say "try again in a second".
 */
let lastRequestAt = 0;

export function __resetRateLimitForTests(): void {
  lastRequestAt = 0;
}

export function mayRequestNow(now: number): boolean {
  return now - lastRequestAt >= MIN_REQUEST_INTERVAL_MS;
}

export function recordRequest(now: number): void {
  lastRequestAt = now;
}

export async function searchPlaces(
  query: string,
  deps: {
    now: () => number;
    fetchImpl: typeof fetch;
    cacheGet: (key: string) => Promise<Place[] | null>;
    cacheSet: (key: string, places: Place[]) => Promise<void>;
  },
): Promise<LookupResult> {
  const key = cacheKeyFor(query);
  if (!key) return { ok: false, reason: "empty_query" };

  // Cache first, ALWAYS — before the rate-limit check. A cached answer costs
  // Nominatim nothing, so refusing it because someone else just searched would
  // punish visitors for a limit they are not consuming.
  const cached = await deps.cacheGet(key);
  if (cached) return { ok: true, places: cached, fromCache: true };

  const now = deps.now();
  if (!mayRequestNow(now)) return { ok: false, reason: "rate_limited" };
  recordRequest(now);

  try {
    const url = `${ENDPOINT}?q=${encodeURIComponent(key)}&format=jsonv2&limit=8&addressdetails=0`;
    const res = await deps.fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, reason: "upstream_error" };
    const places = parseNominatimResponse(await res.json());
    // Cache even an empty result. A misspelling repeated ten times must not
    // become ten upstream calls.
    await deps.cacheSet(key, places);
    return { ok: true, places, fromCache: false };
  } catch {
    return { ok: false, reason: "upstream_error" };
  }
}
