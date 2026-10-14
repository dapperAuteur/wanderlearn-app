import { z } from "zod";

/**
 * "Hide people and gear": the edit recipe a creator builds on a 360 photo, and the
 * Cloudinary transformation it becomes.
 *
 * Pure and shared. The editor uses it for outlines and validation, the server action
 * for the delivery URL it bakes into a new file. Coordinates are normalized to the
 * equirectangular image (u across, 0 to 1 from the left edge; v down, 0 to 1 from the
 * top), so a recipe survives any resize and never depends on the delivered resolution.
 *
 * Region effects are written in whole pixels of the photo being edited. Cloudinary also
 * reads fractions as shares of the image, but keeps only two decimal places of them
 * (checked on the live account 2026-10-14: `x_0.6199,w_0.1999` pixelated from 0.61 to
 * 0.80). The four-decimal fractions this file used to write were cut short, which moved
 * every box left and up and shrank it by up to 1% of the photo, 59 px on a 5900 px
 * panorama: "the box doesn't cover what I drew". Fractions remain the fallback, rounded
 * outward so a box never covers less than was drawn. See plans/13-hide-people-and-gear.md
 * and plans/app-improvements/41-privacy-box-misses-what-was-drawn.md.
 */

/** Most boxes one photo may carry. 24 boxes, even all wrapping the seam, is 48 regions: tested. */
export const PRIVACY_MAX_BOXES = 24;
/** Smallest box side, as a share of the image. Below this a box hides nothing. */
export const PRIVACY_MIN_BOX = 0.005;
/** Widest box: a third of the way round. Anything wider is a different tool. */
export const PRIVACY_MAX_BOX_W = 1 / 3;

/** Default box for a click: about 16 degrees wide and 45 tall, a standing adult a few metres off. */
export const PRIVACY_DEFAULT_BOX = { w: 16 / 360, h: 45 / 180 } as const;

/** Bottom cover size, in degrees up from straight down. */
export const PRIVACY_BOTTOM_MIN_DEG = 5;
export const PRIVACY_BOTTOM_MAX_DEG = 60;
export const PRIVACY_BOTTOM_DEFAULT_DEG = 25;

/**
 * Strengths. Fixed rather than offered as sliders: these are full-resolution panoramas
 * (5900 px wide in production), where a gentle setting leaves a face readable, and a
 * creator protecting someone should not have to discover that.
 */
export const PRIVACY_STRENGTH = {
  faceBlur: 1500, // e_blur_faces, 1 to 2000
  facePixelate: 30, // e_pixelate_faces square size, 1 to 200
  boxBlur: 2000, // e_blur_region, 1 to 2000
  boxPixelate: 40, // e_pixelate_region square size, 1 to 200
  bottomBlur: 2000,
  bottomPixelate: 60,
} as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const privacyBoxSchema = z.object({
  id: z.string().min(1).max(40),
  /** Centre, across. May sit anywhere; a box past an edge wraps round the seam. */
  u: z.number().min(0).max(1),
  /** Centre, down. */
  v: z.number().min(0).max(1),
  w: z.number().min(PRIVACY_MIN_BOX).max(PRIVACY_MAX_BOX_W),
  h: z.number().min(PRIVACY_MIN_BOX).max(1),
});

export const privacyRecipeSchema = z.object({
  faces: z.enum(["off", "blur", "pixelate"]),
  boxes: z.array(privacyBoxSchema).max(PRIVACY_MAX_BOXES),
  /**
   * "remove" sends the boxes to Cloudinary's generative remove, which paints in pixels
   * that were never photographed. Opt-in, acknowledged, and labeled to visitors: see
   * usesGenerativeAi and STYLE_GUIDE "Content policy".
   */
  boxStyle: z.enum(["blur", "pixelate", "remove"]),
  /** Generative remove of every person the model finds. Same rules as boxStyle "remove". */
  removeAllPeople: z.boolean().optional(),
  bottom: z.object({
    mode: z.enum(["off", "blur", "pixelate", "patch"]),
    angleDeg: z.number().min(PRIVACY_BOTTOM_MIN_DEG).max(PRIVACY_BOTTOM_MAX_DEG),
    /**
     * Only meaningful for mode "patch": what the browser painted into the patch. Kept in
     * the recipe so a later edit from the original can paint the same patch again.
     */
    patch: z
      .object({ color: hexColor, logoMediaId: z.string().uuid().nullable() })
      .optional(),
  }),
});

