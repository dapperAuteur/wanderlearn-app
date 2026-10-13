import { z } from "zod";

/**
 * Links a creator types (hotspot links, a tour's website, tour links) must be
 * http: or https:. A bare `z.string().url()` only checks that `new URL()`
 * parses, so `javascript:` and `data:` URLs pass, and a hotspot opens its link
 * with `window.open`, which React's href guard never sees.
 */
export const httpUrlSchema = z.string().url({ protocol: /^https?$/ }).max(500);

/** Client-side twin of httpUrlSchema, for the moment a stored link is opened. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
