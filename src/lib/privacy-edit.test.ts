import { describe, expect, it } from "vitest";
import {
  PRIVACY_MAX_BOXES,
  boxContains,
  boxOutline,
  boxRects,
  emptyPrivacyRecipe,
  isPrivacyRecipeEmpty,
  layerId,
  parseStoredRecipe,
  privacyRecipeSchema,
  privacyTransformation,
  relativeValue,
  usesGenerativeAi,
  type PrivacyRecipe,
  moveBoxTo,
  resizeBoxFromCorner,
  boxHandlePoints,
  PRIVACY_BOX_EDIT_LIMITS,
} from "./privacy-edit";

function recipe(partial: Partial<PrivacyRecipe>): PrivacyRecipe {
  return { ...emptyPrivacyRecipe(), ...partial };
}

describe("relativeValue", () => {
  it("writes fractions with a decimal point, to the two places Cloudinary keeps", () => {
    expect(relativeValue(0.25)).toBe("0.25");
    expect(relativeValue(1)).toBe("1.0");
    expect(relativeValue(0)).toBe("0");
    expect(relativeValue(0.00001)).toBe("0");
  });
});

describe("boxRects", () => {
  it("keeps a box in the middle as one rectangle", () => {
    const rects = boxRects({ u: 0.5, v: 0.5, w: 0.1, h: 0.2 });
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(0.45, 9);
    expect(rects[0].y).toBeCloseTo(0.4, 9);
    expect(rects[0].w).toBeCloseTo(0.1, 9);
    expect(rects[0].h).toBeCloseTo(0.2, 9);
  });

  it("splits a box that crosses the left edge into two", () => {
    const rects = boxRects({ u: 0.02, v: 0.5, w: 0.1, h: 0.2 });
    expect(rects).toHaveLength(2);
    expect(rects[0].x).toBeCloseTo(0.97, 9);
    expect(rects[0].w).toBeCloseTo(0.03, 9);
    expect(rects[1]).toMatchObject({ x: 0 });
    expect(rects[1].w).toBeCloseTo(0.07, 9);
  });

  it("splits a box that crosses the right edge into two", () => {
    const rects = boxRects({ u: 0.99, v: 0.5, w: 0.1, h: 0.2 });
    expect(rects).toHaveLength(2);
    expect(rects[0].x).toBeCloseTo(0.94, 9);
    expect(rects[0].w).toBeCloseTo(0.06, 9);
    expect(rects[1].w).toBeCloseTo(0.04, 9);
  });

  it("clamps at the top and bottom instead of wrapping", () => {
    const [rect] = boxRects({ u: 0.5, v: 0.95, w: 0.1, h: 0.2 });
    expect(rect.y).toBeCloseTo(0.85, 9);
    expect(rect.h).toBeCloseTo(0.15, 9);
  });
});