export type PrivacyBox = z.infer<typeof privacyBoxSchema>;
export type PrivacyRecipe = z.infer<typeof privacyRecipeSchema>;
export type PrivacyFaceMode = PrivacyRecipe["faces"];
export type PrivacyBoxStyle = PrivacyRecipe["boxStyle"];
export type PrivacyBottomMode = PrivacyRecipe["bottom"]["mode"];

export function emptyPrivacyRecipe(): PrivacyRecipe {
  return {
    faces: "off",
    boxes: [],
    boxStyle: "pixelate",
    bottom: { mode: "off", angleDeg: PRIVACY_BOTTOM_DEFAULT_DEG },
  };
}

/** True when the recipe would leave the photo exactly as it is. */
export function isPrivacyRecipeEmpty(recipe: PrivacyRecipe): boolean {
  return (
    recipe.faces === "off" &&
    recipe.boxes.length === 0 &&
    recipe.bottom.mode === "off" &&
    !recipe.removeAllPeople
  );
}

/**
 * True when the edit would paint pixels with generative AI.
 *
 * Wanderlust's content policy is that every pixel comes from someone who stood in the
 * place. BAM chose to allow one exception, removing people, on condition that it is
 * opt-in, acknowledged, recorded on the file, and visible to visitors. Everything that
 * enforces those conditions keys off this one function.
 */
export function usesGenerativeAi(recipe: PrivacyRecipe): boolean {
  return Boolean(recipe.removeAllPeople) || (recipe.boxStyle === "remove" && recipe.boxes.length > 0);
}

