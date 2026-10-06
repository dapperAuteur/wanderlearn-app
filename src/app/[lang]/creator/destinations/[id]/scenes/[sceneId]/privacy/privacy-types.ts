import type en from "@/app/[lang]/dictionaries/en.json";
import type { PrivacyRecipe } from "@/lib/privacy-edit";

/** Strings for the photo editor. Type-only: the JSON never reaches the client bundle from here. */
export type PrivacyEditDict = (typeof en)["creator"]["scenes"]["privacy"]["edit"];

/** An image from the creator's library that can go in the middle of a bottom patch. */
export type LogoOption = { id: string; name: string; url: string };

/**
 * What the photo editor starts from.
 *
 * - "original": the scene shows an unedited photo.
 * - "fromOriginal": it shows an edited copy whose original still exists; edits are
 *   rebuilt from the original and the saved recipe is loaded, so blur never stacks.
 * - "onCopy": it shows an edited copy whose original was deleted; edits stack on it.
 */
export interface ImageEditSetup {
  currentMediaId: string;
  basis: "original" | "fromOriginal" | "onCopy";
  initialRecipe: PrivacyRecipe | null;
  logoOptions: LogoOption[];
}

/** What a click on the viewer does right now. */
export type ClickMode = { kind: "idle" } | { kind: "add" } | { kind: "move"; boxId: string };

/** The default patch colour: slate-800, dark enough to read as "nothing here". */
export const DEFAULT_PATCH_COLOR = "#1e293b";
