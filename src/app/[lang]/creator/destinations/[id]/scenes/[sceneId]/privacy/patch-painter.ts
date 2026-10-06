import { paintNadirPatch } from "@/lib/nadir-patch";
import type { PrivacyRecipe } from "@/lib/privacy-edit";
import { DEFAULT_PATCH_COLOR, type LogoOption, type PrivacyEditDict } from "./privacy-types";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Without this the canvas is tainted and cannot be read back. Cloudinary answers
    // with Access-Control-Allow-Origin: *.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("logo"));
    img.src = url;
  });
}

/**
 * Paint the bottom patch the recipe asks for, as a JPEG data URL, or null when the recipe
 * has no patch. Browser only. Throws "logo" when the chosen logo will not load.
 */
export async function paintPatchFor(
  recipe: PrivacyRecipe,
  logoOptions: LogoOption[],
): Promise<string | null> {
  if (recipe.bottom.mode !== "patch") return null;
  const patch = recipe.bottom.patch ?? { color: DEFAULT_PATCH_COLOR, logoMediaId: null };
  const logoUrl = patch.logoMediaId
    ? logoOptions.find((o) => o.id === patch.logoMediaId)?.url
    : undefined;
  const logo = logoUrl ? await loadImage(logoUrl) : null;
  return paintNadirPatch({ color: patch.color, angleDeg: recipe.bottom.angleDeg, logo });
}

/** A server action's error code, in the creator's words. */
export function editErrorMessage(code: string, dict: PrivacyEditDict): string {
  if (code === "processing") return dict.processingError;
  if (code === "stale") return dict.staleError;
  if (code === "empty") return dict.emptyError;
  if (code === "ai_not_acknowledged") return dict.aiNotAcknowledgedError;
  return dict.genericError;
}