/** A recipe read back from stored metadata, or null if it no longer parses. */
export function parseStoredRecipe(value: unknown): PrivacyRecipe | null {
  const parsed = privacyRecipeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** An axis-aligned rectangle on the image, normalized, never crossing an edge. */
export type NormalizedRect = { x: number; y: number; w: number; h: number };

/**
 * The rectangle(s) a box covers. A box centred near the left or right edge continues on
 * the other side of the panorama, because those two edges are the same line in the room,
 * so it becomes two rectangles. Top and bottom are clamped instead: past the top of an
 * equirectangular image there is no "other side", only the same pole.
 */
export function boxRects(box: Pick<PrivacyBox, "u" | "v" | "w" | "h">): NormalizedRect[] {
  const w = Math.min(box.w, PRIVACY_MAX_BOX_W);
  const y0 = Math.max(0, box.v - box.h / 2);
  const y1 = Math.min(1, box.v + box.h / 2);
  const h = y1 - y0;
  const x0 = box.u - w / 2;
  const x1 = box.u + w / 2;
  if (x0 < 0) {
    return [
      { x: x0 + 1, y: y0, w: -x0, h },
      { x: 0, y: y0, w: x1, h },
    ];
  }
  if (x1 > 1) {
    return [
      { x: x0, y: y0, w: 1 - x0, h },
      { x: 0, y: y0, w: x1 - 1, h },
    ];
  }
  return [{ x: x0, y: y0, w, h }];
}

/**
 * A fraction in the form Cloudinary reads as relative, to the two decimal places it keeps.
 * A decimal point is what makes it relative, so 1 must be written "1.0" (a bare "1" is one
 * pixel). Zero is the same in both readings and is written plainly. Round before calling,
 * in the direction that keeps the cover whole: see floorHundredth and ceilHundredth.
 */
export function relativeValue(n: number): string {
  if (!(n >= 0.005)) return "0";
  if (n >= 1) return "1.0";
  return n.toFixed(2);
}

// The small nudges absorb float error (0.29 * 100 is 28.999999999999996).
const floorHundredth = (n: number) => Math.floor(n * 100 + 1e-9) / 100;
const ceilHundredth = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;
const floorPx = (n: number) => Math.floor(n + 1e-6);
const ceilPx = (n: number) => Math.ceil(n - 1e-6);

type PixelSize = { width: number; height: number };

/** A rectangle in whole pixels, grown outward to pixel edges and kept inside the photo. */
function pixelRect(rect: NormalizedRect, size: PixelSize) {
  const x = Math.max(0, floorPx(rect.x * size.width));
  const y = Math.max(0, floorPx(rect.y * size.height));
  const right = Math.min(size.width, ceilPx((rect.x + rect.w) * size.width));
  const bottom = Math.min(size.height, ceilPx((rect.y + rect.h) * size.height));
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

/** x/y/w/h for a region effect: pixels when the size is known, else hundredths rounded outward. */
function regionParams(rect: NormalizedRect, size: PixelSize | undefined): string {
  if (size) {
    const r = pixelRect(rect, size);
    return `x_${r.x},y_${r.y},w_${r.w},h_${r.h}`;
  }
  const x0 = Math.max(0, floorHundredth(rect.x));
  const y0 = Math.max(0, floorHundredth(rect.y));
  const x1 = Math.min(1, ceilHundredth(rect.x + rect.w));
  const y1 = Math.min(1, ceilHundredth(rect.y + rect.h));
  return `x_${relativeValue(x0)},y_${relativeValue(y0)},w_${relativeValue(x1 - x0)},h_${relativeValue(y1 - y0)}`;
}

/** Cloudinary's generative AI works on photos no larger than this on their longest side. */
const GEN_AI_MAX_SIDE = 6140;

/**
 * The size to write pixel regions against, or undefined to fall back to fractions. After
 * a generative step on a photo too big for it, Cloudinary may hand back the scaled-down
 * copy (its docs don't say), and pixels measured on the original would land wrong.
 */
function regionPixelSize(recipe: PrivacyRecipe, size: PixelSize | undefined): PixelSize | undefined {
  if (!size || !(size.width > 0) || !(size.height > 0)) return undefined;
  if (usesGenerativeAi(recipe) && Math.max(size.width, size.height) > GEN_AI_MAX_SIDE) return undefined;
  return size;
}

/** Cloudinary layer id for an asset: folders are written with colons. */
export function layerId(publicId: string): string {
  return publicId.replace(/\//g, ":");
}

export interface PrivacyTransformOptions {
  /**
   * Public id of the uploaded bottom patch strip. Required when bottom.mode is "patch";
   * without it the patch step is skipped rather than emitting a broken layer.
   */
  patchPublicId?: string;
  /**
   * The source image's pixel size. Generative remove regions are written in pixels (the
   * documented form); without a size, removal boxes are skipped rather than guessed.
   */
  imageSize?: { width: number; height: number };
}

/** Cloudinary documents x/y/w/h in pixels for generative remove regions. */
function genRemoveRegions(
  boxes: readonly PrivacyBox[],
  size: { width: number; height: number },
): string | null {
  const parts: string[] = [];
  for (const box of boxes) {
    for (const rect of boxRects(box)) {
      const r = pixelRect(rect, size);
      parts.push(`(x_${r.x};y_${r.y};w_${r.w};h_${r.h})`);
    }
  }
  // List form even for one region, e.g. region_((x_340;y_330;w_80;h_200)): verified on
  // the live account 2026-10-06.
  return parts.length > 0 ? `e_gen_remove:region_(${parts.join(";")})` : null;
}

/**
 * The recipe as ordered Cloudinary transformation components, one URL path segment each.
 *
 * Order matters: faces are detected on the untouched photo, before any box blurs a face
 * the detector could have found; boxes next; the bottom cover last so it sits on top.
 */
export function privacyTransformation(
  recipe: PrivacyRecipe,
  options: PrivacyTransformOptions = {},
): string[] {
  const out: string[] = [];

  // Generative removal first, on the photograph's own pixels: removing a person whose
  // face is already pixelated asks the model to work from damage. What follows it uses
  // pixels only when the AI's 6140 px downscale cannot apply (regionPixelSize).
  if (recipe.removeAllPeople) out.push("e_gen_remove:prompt_person;multiple_true");
  if (recipe.boxStyle === "remove" && options.imageSize) {
    const regions = genRemoveRegions(recipe.boxes, options.imageSize);
    if (regions) out.push(regions);
  }

  if (recipe.faces === "blur") out.push(`e_blur_faces:${PRIVACY_STRENGTH.faceBlur}`);
  if (recipe.faces === "pixelate") out.push(`e_pixelate_faces:${PRIVACY_STRENGTH.facePixelate}`);

  const boxEffect =
    recipe.boxStyle === "blur"
      ? `e_blur_region:${PRIVACY_STRENGTH.boxBlur}`
      : `e_pixelate_region:${PRIVACY_STRENGTH.boxPixelate}`;
  const px = regionPixelSize(recipe, options.imageSize);
  if (recipe.boxStyle !== "remove") {
    for (const box of recipe.boxes) {
      for (const rect of boxRects(box)) out.push(`${boxEffect},${regionParams(rect, px)}`);
    }
  }

  const coverShare = recipe.bottom.angleDeg / 180;
  // y alone: from that line to the bottom, full width. Rounded up the photo, so the cover
  // reaches at least as high as the ring drawn in the editor.
  const coverTop = px
    ? `y_${Math.max(0, floorPx((1 - coverShare) * px.height))}`
    : `y_${relativeValue(floorHundredth(1 - coverShare))}`;
  if (recipe.bottom.mode === "blur") {
    out.push(`e_blur_region:${PRIVACY_STRENGTH.bottomBlur},${coverTop}`);
  } else if (recipe.bottom.mode === "pixelate") {
    out.push(`e_pixelate_region:${PRIVACY_STRENGTH.bottomPixelate},${coverTop}`);
  } else if (recipe.bottom.mode === "patch" && options.patchPublicId) {
    out.push(`l_${layerId(options.patchPublicId)}`);
    // A cut-short height would leave the top of the tripod showing above the patch.
    out.push(
      px
        ? `c_scale,w_${px.width},h_${Math.min(px.height, ceilPx(coverShare * px.height))}`
        : `c_scale,fl_relative,w_1.0,h_${relativeValue(ceilHundredth(coverShare))}`,
    );
    out.push("fl_layer_apply,g_south");
  }

  return out;
}

/** A point on the image, normalized. Used for outlines drawn over the viewer. */
export type TexturePoint = { u: number; v: number };

/**
 * The outline of a box as points around its edge.
 *
 * Sampled densely because the viewer joins consecutive points with straight lines on
 * screen, while a box's top and bottom edges are curves on the sphere. One closed
 * polygon even across the seam: u past 0 or 1 still maps to the right direction.
 */
export function boxOutline(box: Pick<PrivacyBox, "u" | "v" | "w" | "h">): TexturePoint[] {
  const x0 = box.u - box.w / 2;
  const x1 = box.u + box.w / 2;
  const y0 = Math.max(0, box.v - box.h / 2);
  const y1 = Math.min(1, box.v + box.h / 2);
  const along = Math.max(2, Math.ceil((box.w * 360) / 3));
  const down = Math.max(2, Math.ceil((box.h * 180) / 3));
  const points: TexturePoint[] = [];
  for (let i = 0; i < along; i++) points.push({ u: x0 + ((x1 - x0) * i) / along, v: y0 });
  for (let i = 0; i < down; i++) points.push({ u: x1, v: y0 + ((y1 - y0) * i) / down });
  for (let i = 0; i < along; i++) points.push({ u: x1 - ((x1 - x0) * i) / along, v: y1 });
  for (let i = 0; i < down; i++) points.push({ u: x0, v: y1 - ((y1 - y0) * i) / down });
  return points;
}

/** The ring where a bottom cover of `angleDeg` ends, as seen from inside the sphere. */
export function bottomOutline(angleDeg: number): TexturePoint[] {
  const v = 1 - angleDeg / 180;
  const points: TexturePoint[] = [];
  for (let i = 0; i < 72; i++) points.push({ u: i / 72, v });
  return points;
}

/** Whether a clicked point falls inside a box, seam included. */
export function boxContains(box: Pick<PrivacyBox, "u" | "v" | "w" | "h">, p: TexturePoint): boolean {
  return boxRects(box).some(
    (r) => p.u >= r.x && p.u <= r.x + r.w && p.v >= r.y && p.v <= r.y + r.h,
  );
}

// ── Direct manipulation (improvement 40): drag a box, or drag its corners ──────────

/** What the width and height sliders allow, as shares of the image (2–120° wide, 2–150° tall). */
export const PRIVACY_BOX_EDIT_LIMITS = {
  minW: 2 / 360,
  maxW: PRIVACY_MAX_BOX_W,
  minH: 2 / 180,
  maxH: 150 / 180,
} as const;

export type BoxCorner = "nw" | "ne" | "sw" | "se";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Across the photo, 0..1 with the seam joined. */
const wrapU = (u: number) => ((u % 1) + 1) % 1;
/** The shortest signed step across, so a drag over the seam doesn't jump the long way round. */
const signedDu = (d: number) => ((((d + 0.5) % 1) + 1) % 1) - 0.5;

/** Moves a box's centre to a point, keeping it wholly between the top and bottom of the photo. */
export function moveBoxTo<B extends Pick<PrivacyBox, "u" | "v" | "w" | "h">>(box: B, at: TexturePoint): B {
  return { ...box, u: wrapU(at.u), v: clamp(at.v, box.h / 2, 1 - box.h / 2) };
}

/**
 * Resizes a box by dragging one corner to a point; the opposite corner stays put.
 * Dragging past the opposite corner flips the box rather than inverting it, and the
 * size stays within the slider limits.
 */
export function resizeBoxFromCorner<B extends Pick<PrivacyBox, "u" | "v" | "w" | "h">>(
  box: B,
  corner: BoxCorner,
  at: TexturePoint,
): B {
  const L = PRIVACY_BOX_EDIT_LIMITS;
  const anchorU = box.u + (corner.includes("w") ? box.w / 2 : -box.w / 2);
  const anchorV = box.v + (corner.includes("n") ? box.h / 2 : -box.h / 2);
  const du = signedDu(at.u - anchorU);
  const dv = at.v - anchorV;
  const w = clamp(Math.abs(du), L.minW, L.maxW);
  const h = clamp(Math.abs(dv), L.minH, L.maxH);
  // Which side of the anchor the box now lies on; a zero drag keeps the original side.
  const sideU = du === 0 ? (corner.includes("w") ? -1 : 1) : Math.sign(du);
  const sideV = dv === 0 ? (corner.includes("n") ? -1 : 1) : Math.sign(dv);
  return {
    ...box,
    w,
    h,
    u: wrapU(anchorU + (sideU * w) / 2),
    v: clamp(anchorV + (sideV * h) / 2, h / 2, 1 - h / 2),
  };
}

/** Where a box's drag handles sit: its centre, and each corner (top-left is "nw"). */
export function boxHandlePoints(box: Pick<PrivacyBox, "u" | "v" | "w" | "h">): Record<"move" | BoxCorner, TexturePoint> {
  const left = wrapU(box.u - box.w / 2);
  const right = wrapU(box.u + box.w / 2);
  const top = clamp(box.v - box.h / 2, 0, 1);
  const bottom = clamp(box.v + box.h / 2, 0, 1);
  return {
    move: { u: box.u, v: box.v },
    nw: { u: left, v: top },
    ne: { u: right, v: top },
    sw: { u: left, v: bottom },
    se: { u: right, v: bottom },
  };
}