describe("privacyTransformation", () => {
  it("is empty for an empty recipe", () => {
    expect(privacyTransformation(emptyPrivacyRecipe())).toEqual([]);
    expect(isPrivacyRecipeEmpty(emptyPrivacyRecipe())).toBe(true);
  });

  it("detects faces before any box changes the pixels", () => {
    const tx = privacyTransformation(
      recipe({
        faces: "pixelate",
        boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.1, h: 0.2 }],
      }),
    );
    expect(tx[0]).toBe("e_pixelate_faces:30");
    expect(tx[1]).toBe("e_pixelate_region:40,x_0.45,y_0.40,w_0.10,h_0.20");
  });

  it("uses the blur effect when the box style is blur", () => {
    const tx = privacyTransformation(
      recipe({ boxStyle: "blur", boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.1, h: 0.2 }] }),
    );
    expect(tx).toEqual(["e_blur_region:2000,x_0.45,y_0.40,w_0.10,h_0.20"]);
  });

  it("emits two regions for a box across the seam", () => {
    const tx = privacyTransformation(recipe({ boxes: [{ id: "a", u: 0.01, v: 0.5, w: 0.1, h: 0.2 }] }));
    expect(tx).toHaveLength(2);
  });

  it("covers the bottom from the right line down, full width", () => {
    expect(
      privacyTransformation(recipe({ bottom: { mode: "blur", angleDeg: 36 } })),
    ).toEqual(["e_blur_region:2000,y_0.80"]);
    expect(
      privacyTransformation(recipe({ bottom: { mode: "pixelate", angleDeg: 36 } })),
    ).toEqual(["e_pixelate_region:60,y_0.80"]);
  });

  it("lays a patch strip over the bottom, sized relative to the photo", () => {
    expect(
      privacyTransformation(
        recipe({ bottom: { mode: "patch", angleDeg: 27, patch: { color: "#000000", logoMediaId: null } } }),
        { patchPublicId: "wanderlearn/media/privacy-patches/abc" },
      ),
    ).toEqual([
      "l_wanderlearn:media:privacy-patches:abc",
      "c_scale,fl_relative,w_1.0,h_0.15",
      "fl_layer_apply,g_south",
    ]);
  });

  // The bug behind improvement 41: Cloudinary keeps two decimal places of a fraction, so
  // x_0.4778,w_0.0444 pixelated 0.47 to 0.51 and left the right of the box uncovered.
  it("writes box regions in whole pixels when the photo's size is known", () => {
    const tx = privacyTransformation(
      recipe({ boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.0444, h: 0.25 }] }),
      { imageSize: { width: 3000, height: 1500 } },
    );
    // 0.4778 * 3000 = 1433.4 and 0.5222 * 3000 = 1566.6: grown out to whole pixels.
    expect(tx).toEqual(["e_pixelate_region:40,x_1433,y_562,w_134,h_376"]);
  });

  it("rounds fractions outward when the size is unknown, so a box never shrinks", () => {
    const [tx] = privacyTransformation(recipe({ boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.0444, h: 0.25 }] }));
    // 0.4778 to 0.5222 becomes 0.47 to 0.53, never the 0.47 to 0.51 Cloudinary made of it.
    expect(tx).toBe("e_pixelate_region:40,x_0.47,y_0.37,w_0.06,h_0.26");
  });

  it("covers the bottom in pixels, and sizes the patch up rather than down", () => {
    const size = { width: 5900, height: 2950 };
    expect(
      privacyTransformation(recipe({ bottom: { mode: "pixelate", angleDeg: 25 } }), { imageSize: size }),
    ).toEqual(["e_pixelate_region:60,y_2540"]);
    expect(
      privacyTransformation(
        recipe({ bottom: { mode: "patch", angleDeg: 25, patch: { color: "#000000", logoMediaId: null } } }),
        { patchPublicId: "p", imageSize: size },
      )[1],
    ).toBe("c_scale,w_5900,h_410");
  });

  it("falls back to fractions after generative AI on a photo too big for it", () => {
    const tx = privacyTransformation(
      recipe({ removeAllPeople: true, boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.1, h: 0.2 }] }),
      { imageSize: { width: 7680, height: 3840 } },
    );
    expect(tx[1]).toBe("e_pixelate_region:40,x_0.45,y_0.40,w_0.10,h_0.20");
  });

  it("skips a patch whose strip was never uploaded rather than emit a broken layer", () => {
    expect(
      privacyTransformation(recipe({ bottom: { mode: "patch", angleDeg: 27 } })),
    ).toEqual([]);
  });
});

describe("layerId", () => {
  it("writes folders with colons", () => {
    expect(layerId("wanderlearn/media/x")).toBe("wanderlearn:media:x");
  });
});

describe("privacyRecipeSchema", () => {
  it("rejects more boxes than the URL can carry", () => {
    const boxes = Array.from({ length: PRIVACY_MAX_BOXES + 1 }, (_, i) => ({
      id: `b${i}`,
      u: 0.5,
      v: 0.5,
      w: 0.05,
      h: 0.1,
    }));
    expect(privacyRecipeSchema.safeParse(recipe({ boxes })).success).toBe(false);
  });

  it("rejects a box too small to hide anything", () => {
    expect(
      privacyRecipeSchema.safeParse(recipe({ boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.001, h: 0.1 }] }))
        .success,
    ).toBe(false);
  });

  it("parses a stored recipe and refuses garbage", () => {
    expect(parseStoredRecipe(emptyPrivacyRecipe())).toEqual(emptyPrivacyRecipe());
    expect(parseStoredRecipe({ faces: "maybe" })).toBeNull();
    expect(parseStoredRecipe(null)).toBeNull();
  });
});

describe("outlines and hit testing", () => {
  it("closes a box outline with points on every edge", () => {
    const pts = boxOutline({ u: 0.5, v: 0.5, w: 0.1, h: 0.2 });
    expect(pts.length).toBeGreaterThan(8);
    expect(pts[0].u).toBeCloseTo(0.45, 9);
    expect(pts[0].v).toBeCloseTo(0.4, 9);
  });

  it("finds a click inside a box, including across the seam", () => {
    const box = { u: 0.01, v: 0.5, w: 0.1, h: 0.2 };
    expect(boxContains(box, { u: 0.99, v: 0.5 })).toBe(true);
    expect(boxContains(box, { u: 0.04, v: 0.5 })).toBe(true);
    expect(boxContains(box, { u: 0.5, v: 0.5 })).toBe(false);
  });
});

