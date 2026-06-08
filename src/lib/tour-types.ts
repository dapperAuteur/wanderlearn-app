/**
 * Tour type — the single source of truth for the experience categories a
 * destination can be tagged with. These drive the globe pin color + legend.
 *
 * "Use enums to designate tour type": the canonical set is a pgEnum
 * (`tour_type` in src/db/schema/tour-types.ts) — adding a NEW category is a
 * dev migration ("add type to the list as it's added to the app").
 *
 * "Allow admin to manage the list": presentation (color, sort order,
 * active on/off) lives in the admin-editable `tour_type_settings` table,
 * NOT here. Labels live in the en/es dictionaries (`dict.tourTypes.*`,
 * hand-translated). So this file is just the controlled vocabulary + the
 * seed defaults a new type ships with.
 *
 * To add a type: append it here, add the pgEnum value (migration), add the
 * en+es label, and seed a `tour_type_settings` row (see the migration).
 */

export const TOUR_TYPES = [
  "course",
  "tour_only",
  "concert",
  "hike",
  "bike_ride",
  "museum",
  "real_estate",
] as const;

export type TourType = (typeof TOUR_TYPES)[number];

/** Pin/legend color a type falls back to when no admin override is set, and
 * the value seeded into tour_type_settings. Hex values are members of
 * TOUR_COLOR_PRESETS (src/lib/tour-styling.ts) so the palette stays unified. */
export const TOUR_TYPE_DEFAULT_COLORS: Record<TourType, string> = {
  course: "#0ea5e9", // sky
  tour_only: "#64748b", // slate
  concert: "#e11d48", // rose
  hike: "#10b981", // emerald
  bike_ride: "#14b8a6", // teal
  museum: "#8b5cf6", // violet
  real_estate: "#f59e0b", // amber
};

/** Default ordering for the admin list + legend (seeded into sortOrder). */
export const TOUR_TYPE_DEFAULT_ORDER: Record<TourType, number> =
  TOUR_TYPES.reduce(
    (acc, t, i) => {
      acc[t] = i;
      return acc;
    },
    {} as Record<TourType, number>,
  );

/** Applied when a destination has no tour_type set. */
export const DEFAULT_TOUR_TYPE: TourType = "tour_only";

export function isTourType(value: unknown): value is TourType {
  return (
    typeof value === "string" && (TOUR_TYPES as readonly string[]).includes(value)
  );
}

/** Build {value,label} options for a <select>, in registry order. */
export function tourTypeOptions(
  labels: Record<string, string>,
): { value: TourType; label: string }[] {
  return TOUR_TYPES.map((t) => ({ value: t, label: labels[t] ?? t }));
}
