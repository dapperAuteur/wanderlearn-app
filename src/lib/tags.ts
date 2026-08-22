/**
 * Tag canonicalisation for the media library.
 *
 * Tags are how media gets found months later, so a vocabulary that splinters
 * into "Ghana", "ghana" and "GHANA" degrades quietly and expensively — the
 * damage shows up long after the session that caused it, as a search that
 * returns two thirds of what it should.
 *
 * The suggestion list exists to steer people onto existing spellings. This is
 * the same steering applied to text that never went through the list: typed
 * and submitted directly, or left in the box when Apply was pressed.
 */

/**
 * Returns the existing spelling of `raw` when one exists, else `raw` unchanged.
 *
 * Case-insensitive, whitespace-normalised. Deliberately NOT fuzzy: "Gha" must
 * NOT become "Ghana". A prefix is a different word as far as this is
 * concerned, and silently expanding one would be a worse bug than the
 * duplicate it prevented — it would put a tag on a file that the person never
 * chose.
 */
export function canonicaliseTag(raw: string, knownTags: readonly string[]): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const needle = trimmed.toLowerCase();
  for (const known of knownTags) {
    if (known.trim().toLowerCase() === needle) return known;
  }
  return trimmed;
}

/**
 * Splits a comma-separated entry into canonical tags, dropping blanks and
 * de-duplicating case-insensitively.
 */
export function parseTagEntry(raw: string, knownTags: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(",")) {
    const tag = canonicaliseTag(piece, knownTags);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}
