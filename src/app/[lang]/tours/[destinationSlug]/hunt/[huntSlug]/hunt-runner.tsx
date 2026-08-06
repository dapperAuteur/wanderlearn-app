"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { Coords, HuntStopInput } from "@/lib/hunts";
import { evaluateStops, keysAfter } from "@/lib/hunts";
import { recordHotspotFind, resetHuntProgress, unlockHuntStop } from "@/lib/actions/hunts";
import { TourWithCrossTour } from "@/components/virtual-tour/tour-with-cross-tour";
import type { CrossTourPreviewCardDict } from "@/components/virtual-tour/cross-tour-preview-card";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import type { Locale } from "@/lib/locales";
import { HuntMap, type HuntMapDict, type HuntMapStop } from "@/components/hunt/hunt-map";

// THE VISITOR RUNTIME, and the whole privacy design lives in this file.
//
// The device position is read here, compared to the stop's coordinates here, and never leaves the
// browser. `unlockHuntStop` has no latitude or longitude parameter — see its doc comment. What the
// server learns is "stop X opened", which is what progress requires and nothing more.
//
// Two consequences stated plainly rather than hidden:
//   · A visitor could open a stop without going anywhere. That is the correct trade for a teaching
//     game; a hunt with a prize would need a different design, not a lat/lng field added to this one.
//   · Because we never store a position, we cannot show a map trail or "how close you got". If that
//     is ever wanted, it is a new privacy decision, not an implementation detail.

const VISITOR_KEY_STORAGE = "wl.hunt.visitor";

/** The token never changes for the life of the page, so there is nothing to subscribe to. */
function subscribeNoop(): () => void {
  return () => {};
}

let cachedVisitorKey: string | null = null;

/** Stable, opaque, per-browser. Not an account, not a device id, not joinable to a user. */
function getVisitorKey(): string {
  // Cached because useSyncExternalStore calls the snapshot on every render and would loop forever if
  // this returned a fresh string each time.
  if (cachedVisitorKey) return cachedVisitorKey;
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY_STORAGE);
    if (existing && existing.length >= 8) {
      cachedVisitorKey = existing;
      return existing;
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(VISITOR_KEY_STORAGE, key);
    cachedVisitorKey = key;
    return key;
  } catch {
    // Private browsing with storage disabled: progress lasts for this page view only, which is
    // better than refusing to run the hunt at all.
    cachedVisitorKey = "ephemeral-" + Math.random().toString(16).slice(2).padEnd(10, "0");
    return cachedVisitorKey;
  }
}

type Dict = Record<string, string>;

