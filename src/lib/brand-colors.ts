/**
 * Passport Stamp palette as literal hex values.
 *
 * WHY THIS FILE EXISTS: `next/og` renders `ImageResponse` in an isolated
 * Satori context with no stylesheet and no CSS custom properties, so the OG
 * routes cannot read the tokens in `src/app/globals.css`. Before this file the
 * three OG routes each hardcoded their own colours and had already drifted
 * apart from each other and from the site.
 *
 * THIS IS A MIRROR, NOT A SOURCE. `globals.css` is authoritative. If a token
 * changes there, change it here in the same commit or the share cards quietly
 * keep showing the old brand — a drift nothing in CI can catch, because an OG
 * image has no contrast test and no snapshot.
 *
 * Light-palette values only. Share cards render on someone else's feed, not in
 * the viewer's colour scheme, so there is one fixed look rather than two.
 */
export const brandColors = {
  /** Warm cream page. */
  background: "#fdf8ef",
  /** Deep ink — 16.09:1 on background. */
  foreground: "#1b1a2e",
  /** Secondary text — 6.62:1. */
  muted: "#5a5670",
  /** Tangerine. A FILL, not a text colour: 3.38:1 on cream. */
  brand: "#e8590c",
  /** Darkened tangerine for text — 5.23:1. Use this for any words. */
  brandText: "#b8410a",
  /** Ink indigo. White on it is 9.6:1. */
  secondary: "#3b3a8f",
  /** Stamp gold. Decorative only in light — 1.72:1 as text is a failure. */
  accent: "#f2b705",
  /** Hairline. */
  line: "rgba(27, 26, 46, 0.15)",
} as const;
