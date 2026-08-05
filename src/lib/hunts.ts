// HUNTS — pure logic. No database, no React, no browser APIs.
//
// Everything here is a plain function over plain data, for the same reason `tour-graph.ts` is: the
// interesting parts (is this hunt completable? is this key unobtainable? is the visitor close
// enough?) are exactly the parts that must be unit-testable without a DB or a device.
//
// See src/db/schema/hunts.ts for the data model and plans/future/16-hunt-builder-and-geo-map-layer.md
// for why this exists.

export type UnlockKind = "open" | "answer" | "keys" | "geo";

export interface HuntStopInput {
  id: string;
  sortOrder: number;
  title: string;
  unlockKind: UnlockKind;
  answers?: string[] | null;
  requiredKeys?: string[] | null;
  grantsKey?: string | null;
  unlockRadiusM: number;
  /** From the stop's scene. Null when the scene has no real-world position. */
  geoLat?: number | null;
  geoLng?: number | null;
}

export interface Coords {
  lat: number;
  lng: number;
}

// ── Geometry ───────────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_008.8; // IUGG mean radius

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than a planar approximation: the error of a flat-earth shortcut is negligible at
 * hunt distances, but this function is also what a future map layer will use for "stops near me",
 * and picking the correct formula once is cheaper than discovering the limit later.
 */
