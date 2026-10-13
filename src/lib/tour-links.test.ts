import { describe, expect, it } from "vitest";
import { splitTourLinks, tourLinksSchema } from "./tour-links";

const link = (label: string, featured = false) => ({
  label,
  url: `https://example.org/${label.toLowerCase()}`,
  featured,
});

describe("tourLinksSchema", () => {
  it("accepts up to three links with one featured", () => {
    expect(tourLinksSchema.safeParse([link("Donate", true), link("Tickets"), link("Site")]).success).toBe(true);
  });

  it("accepts no links (clearing them)", () => {
    expect(tourLinksSchema.safeParse([]).success).toBe(true);
  });

  it("rejects a fourth link", () => {
    expect(tourLinksSchema.safeParse([link("A"), link("B"), link("C"), link("D")]).success).toBe(false);
  });

  it("rejects two featured links", () => {
    expect(tourLinksSchema.safeParse([link("A", true), link("B", true)]).success).toBe(false);
  });

  it("rejects javascript: and blank labels", () => {
    expect(
      tourLinksSchema.safeParse([{ label: "Give", url: "javascript:alert(1)", featured: false }]).success,
    ).toBe(false);
    expect(tourLinksSchema.safeParse([{ ...link("x"), label: "   " }]).success).toBe(false);
  });
});

describe("splitTourLinks", () => {
  it("pulls the featured link out and keeps the others in order", () => {
    const links = [link("Site"), link("Donate", true), link("Tickets")];
    const { featured, others } = splitTourLinks(links);
    expect(featured?.label).toBe("Donate");
    expect(others.map((l) => l.label)).toEqual(["Site", "Tickets"]);
  });

  it("returns null when nothing is featured", () => {
    expect(splitTourLinks([link("Site")]).featured).toBeNull();
  });
});
