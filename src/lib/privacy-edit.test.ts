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
  type PrivacyRecipe,
} from "./privacy-edit";

function recipe(partial: Partial<PrivacyRecipe>): PrivacyRecipe {
  return { ...emptyPrivacyRecipe(), ...partial };
}

describe("relativeValue", () => {
  it("writes fractions with a decimal point so Cloudinary reads them as relative", () => {
    expect(relativeValue(0.25)).toBe("0.2500");
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
    expect(tx[1]).toBe("e_pixelate_region:40,x_0.4500,y_0.4000,w_0.1000,h_0.2000");
  });

  it("uses the blur effect when the box style is blur", () => {
    const tx = privacyTransformation(
      recipe({ boxStyle: "blur", boxes: [{ id: "a", u: 0.5, v: 0.5, w: 0.1, h: 0.2 }] }),
    );
    expect(tx).toEqual(["e_blur_region:2000,x_0.4500,y_0.4000,w_0.1000,h_0.2000"]);
  });

  it("emits two regions for a box across the seam", () => {
    const tx = privacyTransformation(recipe({ boxes: [{ id: "a", u: 0.01, v: 0.5, w: 0.1, h: 0.2 }] }));
    expect(tx).toHaveLength(2);
  });

  it("covers the bottom from the right line down, full width", () => {
    expect(
      privacyTransformation(recipe({ bottom: { mode: "blur", angleDeg: 36 } })),
    ).toEqual(["e_blur_region:2000,y_0.8000"]);
    expect(
      privacyTransformation(recipe({ bottom: { mode: "pixelate", angleDeg: 36 } })),
    ).toEqual(["e_pixelate_region:60,y_0.8000"]);
  });

  it("lays a patch strip over the bottom, sized relative to the photo", () => {
    expect(
      privacyTransformation(
        recipe({ bottom: { mode: "patch", angleDeg: 27, patch: { color: "#000000", logoMediaId: null } } }),
        { patchPublicId: "wanderlearn/media/privacy-patches/abc" },
      ),
    ).toEqual([
      "l_wanderlearn:media:privacy-patches:abc",
      "c_scale,fl_relative,w_1.0,h_0.1500",
      "fl_layer_apply,g_south",
    ]);
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