export function HuntRunner({
  huntId,
  title,
  intro,
  allowRemoteFallback,
  stops,
  initialUnlocked,
  initialHotspotKeys,
  dict: t,
  mapDict,
  tour,
  lang,
  crossTourDict,
}: {
  huntId: string;
  title: string;
  intro: string | null;
  allowRemoteFallback: boolean;
  stops: (HuntStopInput & { clue: string | null; reveal: string | null; sceneName: string })[];
  initialUnlocked: string[];
  initialHotspotKeys: string[];
  dict: Dict;
  mapDict: HuntMapDict;
  /** The destination's tour, embedded so hotspot keys and stop progress share one key state. */
  tour: VirtualTourType | null;
  lang: Locale;
  crossTourDict: CrossTourPreviewCardDict;
}) {
  // localStorage is client-only, so the key cannot be read during render without a hydration
  // mismatch. useSyncExternalStore is the sanctioned way to read a client-only source: the server
  // snapshot is null, the client snapshot is the token, and React handles the handoff. (An effect
  // that setState'd would also work but is the pattern react-hooks/set-state-in-effect exists to
  // discourage.)
  const visitorKey = useSyncExternalStore(subscribeNoop, getVisitorKey, () => null);
  const [unlocked, setUnlocked] = useState<string[]>(initialUnlocked);
  const [position, setPosition] = useState<Coords | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [geoError, setGeoError] = useState(false);
  // Whether a location watch is running. Kept in STATE, not read off the ref: the button that starts
  // it renders from this, and a ref read during render does not trigger the re-render that hides it.
  const [watching, setWatching] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const watchRef = useRef<number | null>(null);

  // Stop watching on unmount. A location watch left running is a battery drain the visitor did not
  // agree to, and this component unmounts on every navigation away from the hunt.
  useEffect(() => {
    return () => {
      if (watchRef.current != null && typeof navigator !== "undefined") {
        navigator.geolocation?.clearWatch(watchRef.current);
      }
    };
  }, []);

  const startWatching = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(true);
      setWatching(false);
      return;
    }
    setGeoError(false);
    setWatching(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setAccuracyM(p.coords.accuracy);
      },
      () => {
        setGeoError(true);
        setWatching(false);
      },
      // High accuracy because the whole mechanic is "am I at this doorway"; a 30s timeout because a
      // cold GPS fix outdoors genuinely takes that long and failing early looks like a broken app.
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 15_000 },
    );
  }, []);

  // Keys earned by finding hotspots inside the embedded viewer. Persisted server-side via
  // recordHotspotFind, and seeded from the server on first load, so finding something hidden and
  // then reloading does not lose it.
  const [hotspotKeys, setHotspotKeys] = useState<string[]>(initialHotspotKeys);
  const keys = useMemo(
    () => keysAfter(stops, unlocked, hotspotKeys),
    [stops, unlocked, hotspotKeys],
  );

  const onKeyGranted = useCallback(
    (_key: string, hotspotId: string) => {
      if (!visitorKey) return;
      const form = new FormData();
      form.set("huntId", huntId);
      form.set("hotspotId", hotspotId);
      form.set("visitorKey", visitorKey);
      startTransition(async () => {
        // The key is resolved server-side from the hotspot row; the value passed to this callback is
        // only used for the optimistic path, never trusted as the grant itself.
        const r = await recordHotspotFind(form);
        if (r.ok) setHotspotKeys(r.data.keys);
      });
    },
    [huntId, visitorKey],
  );
  const availability = useMemo(
    () => evaluateStops(stops, { unlocked, keys, position, accuracyM }),
    [stops, unlocked, keys, position, accuracyM],
  );

  function unlock(stopId: string, opts: { answer?: string; viaFallback?: boolean } = {}) {
    if (!visitorKey) return;
    setError(null);
    const form = new FormData();
    form.set("huntId", huntId);
    form.set("stopId", stopId);
    form.set("visitorKey", visitorKey);
    if (opts.answer != null) form.set("answer", opts.answer);
    if (opts.viaFallback) form.set("viaFallback", "true");
    startTransition(async () => {
      const r = await unlockHuntStop(form);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setUnlocked(r.data.unlocked);
    });
  }

  // Stop marks for the map. `next` is the first stop that is neither done nor blocked by sequence,
  // which is exactly the one a visitor should be walking toward.
  const mapStops: HuntMapStop[] = useMemo(() => {
    const placed = stops
      .filter((s) => s.geoLat != null && s.geoLng != null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // "next" is the first placed stop that is neither finished nor blocked by sequence, which is
    // exactly the one a visitor should be walking toward. Found by index first rather than by
    // flipping a flag inside the map, so nothing is reassigned during render.
    const nextIndex = placed.findIndex((s) => {
      const st = availability.get(s.id)?.state;
      return st !== "done" && st !== "locked";
    });
    return placed.map((s, i) => ({
      id: s.id,
      title: s.title,
      order: s.sortOrder,
      lat: s.geoLat as number,
      lng: s.geoLng as number,
      state:
        availability.get(s.id)?.state === "done" ? "done" : i === nextIndex ? "next" : "later",
    }));
  }, [stops, availability]);

  const total = stops.length;
  const doneCount = stops.filter((s) => unlocked.includes(s.id)).length;
  const complete = total > 0 && doneCount === total;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {intro ? <p className="mt-2 text-neutral-700 dark:text-neutral-300">{intro}</p> : null}
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {t.stopOf.replace("{n}", String(Math.min(doneCount + 1, total))).replace("{total}", String(total))}
        </p>
        {keys.length > 0 ? (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {t.keysHeld.replace("{keys}", keys.join(", "))}
          </p>
        ) : null}
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {tour ? (
        <TourWithCrossTour
          tour={tour}
          height="55vh"
          lang={lang}
          openInNewTab={false}
          dict={crossTourDict}
          heldKeys={keys}
          onKeyGranted={onKeyGranted}
        />
      ) : null}

      {mapStops.length > 0 ? (
        <HuntMap stops={mapStops} position={position} dict={mapDict} />
      ) : null}

      {complete ? (
        <p className="rounded-md bg-emerald-50 p-4 font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t.complete}
        </p>
      ) : null}

      <ol className="space-y-4">
        {stops.map((s, i) => {
          const a = availability.get(s.id);
          const isDone = a?.state === "done";
          return (
            <li
              key={s.id}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
              aria-current={!isDone && a?.state !== "locked" ? "step" : undefined}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {i + 1}. {isDone || a?.state !== "locked" ? s.title : "?"}
                </h2>
                {isDone ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {t.done}
                  </span>
                ) : null}
              </div>

              {a?.state === "locked" ? (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t.locked}</p>
              ) : null}

              {isDone ? (
                s.reveal ? (
                  <p className="mt-2 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
                    {s.reveal}
                  </p>
                ) : null
              ) : a?.state !== "locked" && s.clue ? (
                <p className="mt-2 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
                  {s.clue}
                </p>
              ) : null}

              {a?.state === "ready" ? (
                <button
                  type="button"
                  onClick={() => unlock(s.id)}
                  disabled={pending || !visitorKey}
                  className="mt-3 min-h-11 rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                >
                  {t.unlockCta}
                </button>
              ) : null}

              {a?.state === "needs-answer" ? (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    unlock(s.id, { answer: answers[s.id] ?? "" });
                  }}
                >
                  <div className="min-w-48 flex-1">
                    <label htmlFor={`ans-${s.id}`} className="block text-sm font-medium">
                      {t.answerPrompt}
                    </label>
                    <input
                      id={`ans-${s.id}`}
                      value={answers[s.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      maxLength={200}
                      className="mt-1 min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pending || !visitorKey}
                    className="min-h-11 rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                  >
                    {t.answerCta}
                  </button>
                </form>
              ) : null}

              {a?.state === "needs-keys" ? (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {t.needsKeys.replace("{keys}", a.missing.join(", "))}
                </p>
              ) : null}

              {a?.state === "unplaced" ? (
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{t.unplaced}</p>
              ) : null}

              {a?.state === "needs-position" || a?.state === "too-far" ? (
                <div className="mt-3 space-y-2">
                  {a.state === "too-far" ? (
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      {t.tooFar.replace("{m}", String(a.metres))}
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{t.needsPosition}</p>
                  )}
                  {geoError ? (
                    <p className="text-sm text-amber-800 dark:text-amber-300">{t.locationDenied}</p>
                  ) : null}
                  {!watching ? (
                    <button type="button" onClick={startWatching} className="min-h-11 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium dark:border-neutral-700">
                      {t.locationCta}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* The remote fallback. Rendered for any stop the visitor cannot reach, and worded so
                  using it does not read as cheating — because for a lot of people it is the only
                  way through, and a grudging label is its own barrier. */}
              {allowRemoteFallback &&
              (a?.state === "needs-position" || a?.state === "too-far" || a?.state === "unplaced") ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => unlock(s.id, { viaFallback: true })}
                    disabled={pending || !visitorKey}
                    className="min-h-11 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
                  >
                    {t.fallbackCta}
                  </button>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{t.fallbackNote}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <footer className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{t.privacyNote}</p>
        {doneCount > 0 ? (
          <button
            type="button"
            className="min-h-11 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium dark:border-neutral-700"
            disabled={pending || !visitorKey}
            onClick={() => {
              if (!visitorKey) return;
              const form = new FormData();
              form.set("huntId", huntId);
              form.set("visitorKey", visitorKey);
              startTransition(async () => {
                await resetHuntProgress(form);
                setUnlocked([]);
                setAnswers({});
              });
            }}
          >
            {t.resetCta}
          </button>
        ) : null}
      </footer>
    </div>
  );
}
