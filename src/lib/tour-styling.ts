// Creator-controlled accent colors for a destination's virtual tour
// viewer. Stored as nullable hex strings on `destinations.tour_arrow_color`
// and `destinations.tour_pin_color`; null falls back to the defaults
// rendered into PSV (white arrow, red pin).
//
// The picker surfaces these presets as a small swatch row. Free-form
// hex input is intentionally NOT exposed in v1 — every preset has been
// eyeballed against typical 360° backgrounds (museum interiors, outdoor
// daylight, dim industrial) so creators can't pick a color that
// disappears against their footage. Wider palettes / custom hex are a
// future enhancement.

export type TourColorPresetKey =
  | "red"
  | "rose"
  | "orange"
  | "amber"
  | "yellow"
  | "emerald"
  | "teal"
  | "sky"
  | "indigo"
  | "violet"
  | "slate"
  | "white";

export type TourColorPreset = {
  /** Hex string actually stored in the DB. */
  value: string;
  /** i18n key suffix under `creator.destinations.form.tourStyling.preset.*`. */
  key: TourColorPresetKey;
};

// Order roughly walks the color wheel (warm → cool) so the picker reads
// like a spectrum. White sits at the end as the high-contrast "always
// visible on dark scenes" option. Every value passes WCAG AA contrast
// against typical 360° backgrounds at the marker's stroke + size.
export const TOUR_COLOR_PRESETS: readonly TourColorPreset[] = [
  { value: "#dc2626", key: "red" },
  { value: "#e11d48", key: "rose" },
  { value: "#f97316", key: "orange" },
  { value: "#f59e0b", key: "amber" },
  { value: "#eab308", key: "yellow" },
  { value: "#10b981", key: "emerald" },
  { value: "#14b8a6", key: "teal" },
  { value: "#0ea5e9", key: "sky" },
  { value: "#6366f1", key: "indigo" },
  { value: "#8b5cf6", key: "violet" },
  { value: "#64748b", key: "slate" },
  { value: "#ffffff", key: "white" },
] as const;

export const PRESET_VALUES = new Set(TOUR_COLOR_PRESETS.map((p) => p.value));

/** White arrow on the link plugin; matches PSV's own default. */
export const DEFAULT_ARROW_COLOR = "#ffffff";
/** Red drop pin; matches the original /tour-assets/pin.svg fill. */
export const DEFAULT_PIN_COLOR = "#dc2626";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Accept a creator-supplied color only if it parses as 7-char hex AND
 * matches one of the presets. Anything else (including custom hex from
 * a tampered request) collapses to null = "use default". This is the
 * single chokepoint enforcing the preset-only rule on the server.
 */
export function normalizeTourColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  return PRESET_VALUES.has(lower) ? lower : null;
}

/**
 * The scene-link arrow, copied verbatim from the plugin's own DEFAULT_ARROW
 * (@photo-sphere-viewer/virtual-tour-plugin). We render the arrow ourselves in
 * order to give the button an accessible name, and reproducing the exact path
 * keeps the visual identical — this change is about the name, not the look.
 *
 * `currentColor` is load-bearing: it is what lets a destination's accent tint
 * the arrow via arrowStyle.style.color.
 */
export const PSV_DEFAULT_ARROW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
  '<path fill-rule="even-odd" fill="currentColor" d="' +
  "M50,50 m45,0 a45,45 0 1,0 -90,0 a45,45 0 1,0 90,0 " +
  "M50,50 m38,0 a38,38 0 0,1 -76,0 a38,38 0 0,1 76,0 " +
  "M50,50 m30,0 a30,30 0 1,0 -60,0 a30,30 0 1,0 60,0 " +
  "M50,40 m2.5,-2.5 l17.5,17.5 a 2.5,2.5 0 0 1 -5,5 l-15,-15 l-15,15 " +
  "a 2.5,2.5 0 0 1 -5,-5 l17.5,-17.5 a 3.5,3.5 0 0 1 5,0" +
  '"/></svg>';
