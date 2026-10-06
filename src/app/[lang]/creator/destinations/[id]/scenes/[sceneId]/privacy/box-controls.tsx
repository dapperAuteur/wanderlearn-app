"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  PRIVACY_MAX_BOXES,
  type PrivacyBox,
  type PrivacyBoxStyle,
  type PrivacyFaceMode,
  type PrivacyRecipe,
} from "@/lib/privacy-edit";
import type { ClickMode, PrivacyEditDict } from "./privacy-types";

const smallButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5";
const radioClasses =
  "h-5 w-5 shrink-0 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";
const sliderClasses =
  "h-3 w-full cursor-pointer rounded-full bg-black/10 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-white/15";

/** Box sides are edited in degrees, which is how a creator thinks about a 360 photo. */
const WIDTH_DEG = { min: 2, max: 120 };
const HEIGHT_DEG = { min: 2, max: 150 };

/** Faces, then boxes: the two ways of hiding a person who is not under the camera. */
export function BoxControls({
  recipe,
  onRecipeChange,
  clickMode,
  onClickModeChange,
  selectedBoxId,
  onSelectBox,
  onMoveBoxToCenter,
  dict,
}: {
  recipe: PrivacyRecipe;
  onRecipeChange: Dispatch<SetStateAction<PrivacyRecipe>>;
  clickMode: ClickMode;
  onClickModeChange: (mode: ClickMode) => void;
  selectedBoxId: string | null;
  onSelectBox: (id: string | null) => void;
  onMoveBoxToCenter: (boxId: string) => void;
  dict: PrivacyEditDict;
}) {

  function updateBox(id: string, patch: Partial<PrivacyBox>) {
    onRecipeChange((r) => ({
      ...r,
      boxes: r.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function removeBox(id: string) {
    onRecipeChange((r) => ({ ...r, boxes: r.boxes.filter((b) => b.id !== id) }));
    if (selectedBoxId === id) onSelectBox(null);
    if (clickMode.kind === "move" && clickMode.boxId === id) onClickModeChange({ kind: "idle" });
  }

  const faceOptions: { value: PrivacyFaceMode; label: string }[] = [
    { value: "off", label: dict.facesOff },
    { value: "blur", label: dict.facesBlur },
    { value: "pixelate", label: dict.facesPixelate },
  ];
  const styleOptions: { value: PrivacyBoxStyle; label: string }[] = [
    { value: "pixelate", label: dict.boxStylePixelate },
    { value: "blur", label: dict.boxStyleBlur },
    // Generative: needs the acknowledgement in the AI section before preview or save.
    { value: "remove", label: dict.boxStyleRemove },
  ];

  return (
    <>
      <fieldset className="mt-6">
        <legend className="text-base font-semibold">{dict.facesHeading}</legend>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.facesIntro}</p>
        <div className="mt-2 flex flex-col gap-1">
          {faceOptions.map((o) => (
            <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="privacy-faces"
                value={o.value}
                checked={recipe.faces === o.value}
                onChange={() => onRecipeChange((r) => ({ ...r, faces: o.value }))}
                className={radioClasses}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <h3 className="text-base font-semibold">{dict.boxesHeading}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.boxesIntro.replace("{max}", String(PRIVACY_MAX_BOXES))}
        </p>

        <fieldset className="mt-3">
          <legend className="text-sm font-medium">{dict.boxStyleLabel}</legend>
          <div className="mt-1 flex flex-wrap gap-x-6">
            {styleOptions.map((o) => (
              <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="privacy-box-style"
                  value={o.value}
                  checked={recipe.boxStyle === o.value}
                  onChange={() => onRecipeChange((r) => ({ ...r, boxStyle: o.value }))}
                  className={radioClasses}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {recipe.boxes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{dict.noBoxes}</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {recipe.boxes.map((box, i) => {
              const n = i + 1;
              const label = dict.boxLabel.replace("{n}", String(n));
              const widthDeg = Math.round(box.w * 360);
              const heightDeg = Math.round(box.h * 180);
              const moving = clickMode.kind === "move" && clickMode.boxId === box.id;
              return (
                <li
                  key={box.id}
                  className={`rounded-md border p-3 ${
                    box.id === selectedBoxId
                      ? "border-amber-500 ring-2 ring-amber-500/40"
                      : "border-black/10 dark:border-white/15"
                  }`}
                >
                  <fieldset onFocus={() => onSelectBox(box.id)}>
                    <legend className="text-sm font-semibold">{label}</legend>
                    <label htmlFor={`box-w-${box.id}`} className="mt-2 flex justify-between text-sm">
                      <span>{dict.boxWidth}</span>
                      <span className="font-mono tabular-nums">
                        {dict.degreesValue.replace("{n}", String(widthDeg))}
                      </span>
                    </label>
                    <input
                      id={`box-w-${box.id}`}
                      type="range"
                      min={WIDTH_DEG.min}
                      max={WIDTH_DEG.max}
                      step={1}
                      value={widthDeg}
                      aria-valuetext={dict.degreesValue.replace("{n}", String(widthDeg))}
                      onChange={(e) => updateBox(box.id, { w: Number(e.target.value) / 360 })}
                      className={sliderClasses}
                    />
                    <label htmlFor={`box-h-${box.id}`} className="mt-2 flex justify-between text-sm">
                      <span>{dict.boxHeight}</span>
                      <span className="font-mono tabular-nums">
                        {dict.degreesValue.replace("{n}", String(heightDeg))}
                      </span>
                    </label>
                    <input
                      id={`box-h-${box.id}`}
                      type="range"
                      min={HEIGHT_DEG.min}
                      max={HEIGHT_DEG.max}
                      step={1}
                      value={heightDeg}
                      aria-valuetext={dict.degreesValue.replace("{n}", String(heightDeg))}
                      onChange={(e) => updateBox(box.id, { h: Number(e.target.value) / 180 })}
                      className={sliderClasses}
                    />
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        aria-pressed={moving}
                        onClick={() =>
                          onClickModeChange(moving ? { kind: "idle" } : { kind: "move", boxId: box.id })
                        }
                        className={smallButton}
                      >
                        {moving ? dict.moveBoxActive.replace("{n}", String(n)) : dict.moveBox}
                      </button>
                      <button type="button" onClick={() => onMoveBoxToCenter(box.id)} className={smallButton}>
                        {dict.centerBox}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBox(box.id)}
                        aria-label={`${dict.removeBox}: ${label}`}
                        className={smallButton}
                      >
                        {dict.removeBox}
                      </button>
                    </div>
                  </fieldset>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