describe("generative remove", () => {
  const size = { width: 6000, height: 3000 };

  it("is off unless asked for", () => {
    expect(usesGenerativeAi(emptyPrivacyRecipe())).toBe(false);
    expect(
      usesGenerativeAi(recipe({ boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.1, h: 0.2 }] })),
    ).toBe(false);
  });

  it("counts removing every person as AI, and as an edit", () => {
    const r = recipe({ removeAllPeople: true });
    expect(usesGenerativeAi(r)).toBe(true);
    expect(isPrivacyRecipeEmpty(r)).toBe(false);
    expect(privacyTransformation(r, { imageSize: size })).toEqual([
      "e_gen_remove:prompt_person;multiple_true",
    ]);
  });

  it("sends removal boxes as pixel regions, first, and does not also blur them", () => {
    const r = recipe({
      boxStyle: "remove",
      faces: "pixelate",
      boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.1, h: 0.2 }],
    });
    expect(usesGenerativeAi(r)).toBe(true);
    expect(privacyTransformation(r, { imageSize: size })).toEqual([
      "e_gen_remove:region_((x_2700;y_1200;w_600;h_600))",
      "e_pixelate_faces:30",
    ]);
  });

  it("splits a removal box across the seam into two regions", () => {
    const tx = privacyTransformation(
      recipe({ boxStyle: "remove", boxes: [{ id: "a", u: 0.01, v: 0.5, w: 0.1, h: 0.2 }] }),
      { imageSize: size },
    );
    expect(tx[0]).toBe("e_gen_remove:region_((x_5760;y_1200;w_240;h_600);(x_0;y_1200;w_360;h_600))");
  });

  it("skips removal boxes rather than guess pixels without a size", () => {
    expect(
      privacyTransformation(recipe({ boxStyle: "remove", boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.1, h: 0.2 }] })),
    ).toEqual([]);
  });
});

describe("direct manipulation (improvement 40)", () => {
  const box = { id: "b", u: 0.5, v: 0.5, w: 0.1, h: 0.2 };
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

  it("moveBoxTo follows the point, wraps the seam and stays inside top and bottom", () => {
    expect(moveBoxTo(box, { u: 0.25, v: 0.4 })).toMatchObject({ u: 0.25, v: 0.4, w: 0.1, h: 0.2 });
    expect(moveBoxTo(box, { u: 1.05, v: 0.5 }).u).toBeCloseTo(0.05);
    expect(moveBoxTo(box, { u: 0.5, v: 0.02 }).v).toBeCloseTo(0.1);
  });

  it("resizeBoxFromCorner keeps the opposite corner fixed", () => {
    // Drag the bottom-right corner out; the top-left (0.45, 0.4) stays.
    const r = resizeBoxFromCorner(box, "se", { u: 0.6, v: 0.7 });
    expect(near(r.u - r.w / 2, 0.45)).toBe(true);
    expect(near(r.v - r.h / 2, 0.4)).toBe(true);
    expect(near(r.w, 0.15)).toBe(true);
    expect(near(r.h, 0.3)).toBe(true);
  });

  it("flips past the opposite corner instead of inverting, and respects the limits", () => {
    const flipped = resizeBoxFromCorner(box, "se", { u: 0.4, v: 0.3 });
    expect(flipped.w).toBeGreaterThan(0);
    expect(flipped.u).toBeLessThan(0.45);
    const tiny = resizeBoxFromCorner(box, "se", { u: 0.45, v: 0.4 });
    expect(near(tiny.w, PRIVACY_BOX_EDIT_LIMITS.minW)).toBe(true);
    expect(near(tiny.h, PRIVACY_BOX_EDIT_LIMITS.minH)).toBe(true);
    const huge = resizeBoxFromCorner(box, "se", { u: 0.95, v: 1 });
    expect(huge.w).toBeLessThanOrEqual(PRIVACY_BOX_EDIT_LIMITS.maxW);
  });

  it("drags across the seam the short way", () => {
    const edge = { id: "e", u: 0.02, v: 0.5, w: 0.04, h: 0.2 };
    // Pull the left edge (nw corner) across the seam to u = 0.98.
    const r = resizeBoxFromCorner(edge, "nw", { u: 0.98, v: 0.4 });
    expect(near(r.w, 0.06)).toBe(true);
  });

  it("boxHandlePoints puts handles at the centre and corners", () => {
    const h = boxHandlePoints(box);
    expect(h.move).toEqual({ u: 0.5, v: 0.5 });
    expect(near(h.nw.u, 0.45) && near(h.nw.v, 0.4)).toBe(true);
    expect(near(h.se.u, 0.55) && near(h.se.v, 0.6)).toBe(true);
  });
});
