export const locales = ["en", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Locales that are finished enough to advertise publicly.
 *
 * Spanish is NOT here yet, by BAM's call (2026-08). `es.json` exists and most
 * of the app is translated, but an accumulated backlog of keys still holds
 * English placeholders — the Help Center, `creator.library`, several
 * `howItWorks` bodies, and more (see plans/user-tasks task 43). Under the
 * no-AI-translation rule those wait on a human speaker, so Spanish is real but
 * incomplete rather than merely missing.
 *
 * THIS DOES NOT DISABLE SPANISH. `/es/*` routes still render, existing links
 * and bookmarks still work, and the a11y suite still audits both locales. What
 * it withholds is the two ways a stranger would DISCOVER Spanish:
 *
 *   1. the language switcher in the header and mobile menu, and
 *   2. the `hreflang` alternates, which is the one that actually matters —
 *      those tell search engines to index and surface the Spanish pages. A
 *      partner searching in Spanish landing on a half-English page is a worse
 *      first impression than no Spanish page at all, and unlike the button,
 *      nobody would notice it happening.
 *
 * To ship Spanish: add "es" here. That is the whole change — the switcher and
 * every route's alternates come back together, which is the point of one flag
 * rather than two.
 */
export const publicLocales: readonly Locale[] = ["en"];

/** True when more than one locale is public, so a switcher has somewhere to go. */
export const localeSwitcherEnabled = publicLocales.length > 1;

export function isPublicLocale(value: Locale): boolean {
  return publicLocales.includes(value);
}