export function haversineMeters(a: Coords, b: Coords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Is the visitor inside the stop's unlock radius?
 *
 * `accuracyM` is the browser's own estimate of how wrong it might be, and it is USED, not ignored:
 * the effective radius grows by the reported accuracy. Standing 45m from a 40m stop with ±30m
 * accuracy counts, because the device genuinely cannot tell the difference and refusing to unlock
 * would strand a visitor who is, in fact, standing right there. Erring toward unlocking is the right
 * bias for a game; it would be the wrong bias for access control, which is why keys are explicitly
 * not access control (see the schema note on scene_links.requiresKeys).
 */
export function isWithinRadius(
  stop: Pick<HuntStopInput, "geoLat" | "geoLng" | "unlockRadiusM">,
  position: Coords,
  accuracyM = 0,
): boolean {
  if (stop.geoLat == null || stop.geoLng == null) return false;
  const d = haversineMeters({ lat: stop.geoLat, lng: stop.geoLng }, position);
  return d <= stop.unlockRadiusM + Math.max(0, accuracyM);
}

// ── Answers ────────────────────────────────────────────────────────────────────────────────────

/**
 * Normalize an answer for comparison: trim, collapse inner whitespace, lowercase, and strip accents.
 * Deliberately the same forgiveness the LMS exercise grader applies, because a visitor who typed the
 * right answer with a stray capital has answered the question.
 */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function answerMatches(given: string, accepted: string[] | null | undefined): boolean {
  if (!accepted || accepted.length === 0) return false;
  const g = normalizeAnswer(given);
  if (g === "") return false;
  return accepted.some((a) => normalizeAnswer(a) === g);
}

// ── Keys ───────────────────────────────────────────────────────────────────────────────────────

export function holdsAllKeys(held: readonly string[], required: string[] | null | undefined): boolean {
  if (!required || required.length === 0) return true;
  const set = new Set(held);
  return required.every((k) => set.has(k));
}

// ── Progress ───────────────────────────────────────────────────────────────────────────────────

export interface HuntRunState {
  /** Stop ids already unlocked. */
  unlocked: readonly string[];
  /** Keys the visitor holds, from hotspots opened and stops completed. */
  keys: readonly string[];
  /** Latest device position, or null if unavailable/denied. NEVER sent to the server. */
  position?: Coords | null;
  accuracyM?: number | null;
}

export type StopAvailability =
  | { state: "done" }
  | { state: "locked"; reason: "sequence" }
  | { state: "ready" }
  | { state: "needs-answer" }
  | { state: "needs-keys"; missing: string[] }
  | { state: "needs-position" }
  | { state: "too-far"; metres: number }
  | { state: "unplaced" };

/**
 * What the visitor can do at each stop right now.
 *
 * Stops are sequential: a stop is not offered until the one before it is done. That is a deliberate
 * simplification over an arbitrary dependency graph — a hunt is a walk with an order, and creators
 * building their first one should not have to think in graphs. The keys mechanic is the escape hatch
 * for anyone who wants non-linear structure.
 */
export function evaluateStops(
  stops: readonly HuntStopInput[],
  state: HuntRunState,
): Map<string, StopAvailability> {
  const ordered = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const done = new Set(state.unlocked);
  const out = new Map<string, StopAvailability>();
  let previousDone = true;

  for (const stop of ordered) {
    if (done.has(stop.id)) {
      out.set(stop.id, { state: "done" });
      previousDone = true;
      continue;
    }
    if (!previousDone) {
      out.set(stop.id, { state: "locked", reason: "sequence" });
      continue;
    }
    previousDone = false;

    switch (stop.unlockKind) {
      case "open":
        out.set(stop.id, { state: "ready" });
        break;
      case "answer":
        out.set(stop.id, { state: "needs-answer" });
        break;
      case "keys": {
        const held = new Set(state.keys);
        const missing = (stop.requiredKeys ?? []).filter((k) => !held.has(k));
        out.set(stop.id, missing.length === 0 ? { state: "ready" } : { state: "needs-keys", missing });
        break;
      }
      case "geo": {
        if (stop.geoLat == null || stop.geoLng == null) {
          // The creator marked it "be there" but never said where. The health check below catches
          // this at authoring time; here we surface it rather than silently locking the visitor out.
          out.set(stop.id, { state: "unplaced" });
          break;
        }
        if (!state.position) {
          out.set(stop.id, { state: "needs-position" });
          break;
        }
        if (isWithinRadius(stop, state.position, state.accuracyM ?? 0)) {
          out.set(stop.id, { state: "ready" });
        } else {
          const metres = haversineMeters({ lat: stop.geoLat, lng: stop.geoLng }, state.position);
          out.set(stop.id, { state: "too-far", metres: Math.round(metres) });
        }
        break;
      }
    }
  }
  return out;
}

/** Keys the visitor holds after completing a set of stops, plus any earned from hotspots. */
export function keysAfter(
  stops: readonly HuntStopInput[],
  unlockedStopIds: readonly string[],
  hotspotKeys: readonly string[] = [],
): string[] {
  const done = new Set(unlockedStopIds);
  const keys = new Set<string>(hotspotKeys);
  for (const s of stops) if (done.has(s.id) && s.grantsKey) keys.add(s.grantsKey);
  return [...keys];
}

// ── Authoring health checks ────────────────────────────────────────────────────────────────────
//
// The analogue of plan 08's orphan/dead-end detection on the connections editor, and the reason a
// museum educator can finish a hunt without a developer. Every problem here is one that produces a
// hunt which LOOKS fine in the editor and strands a visitor in the field, where nobody can fix it.

export type HuntProblemLevel = "error" | "warning";

export interface HuntProblem {
  level: HuntProblemLevel;
  code:
    | "no-stops"
    | "geo-stop-unplaced"
    | "answer-stop-no-answers"
    | "keys-stop-no-keys"
    | "unobtainable-key"
    | "onsite-no-fallback"
    | "tiny-radius"
    | "duplicate-scene";
  message: string;
  stopId?: string;
}

export interface HuntHealthInput {
  allowRemoteFallback: boolean;
  stops: readonly (HuntStopInput & { sceneId: string })[];
  /** Keys granted by hotspots anywhere in this destination. */
  hotspotKeys?: readonly string[];
}

/**
 * Everything wrong with a hunt, worst first.
 *
 * `error` = a visitor cannot finish. `warning` = it will work but probably not as intended.
 */
export function analyzeHunt(input: HuntHealthInput): HuntProblem[] {
  const problems: HuntProblem[] = [];
  const stops = [...input.stops].sort((a, b) => a.sortOrder - b.sortOrder);

  if (stops.length === 0) {
    return [{ level: "error", code: "no-stops", message: "This hunt has no stops yet." }];
  }

  // Keys available at each point: granted by an EARLIER stop, or by any hotspot in the destination.
  const grantedSoFar = new Set<string>(input.hotspotKeys ?? []);
  const seenScenes = new Set<string>();

  for (const stop of stops) {
    if (seenScenes.has(stop.sceneId)) {
      problems.push({
        level: "warning",
        code: "duplicate-scene",
        stopId: stop.id,
        message: `"${stop.title}" reuses a scene an earlier stop already used. That is allowed, but visitors often read it as a bug.`,
      });
    }
    seenScenes.add(stop.sceneId);

    if (stop.unlockKind === "geo") {
      if (stop.geoLat == null || stop.geoLng == null) {
        problems.push({
          level: "error",
          code: "geo-stop-unplaced",
          stopId: stop.id,
          message: `"${stop.title}" unlocks by arriving somewhere, but its scene has no real-world position. Nobody can unlock it.`,
        });
      }
      if (stop.unlockRadiusM < 25) {
        problems.push({
          level: "warning",
          code: "tiny-radius",
          stopId: stop.id,
          message: `"${stop.title}" has a ${stop.unlockRadiusM}m radius. Phone GPS is routinely off by 5-20m and worse between tall buildings, so a radius this small will fail for visitors who are standing in the right place.`,
        });
      }
      if (!input.allowRemoteFallback) {
        problems.push({
          level: "warning",
          code: "onsite-no-fallback",
          stopId: stop.id,
          message: `"${stop.title}" requires being there and this hunt has no remote fallback, so it cannot be completed by anyone who cannot travel to it.`,
        });
      }
    }

    if (stop.unlockKind === "answer" && (stop.answers ?? []).length === 0) {
      problems.push({
        level: "error",
        code: "answer-stop-no-answers",
        stopId: stop.id,
        message: `"${stop.title}" asks for an answer but no accepted answer is set, so nothing a visitor types can be right.`,
      });
    }

    if (stop.unlockKind === "keys") {
      const required = stop.requiredKeys ?? [];
      if (required.length === 0) {
        problems.push({
          level: "error",
          code: "keys-stop-no-keys",
          stopId: stop.id,
          message: `"${stop.title}" unlocks with keys but lists none.`,
        });
      }
      for (const k of required) {
        if (!grantedSoFar.has(k)) {
          problems.push({
            level: "error",
            code: "unobtainable-key",
            stopId: stop.id,
            message: `"${stop.title}" needs the key "${k}", which nothing before it grants. The hunt cannot be finished.`,
          });
        }
      }
    }

    if (stop.grantsKey) grantedSoFar.add(stop.grantsKey);
  }

  return problems.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
}

/** True when a hunt has at least one geo-gated stop, which is what makes it an on-site hunt. */
export function deriveMode(stops: readonly Pick<HuntStopInput, "unlockKind">[]): "virtual" | "onsite" {
  return stops.some((s) => s.unlockKind === "geo") ? "onsite" : "virtual";
}
