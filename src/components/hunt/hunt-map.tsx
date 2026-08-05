"use client";

import { useMemo } from "react";
import {
  bearing,
  bearingWords,
  buildProjection,
  formatDistance,
  scaleBarFor,
  type GeoPoint,
} from "@/lib/hunt-map";
import { haversineMeters } from "@/lib/hunts";

// The hunt map. Inline SVG computed from coordinates already on the page: no tiles, no network, no
// dependency, and it renders identically with the phone in airplane mode. See the header of
// src/lib/hunt-map.ts for why there is no basemap and why that is the right first version.
//
// ACCESSIBILITY IS THE DESIGN CONSTRAINT HERE, not a pass afterwards. A map is the most exclusionary
// component in any app: everything it says, it says visually. So every fact this draws is ALSO
// stated in text below it -- which stop is next, which direction it lies in, and how far. A visitor
// using a screen reader gets the same information a sighted visitor gets, in the same component. The
// SVG itself is aria-hidden precisely because the text is not a fallback, it is the primary channel.

export type HuntMapStop = {
  id: string;
  title: string;
  order: number;
  lat: number;
  lng: number;
  state: "done" | "next" | "later";
};

export type HuntMapDict = {
  heading: string;
  noPlacedStops: string;
  noBasemapNote: string;
  youAreHere: string;
  nextStop: string;
  /** "{title} is {distance} to the {direction}." */
  directionLine: string;
  scaleLabel: string;
  stopListHeading: string;
  positionUnknown: string;
};

export function HuntMap({
  stops,
  position,
  dict: t,
}: {
  stops: HuntMapStop[];
  /** The visitor's device position, or null. Never leaves the browser; see hunt-runner.tsx. */
  position: GeoPoint | null;
  dict: HuntMapDict;
}) {
  const placed = useMemo(
    () => stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)),
    [stops],
  );

  const projection = useMemo(() => {
    if (placed.length === 0) return null;
    // Include the visitor so the map always frames both them and the stops. Without this, someone
    // approaching from outside the stops' bounding box is drawn clamped to the edge, which reads as
    // "you are already there".
    const points: GeoPoint[] = position ? [...placed, position] : placed;
    return buildProjection(points, { width: 320, height: 320, pad: 28 });
  }, [placed, position]);

  const next = placed.find((s) => s.state === "next") ?? null;

  const guidance = useMemo(() => {
    if (!next || !position) return null;
    const to = { lat: next.lat, lng: next.lng };
    return {
      metres: haversineMeters(position, to),
      words: bearingWords(bearing(position, to)),
      deg: bearing(position, to),
    };
  }, [next, position]);

  if (placed.length === 0 || !projection) {
    return (
      <section aria-labelledby="hunt-map-h" className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 id="hunt-map-h" className="text-sm font-semibold">
          {t.heading}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t.noPlacedStops}</p>
      </section>
    );
  }

  const bar = scaleBarFor(projection, 120);
  const me = position ? projection.project(position) : null;
  const marks = placed.map((s) => ({ ...s, ...projection.project(s) }));
  // The route line, in stop order, so the shape of the walk is legible.
  const path = [...marks].sort((a, b) => a.order - b.order);

  return (
    <section aria-labelledby="hunt-map-h" className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 id="hunt-map-h" className="text-sm font-semibold">
        {t.heading}
      </h2>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${projection.width} ${projection.height}`}
          className="h-auto w-full max-w-80 rounded-md bg-neutral-50 dark:bg-neutral-900"
          role="presentation"
          aria-hidden="true"
        >
          <polyline
            points={path.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          {marks.map((m) => (
            <g key={m.id}>
              <circle
                cx={m.x}
                cy={m.y}
                r={m.state === "next" ? 8 : 6}
                className={
                  m.state === "done"
                    ? "fill-emerald-500"
                    : m.state === "next"
                      ? "fill-amber-500"
                      : "fill-neutral-400"
                }
              />
              <text
                x={m.x}
                y={m.y - 12}
                textAnchor="middle"
                className="fill-current text-[10px]"
              >
                {m.order}
              </text>
            </g>
          ))}
          {me ? (
            <>
              <circle cx={me.x} cy={me.y} r={10} className="fill-sky-500/25" />
              <circle cx={me.x} cy={me.y} r={4} className="fill-sky-600" />
            </>
          ) : null}
          {bar ? (
            <g transform={`translate(12 ${projection.height - 12})`}>
              <line x1={0} y1={0} x2={bar.units} y2={0} stroke="currentColor" strokeWidth={2} />
              <text x={0} y={-4} className="fill-current text-[9px]">
                {formatDistance(bar.metres)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      {/* The text channel. Everything the SVG shows, said in words. */}
      <div className="mt-3 space-y-1 text-sm">
        {next ? (
          guidance ? (
            <p>
              <strong>{t.nextStop}:</strong>{" "}
              {t.directionLine
                .replace("{title}", next.title)
                .replace("{distance}", formatDistance(guidance.metres))
                .replace("{direction}", guidance.words)}
            </p>
          ) : (
            <p>
              <strong>{t.nextStop}:</strong> {next.title}. {t.positionUnknown}
            </p>
          )
        ) : null}
        {bar ? (
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {t.scaleLabel.replace("{distance}", formatDistance(bar.metres))}
          </p>
        ) : null}
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{t.noBasemapNote}</p>
      </div>

      <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
        {t.stopListHeading}
      </h3>
      <ol className="mt-1 space-y-0.5 text-sm">
        {path.map((m) => (
          <li key={m.id} className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              className={
                m.state === "done"
                  ? "inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                  : m.state === "next"
                    ? "inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"
                    : "inline-block h-2 w-2 shrink-0 rounded-full bg-neutral-400"
              }
            />
            <span>
              {m.order}. {m.title}
              {position ? (
                <span className="text-neutral-600 dark:text-neutral-400">
                  {" "}
                  ({formatDistance(haversineMeters(position, { lat: m.lat, lng: m.lng }))}{" "}
                  {bearingWords(bearing(position, { lat: m.lat, lng: m.lng }))})
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
