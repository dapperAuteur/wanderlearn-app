import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_RECOMMENDED,
  descriptionLength,
} from "./audio-description-length";

describe("descriptionLength", () => {
  it("counts what will be stored, not what was typed", () => {
    // The action trims before writing, so counting raw input would promise a
    // creator 140 characters and store fewer.
    expect(descriptionLength("  birdsong  ")).toBe(8);
  });

  it("counts an empty and a whitespace-only value as nothing", () => {
    expect(descriptionLength("")).toBe(0);
    expect(descriptionLength("   \n  ")).toBe(0);
  });

  it("keeps interior spaces, which are part of the sentence", () => {
    expect(descriptionLength("distant traffic")).toBe(15);
  });
});

describe("the limits", () => {
  it("recommends well under the hard cap, so going long is possible", () => {
    // If these met, the advisory note would be unreachable and the
    // recommendation would silently become a limit.
    expect(DESCRIPTION_RECOMMENDED).toBeLessThan(DESCRIPTION_MAX);
  });

  it("recommends about two lines of the on-screen box", () => {
    // 28rem at text-xs is roughly 70 characters a line. This guards the number
    // against being nudged to something that no longer matches the overlay it
    // was derived from.
    expect(DESCRIPTION_RECOMMENDED).toBeGreaterThanOrEqual(120);
    expect(DESCRIPTION_RECOMMENDED).toBeLessThanOrEqual(160);
  });
});
