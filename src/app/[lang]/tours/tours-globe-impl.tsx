"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Globe, { type GlobeMethods } from "react-globe.gl";

export interface GlobeMarker {
  slug: string;
  name: string;
  city?: string;
  country?: string;
  lat: number;
  lng: number;
}

export interface ToursGlobeImplProps {
  markers: GlobeMarker[];
  lang: string;
  /** Pre-translated strings — components never hold string literals. */
  labels: {
    /** Accessible name for the globe region. */
    region: string;
    /** Floating hint, e.g. "Drag to spin · tap a pin to open". */
    hint: string;
    /** Tooltip call-to-action, e.g. "Open tour". */
    openCta: string;
  };
}

// Tooltip is injected as raw HTML by globe.gl, so destination names
// (creator-controlled free text) must be escaped before interpolation.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PIN_COLOR = "#f59e0b"; // amber — reads on the blue-marble ocean + land

export default function ToursGlobeImpl({
  markers,
  lang,
  labels,
}: ToursGlobeImplProps) {
  const router = useRouter();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Globe.gl needs explicit pixel dimensions. Track the container's width
  // and derive a viewport-friendly height (capped so the globe never pushes
  // the accessible card grid fully below the fold on mobile).
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

  // Orient the globe at the centroid of the mapped destinations so the
  // first paint already shows pins rather than empty ocean. Naive average
  // (no antimeridian handling) — good enough for a discovery overview.
  const centroid = useMemo(() => {
    if (markers.length === 0) return { lat: 20, lng: 0 };
    const sum = markers.reduce(
      (acc, m) => ({ lat: acc.lat + m.lat, lng: acc.lng + m.lng }),
      { lat: 0, lng: 0 },
    );
    return { lat: sum.lat / markers.length, lng: sum.lng / markers.length };
  }, [markers]);

  // Auto-rotate (unless the visitor prefers reduced motion) and set the
  // initial point of view once the globe instance is ready.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || size.width === 0) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const controls = globe.controls();
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.4;
    // Wheel/pinch zoom would capture page scroll on this content page —
    // keep it a drag-to-spin overview instead.
    controls.enableZoom = false;
    globe.pointOfView(
      { lat: centroid.lat, lng: centroid.lng, altitude: 2.4 },
      0,
    );
  }, [size.width, centroid]);

  return (
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
          pointColor={() => PIN_COLOR}
          pointAltitude={0.04}
          pointRadius={0.45}
          pointsMerge={false}
          pointLabel={(d) => {
            const m = d as GlobeMarker;
            const place = [m.city, m.country].filter(Boolean).join(", ");
            return `<div style="background:rgba(15,23,42,0.92);color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;line-height:1.3;max-width:220px;">
              <strong>${escapeHtml(m.name)}</strong>
              ${place ? `<br/><span style="opacity:0.8">${escapeHtml(place)}</span>` : ""}
              <br/><span style="color:#fbbf24;font-weight:600">${escapeHtml(labels.openCta)} →</span>
            </div>`;
          }}
          onPointClick={(d) => {
            const m = d as GlobeMarker;
            router.push(`/${lang}/tours/${m.slug}`);
          }}
        />
      ) : null}
      <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-white/80">
        {labels.hint}
      </p>
    </div>
  );
}
