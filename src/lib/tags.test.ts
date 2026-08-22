import { describe, expect, it } from "vitest";
import { canonicaliseTag, parseTagEntry } from "./tags";

const known = ["Ghana", "Museum", "Cape Coast"];

describe("canonicaliseTag", () => {
  it("adopts the existing spelling regardless of case", () => {
    expect(canonicaliseTag("ghana", known)).toBe("Ghana");
    expect(canonicaliseTag("GHANA", known)).toBe("Ghana");
  });

  it("does NOT expand a prefix — 'Gha' must not become 'Ghana'", () => {
    // Silently expanding a prefix would put a tag on a file nobody chose,
    // which is worse than the duplicate it prevents.
    expect(canonicaliseTag("Gha", known)).toBe("Gha");
  });

  it("keeps an unknown tag as typed", () => {
    expect(canonicaliseTag("Elmina", known)).toBe("Elmina");
  });

  it("normalises surrounding and internal whitespace", () => {
    expect(canonicaliseTag("  cape   coast ", known)).toBe("Cape Coast");
  });

  it("returns empty for blank input rather than a stray space", () => {
    expect(canonicaliseTag("   ", known)).toBe("");
  });

  it("is unchanged when there are no known tags", () => {
    expect(canonicaliseTag("ghana", [])).toBe("ghana");
  });
});

describe("parseTagEntry", () => {
  it("splits on commas and canonicalises each piece", () => {
    expect(parseTagEntry("ghana, museum", known)).toEqual(["Ghana", "Museum"]);
  });

  it("drops blanks from trailing or doubled commas", () => {
    expect(parseTagEntry("ghana,,  ,", known)).toEqual(["Ghana"]);
  });

  it("de-duplicates case-insensitively", () => {
    expect(parseTagEntry("ghana, Ghana, GHANA", known)).toEqual(["Ghana"]);
  });

  it("returns nothing for an empty entry", () => {
    expect(parseTagEntry("   ", known)).toEqual([]);
  });
});
