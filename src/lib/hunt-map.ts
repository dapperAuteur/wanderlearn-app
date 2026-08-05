// HUNT MAP — projecting real-world coordinates onto a drawable plane. Pure functions, no React, no
// network, no dependency.
//
// ── WHY THERE IS NO BASEMAP, AND WHY THAT IS THE RIGHT FIRST VERSION ───────────────────────────
//
// A "geographic map layer" would normally mean a slippy map with street tiles. That was considered
// and deliberately deferred, for three reasons that are about this product rather than about effort:
//
//   1. IT WOULD NOT WORK WHERE IT MATTERS MOST. A hunt is played outdoors, often in exactly the
//      places phone signal is worst. A map that needs to fetch tiles is a map that shows a grey
//      rectangle at the moment a visitor is lost. This one is inline SVG computed from coordinates
//      already in the page, so it renders with no network at all.
//   2. IT WOULD PICK A VENDOR ON BAM'S BEHALF. Tiles mean a provider, terms of service, usually an
//      API key, and sometimes a bill. That is an operator decision, not one to make silently inside
//      a component.
//   3. IT IS ADDITIVE LATER. Everything here is a projection from lat/lng to an SVG viewBox. A
//      basemap slots in UNDER these marks without changing them.
//
// What this gives a visitor: where the stops are relative to each other, which one is next, where
// they are relative to it, and how far. That is what a hunt actually needs. What it does not give
// is streets, which is a real limitation and is stated in the UI rather than papered over.

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ProjectedPoint {
  /** SVG x, in viewBox units. */
  x: number;
  /** SVG y, in viewBox units. */
  y: number;
}

export interface MapProjection {
  /** viewBox width/height, in the same units the projected points use. */
  width: number;
  height: number;
  project(p: GeoPoint): ProjectedPoint;
  /** Metres represented by one horizontal viewBox unit, for drawing a scale bar. */
  metresPerUnit: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const DEG_TO_RAD = Math.PI / 180;

/** Web Mercator y, normalized to the same scale as longitude degrees at the equator. */
function mercatorY(lat: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return (Math.log(Math.tan(Math.PI / 4 + (clamped * DEG_TO_RAD) / 2)) / DEG_TO_RAD);
}

/**
 * Build a projection that fits every point into a `width` x `height` box with `pad` units of margin.
 *
 * Web Mercator rather than treating lat/lng as plain x/y: at 30-45 degrees north (the whole Ohio and
 * Mississippi corridor, and most of the northern hemisphere) a degree of longitude is roughly 0.7 to
 * 0.85 of a degree of latitude in ground distance. Plotting them as equals stretches the map
 * east-west by a fifth or more, which is enough to make "the next stop is that way" point wrong.
 *
 * Returns null when there is nothing to draw.
 */
export function buildProjection(
  points: readonly GeoPoint[],
  opts: { width?: number; height?: number; pad?: number } = {},
): MapProjection | null {
  const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (usable.length === 0) return null;

  const width = opts.width ?? 320;
  const height = opts.height ?? 320;
  const pad = opts.pad ?? 24;

  const xs = usable.map((p) => p.lng);
  const ys = usable.map((p) => mercatorY(p.lat));
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  // A single point, or several at the same spot, has zero extent and would divide by zero. Give it
  // an arbitrary small window (~0.002 degrees, roughly 200m) so it renders centred instead of
  // vanishing.
  const MIN_SPAN = 0.002;
  if (maxX - minX < MIN_SPAN) {
    const mid = (maxX + minX) / 2;
    minX = mid - MIN_SPAN / 2;
    maxX = mid + MIN_SPAN / 2;
  }
  if (maxY - minY < MIN_SPAN) {
    const mid = (maxY + minY) / 2;
    minY = mid - MIN_SPAN / 2;
    maxY = mid + MIN_SPAN / 2;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const inner = { w: width - pad * 2, h: height - pad * 2 };
  // One scale for both axes so the shape is not distorted; the smaller ratio wins.
  const scale = Math.min(inner.w / spanX, inner.h / spanY);
  const offsetX = pad + (inner.w - spanX * scale) / 2;
  const offsetY = pad + (inner.h - spanY * scale) / 2;

  // Ground metres per degree of longitude at the centre latitude of the set.
  const centreLat = usable.reduce((a, p) => a + p.lat, 0) / usable.length;
  const metresPerDegreeLng = EARTH_RADIUS_M * DEG_TO_RAD * Math.cos(centreLat * DEG_TO_RAD);

  return {
    width,
    height,
    metresPerUnit: metresPerDegreeLng / scale,
    project(p: GeoPoint): ProjectedPoint {
      return {
        x: offsetX + (p.lng - minX) * scale,
        // SVG y grows downward; north must be up.
        y: offsetY + (maxY - mercatorY(p.lat)) * scale,
      };
    },
  };
}

/**
 * A round-ish number of metres that fits within `maxUnits` of viewBox width, for a scale bar.
 * Returns null when even the smallest step does not fit.
 */
export function scaleBarFor(
  projection: MapProjection,
  maxUnits: number,
): { metres: number; units: number } | null {
  const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000];
  let best: { metres: number; units: number } | null = null;
  for (const metres of steps) {
    const units = metres / projection.metresPerUnit;
    if (units <= maxUnits) best = { metres, units };
  }
  return best;
}

/** "450 m" / "2.3 km", for a scale bar or a distance readout. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return "";
  if (metres < 1000) return `${Math.round(metres)} m`;
  if (metres < 10_000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres / 1000)} km`;
}

/**
 * Compass bearing from `a` to `b`, in degrees clockwise from north.
 *
 * Used to point an arrow at the next stop. This is the one piece of information a lost visitor
 * actually needs and the reason the map is worth drawing at all: with no streets, a direction and a
 * distance still get you there.
 */
export function bearing(a: GeoPoint, b: GeoPoint): number {
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) / DEG_TO_RAD + 360) % 360;
}

const COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

/**
 * Bearing as a spoken direction.
 *
 * Exists for accessibility, not decoration: an SVG arrow tells a sighted visitor which way to walk
 * and tells a screen-reader user nothing. Every place the map draws an arrow, it also renders this.
 */
export function bearingWords(deg: number): string {
  const i = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return COMPASS[i];
}
