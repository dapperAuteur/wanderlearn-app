import { env } from "./env";
import type { Locale } from "./locales";

export const siteName = "Wanderlearn";
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

export const twitterHandle = "@wanderlearn";
