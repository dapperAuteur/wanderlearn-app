import { describe, expect, it } from "vitest";
import { planReplacement, selectableSlots } from "./media-replace-plan";
import type { MediaUse } from "@/db/queries/media-uses";

/**
 * The rule these protect: slots are not interchangeable. A file that is legal
 * as a hero image is illegal as a panorama, and a replace that ignored that
 * would put an MP3 where a photograph belongs — or half-apply and leave the
 * creator to work out which half.
 */
const uses: MediaUse[] = [
  { slot: "scene.panorama", rowId: "s1", label: "Courtyard" },
  { slot: "scene.poster", rowId: "s1", label: "Courtyard" },
  { slot: "destination.hero", rowId: "d1", label: "MUCHO" },
  { slot: "destination.pinIcon", rowId: "d1", label: "MUCHO" },
];

describe("planReplacement", () => {
  it("marks a 360 photo eligible for the slots that take one", () => {
    const plan = planReplacement({ uses, replacementKind: "photo_360" });
    const by = Object.fromEntries(plan.planned.map((p) => [p.slot, p.eligible]));
    expect(by["scene.panorama"]).toBe(true);
    expect(by["scene.poster"]).toBe(true);
    expect(by["destination.hero"]).toBe(true);
    // A pin icon must be a flat image — a 360 photo is not one.
    expect(by["destination.pinIcon"]).toBe(false);
  });

  it("marks a flat image ineligible as a panorama", () => {
    const plan = planReplacement({ uses, replacementKind: "image" });
    const by = Object.fromEntries(plan.planned.map((p) => [p.slot, p.eligible]));
    expect(by["scene.panorama"]).toBe(false);
    expect(by["destination.pinIcon"]).toBe(true);
  });

  it("makes audio ineligible everywhere in a visual file's slots", () => {
    const plan = planReplacement({ uses, replacementKind: "audio" });
    expect(plan.eligibleCount).toBe(0);
    expect(plan.ineligibleCount).toBe(4);
  });

  it("explains WHY a slot is ineligible, naming both sides", () => {
    // "Not allowed here" tells a creator nothing actionable.
    const plan = planReplacement({ uses, replacementKind: "audio" });
    const panorama = plan.planned.find((p) => p.slot === "scene.panorama")!;
    expect(panorama.reason).toContain("photo_360");
    expect(panorama.reason).toContain("audio");
  });

  it("counts eligible and ineligible separately", () => {
    const plan = planReplacement({ uses, replacementKind: "photo_360" });
    expect(plan.eligibleCount + plan.ineligibleCount).toBe(uses.length);
  });

  it("handles a file that is used nowhere", () => {
    const plan = planReplacement({ uses: [], replacementKind: "image" });
    expect(plan.planned).toEqual([]);
    expect(plan.eligibleCount).toBe(0);
  });
});

describe("selectableSlots", () => {
  it("keeps only the chosen slots that are eligible", () => {
    const plan = planReplacement({ uses, replacementKind: "photo_360" });
    const chosen = selectableSlots(plan, [
      { slot: "scene.panorama", rowId: "s1" },
      { slot: "destination.pinIcon", rowId: "d1" }, // ineligible for a 360
    ]);
    expect(chosen).toEqual([{ slot: "scene.panorama", rowId: "s1" }]);
  });

  it("drops a slot the file is not actually used in", () => {
    // The selection arrives from the client. A crafted request must not reach
    // a row this file never occupied.
    const plan = planReplacement({ uses, replacementKind: "photo_360" });
    expect(selectableSlots(plan, [{ slot: "scene.panorama", rowId: "SOMEONE-ELSE" }])).toEqual([]);
  });

  it("distinguishes the same slot kind on different rows", () => {
    const plan = planReplacement({
      uses: [
        { slot: "scene.panorama", rowId: "a", label: "A" },
        { slot: "scene.panorama", rowId: "b", label: "B" },
      ],
      replacementKind: "photo_360",
    });
    expect(selectableSlots(plan, [{ slot: "scene.panorama", rowId: "b" }])).toEqual([
      { slot: "scene.panorama", rowId: "b" },
    ]);
  });

  it("returns nothing for an empty selection", () => {
    const plan = planReplacement({ uses, replacementKind: "photo_360" });
    expect(selectableSlots(plan, [])).toEqual([]);
  });
});
