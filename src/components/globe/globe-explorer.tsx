"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Globe, { type GlobeMethods } from "react-globe.gl";

export interface GlobeMarker {
  slug: string;
  name: string;
  city?: string;
  country?: string;
  lat: number;
  lng: number;
}

export interface GlobeLabels {
  /** Accessible name for the globe region. */
  region: string;
  /** Floating hint under the globe. */
  hint: string;
  /** Heading above the tour list. */
  listHeading: string;
  /** Modal CTA, e.g. "Take tour". */
  takeTour: string;
  /** Close-button label for the modal. */
  close: string;
}

export interface GlobeExplorerProps {
  markers: GlobeMarker[];
  lang: string;
  /** Render the keyboard-navigable tour list beside the globe. */
  showList?: boolean;
  labels: GlobeLabels;
}

const PIN_COLOR = "#f59e0b"; // amber
const PIN_SELECTED_COLOR = "#fde68a"; // brighter amber for the focused pin

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function GlobeExplorer({
  markers,
  lang,
  showList = false,
  labels,
}: GlobeExplorerProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const selected = useMemo(
    () => markers.find((m) => m.slug === selectedSlug) ?? null,
    [markers, selectedSlug],
  );

  // Globe.gl needs explicit pixel dimensions; track the container width and
  // derive a viewport-friendly height capped so the accessible list/grid
  // below it stays reachable on mobile.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const height = Math.min(
        Math.max(width, 320),
        Math.round(window.innerHeight * 0.6),
      );
      setSize({ width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const centroid = useMemo(() => {
    if (markers.length === 0) return { lat: 20, lng: 0 };
    const sum = markers.reduce(
      (acc, m) => ({ lat: acc.lat + m.lat, lng: acc.lng + m.lng }),
      { lat: 0, lng: 0 },
    );
    return { lat: sum.lat / markers.length, lng: sum.lng / markers.length };
  }, [markers]);

  // Initial orientation + auto-rotate (unless reduced motion) once ready.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || size.width === 0) return;
    const controls = globe.controls();
    controls.autoRotate = !prefersReducedMotion();
    controls.autoRotateSpeed = 0.4;
    // Allow zoom (pinch on touch, wheel on desktop) so clustered pins —
    // e.g. several tours in one city — can be separated. Bounded so users
    // can't fall through the globe or zoom out to nothing. The keyboard
    // list is the clustering-proof path; selecting an item flies in.
    controls.enableZoom = true;
    controls.minDistance = 150;
    controls.maxDistance = 700;
    globe.pointOfView(
      { lat: centroid.lat, lng: centroid.lng, altitude: 2.4 },
      0,
    );
  }, [size.width, centroid]);

  // Fly to the selected pin and pause auto-rotation while a tour is focused.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || size.width === 0) return;
    const controls = globe.controls();
    if (selected) {
      controls.autoRotate = false;
      globe.pointOfView(
        { lat: selected.lat, lng: selected.lng, altitude: 1.6 },
        prefersReducedMotion() ? 0 : 1000,
      );
    } else {
      controls.autoRotate = !prefersReducedMotion();
    }
  }, [selected, size.width]);

  // Move focus into the card when it opens so keyboard users land on it.
  useEffect(() => {
    if (selected && cardRef.current) cardRef.current.focus();
  }, [selected]);

  const close = useCallback(() => setSelectedSlug(null), []);

  // Esc closes the card.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, close]);

  const place = selected
    ? [selected.city, selected.country].filter(Boolean).join(", ")
    : "";

  // On a narrow (mobile) canvas the globe is physically small, so pins —
  // and their tap targets — get hard to hit. Scale them up below 640px.
  const compact = size.width > 0 && size.width < 640;
  const baseRadius = compact ? 0.95 : 0.45;
  const selectedRadius = compact ? 1.35 : 0.7;
  const baseAltitude = compact ? 0.06 : 0.04;
  const selectedAltitude = compact ? 0.12 : 0.08;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="relative w-full lg:flex-1">
        <div
          ref={containerRef}
          role="img"
          aria-label={labels.region}
          className="relative w-full overflow-hidden rounded-lg bg-slate-950"
        >
          {size.width > 0 ? (
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="/tour-assets/globe/earth-blue-marble.jpg"
            showAtmosphere
            atmosphereColor="#7dd3fc"
            atmosphereAltitude={0.18}
            pointsData={markers}
            pointLat={(d) => (d as GlobeMarker).lat}
            pointLng={(d) => (d as GlobeMarker).lng}
            pointColor={(d) =>
              (d as GlobeMarker).slug === selectedSlug
                ? PIN_SELECTED_COLOR
                : PIN_COLOR
            }
            pointAltitude={(d) =>
              (d as GlobeMarker).slug === selectedSlug
                ? selectedAltitude
                : baseAltitude
            }
            pointRadius={(d) =>
              (d as GlobeMarker).slug === selectedSlug
                ? selectedRadius
                : baseRadius
            }
            pointsMerge={false}
            pointLabel={(d) => (d as GlobeMarker).name}
            onPointClick={(d) => setSelectedSlug((d as GlobeMarker).slug)}
          />
        ) : null}

          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-white/80">
            {labels.hint}
          </p>
        </div>

        {selected ? (
          <div
            ref={cardRef}
            role="dialog"
            aria-label={selected.name}
            tabIndex={-1}
            className="absolute inset-x-3 top-3 z-10 mx-auto max-w-sm rounded-lg bg-white/95 p-4 text-left shadow-lg ring-1 ring-black/10 backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-zinc-900/95 dark:ring-white/15"
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-2 top-2 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:text-white"
            >
              <span aria-hidden="true">×</span>
              <span className="sr-only">{labels.close}</span>
            </button>
            <p className="pr-8 text-base font-semibold tracking-tight">
              {selected.name}
            </p>
            {place ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {place}
              </p>
            ) : null}
            <Link
              href={`/${lang}/tours/${selected.slug}`}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {labels.takeTour} →
            </Link>
          </div>
        ) : null}
      </div>

      {showList ? (
        <nav
          aria-label={labels.listHeading}
          className="lg:w-64 lg:shrink-0"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {labels.listHeading}
          </h3>
          <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto lg:max-h-[60vh]">
            {markers.map((m) => {
              const isSelected = m.slug === selectedSlug;
              const sub = [m.city, m.country].filter(Boolean).join(", ");
              return (
                <li key={m.slug}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedSlug(m.slug)}
                    className={`flex min-h-11 w-full flex-col items-start justify-center rounded-md px-3 py-1.5 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                      isSelected
                        ? "bg-foreground text-background"
                        : "hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <span className="font-medium">{m.name}</span>
                    {sub ? (
                      <span
                        className={
                          isSelected
                            ? "text-xs text-background/80"
                            : "text-xs text-zinc-500 dark:text-zinc-400"
                        }
                      >
                        {sub}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
