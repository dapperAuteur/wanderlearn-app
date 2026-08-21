import { env } from "./env";
import type { Locale } from "./locales";

export const siteName = "Wanderlust";
export const siteTagline = "Place-based learning, captured in 360°";

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const siteUrl = stripTrailingSlash(env.BETTER_AUTH_URL);

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalized}`;
}

export function localizedAlternates(path: string, locales: readonly Locale[]) {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = absoluteUrl(`/${locale}${path}`);
  }
  languages["x-default"] = absoluteUrl(`/${locales[0]}${path}`);
  return languages;
}

// `twitterHandle` was removed in the 2026-08 Wanderlust rename. It exported
// the old brand's handle, had no consumers anywhere in the app, and there is no
// Wanderlust social account to repoint it at. Renaming it to "@wanderlust"
// would have asserted ownership of a common-word handle almost certainly
// belonging to someone else — and any Twitter card built from it would have
// credited a stranger on every shared link.
//
// If a real account exists later, re-add it here and consume it as
// `twitter.site` in the metadata of src/app/[lang]/page.tsx and the other
// route-level generateMetadata functions.
