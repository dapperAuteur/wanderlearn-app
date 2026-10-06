"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  PRIVACY_BOTTOM_MAX_DEG,
  PRIVACY_BOTTOM_MIN_DEG,
  type PrivacyBottomMode,
  type PrivacyRecipe,
} from "@/lib/privacy-edit";
import { DEFAULT_PATCH_COLOR, type LogoOption, type PrivacyEditDict } from "./privacy-types";

const radioClasses =
  "h-5 w-5 shrink-0 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

/**
 * The floor under the camera: blur, pixelate, or a patch. The patch is painted in the
 * browser at preview and save time (see patch-painter.ts), so only its settings live here.
 */
export function BottomCoverControls({
  recipe,
  onRecipeChange,
  logoOptions,
  dict,
}: {
  recipe: PrivacyRecipe;
  onRecipeChange: Dispatch<SetStateAction<PrivacyRecipe>>;
  logoOptions: LogoOption[];
  dict: PrivacyEditDict;
}) {
  const bottom = recipe.bottom;
  const patch = bottom.patch ?? { color: DEFAULT_PATCH_COLOR, logoMediaId: null };
  const options: { value: PrivacyBottomMode; label: string }[] = [
    { value: "off", label: dict.bottomOff },
    { value: "blur", label: dict.bottomBlur },
    { value: "pixelate", label: dict.bottomPixelate },
    { value: "patch", label: dict.bottomPatch },
  ];
  const sizeText = dict.bottomSizeValue.replace("{n}", String(bottom.angleDeg));

  function setBottom(next: Partial<PrivacyRecipe["bottom"]>) {
    onRecipeChange((r) => ({ ...r, bottom: { ...r.bottom, ...next } }));
  }

  return (
    <div className="mt-6">
      <fieldset>
        <legend className="text-base font-semibold">{dict.bottomHeading}</legend>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.bottomIntro}</p>
        <div className="mt-2 flex flex-col gap-1">
          {options.map((o) => (
            <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="privacy-bottom"
                value={o.value}
                checked={bottom.mode === o.value}
                onChange={() =>
                  setBottom(o.value === "patch" ? { mode: o.value, patch } : { mode: o.value })
                }
                className={radioClasses}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {bottom.mode !== "off" ? (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor="privacy-bottom-size" className="flex flex-wrap justify-between gap-2 text-sm font-medium">
            <span>{dict.bottomSize}</span>
            <span className="font-mono tabular-nums">{sizeText}</span>
          </label>
          <input
            id="privacy-bottom-size"
            type="range"
            min={PRIVACY_BOTTOM_MIN_DEG}
            max={PRIVACY_BOTTOM_MAX_DEG}
            step={1}
            value={bottom.angleDeg}
            aria-valuetext={sizeText}
            onChange={(e) => setBottom({ angleDeg: Number(e.target.value) })}
            className="h-3 w-full cursor-pointer rounded-full bg-black/10 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-white/15"
          />
        </div>
      ) : null}

      {bottom.mode === "patch" ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="privacy-patch-color" className="text-sm font-medium">
              {dict.patchColor}
            </label>
            <input
              id="privacy-patch-color"
              type="color"
              value={patch.color}
              onChange={(e) => setBottom({ patch: { ...patch, color: e.target.value } })}
              className="h-11 w-20 cursor-pointer rounded-md border border-black/15 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="privacy-patch-logo" className="text-sm font-medium">
              {dict.patchLogo}
            </label>
            <select
              id="privacy-patch-logo"
              value={patch.logoMediaId ?? ""}
              aria-describedby="privacy-patch-logo-hint"
              onChange={(e) =>
                setBottom({ patch: { ...patch, logoMediaId: e.target.value || null } })
              }
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
            >
              <option value="">{dict.patchNoLogo}</option>
              {logoOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <p id="privacy-patch-logo-hint" className="text-xs text-zinc-600 dark:text-zinc-400">
              {dict.patchLogoHint}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
