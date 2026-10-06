"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { Locale } from "@/lib/locales";
import { previewPrivacyEdit } from "@/lib/actions/privacy-edits";
import { isPrivacyRecipeEmpty, type PrivacyRecipe } from "@/lib/privacy-edit";
import { ApplyEditControls } from "./apply-edit-controls";
import { BottomCoverControls } from "./bottom-cover-controls";
import { BoxControls } from "./box-controls";
import { editErrorMessage, paintPatchFor } from "./patch-painter";
import type { ClickMode, ImageEditSetup, PrivacyEditDict } from "./privacy-types";

/** A preview on screen, and the recipe it was made from (to spot a stale one). */
export type PreviewState = { url: string; recipeKey: string };


/**
 * Photo edits for one scene: faces, boxes, the bottom cover, then preview and save.
 * Nothing touches the photo until the creator saves, and saving makes a new file.
 */
export function ImageEditPanel({
  setup,
  sceneId,
  destinationId,
  lang,
  recipe,
  onRecipeChange,
  clickMode,
  onClickModeChange,
  selectedBoxId,
  onSelectBox,
  onMoveBoxToCenter,
  preview,
  onPreviewChange,
  onShowPreviewChange,
  dict,
}: {
  setup: ImageEditSetup;
  sceneId: string;
  destinationId: string;
  lang: Locale;
  recipe: PrivacyRecipe;
  onRecipeChange: Dispatch<SetStateAction<PrivacyRecipe>>;
  clickMode: ClickMode;
  onClickModeChange: (mode: ClickMode) => void;
  selectedBoxId: string | null;
  onSelectBox: (id: string | null) => void;
  onMoveBoxToCenter: (boxId: string) => void;
  preview: PreviewState | null;
  onPreviewChange: (preview: PreviewState | null) => void;
  /** Switch the viewer to the preview once one exists. The toggle lives under the viewer. */
  onShowPreviewChange: (show: boolean) => void;
  dict: PrivacyEditDict;
}) {
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "working" } | { kind: "ready" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const empty = isPrivacyRecipeEmpty(recipe);
  const recipeKey = JSON.stringify(recipe);
  const stale = preview !== null && preview.recipeKey !== recipeKey;

  async function onPreview() {
    setStatus({ kind: "working" });
    let patchDataUrl: string | null;
    try {
      patchDataUrl = await paintPatchFor(recipe, setup.logoOptions);
    } catch {
      setStatus({ kind: "error", message: dict.patchLogoError });
      return;
    }
    const result = await previewPrivacyEdit({
      sceneId,
      destinationId,
      lang,
      currentMediaId: setup.currentMediaId,
      recipe,
      patchDataUrl,
    });
    if (!result.ok) {
      setStatus({ kind: "error", message: editErrorMessage(result.code, dict) });
      return;
    }
    onPreviewChange({ url: result.data.url, recipeKey });
    onShowPreviewChange(true);
    setStatus({ kind: "ready" });
  }

  return (
    <section
      aria-labelledby="image-edit-heading"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 id="image-edit-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      {setup.basis !== "original" ? (
        <p
          role="note"
          className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
        >
          {setup.basis === "fromOriginal" ? dict.editedCopyNotice : dict.originalGoneNotice}
        </p>
      ) : null}

      <BoxControls
        recipe={recipe}
        onRecipeChange={onRecipeChange}
        clickMode={clickMode}
        onClickModeChange={onClickModeChange}
        selectedBoxId={selectedBoxId}
        onSelectBox={onSelectBox}
        onMoveBoxToCenter={onMoveBoxToCenter}
        dict={dict}
      />

      <BottomCoverControls
        recipe={recipe}
        onRecipeChange={onRecipeChange}
        logoOptions={setup.logoOptions}
        dict={dict}
      />

      <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/15">
        <button
          type="button"
          onClick={onPreview}
          disabled={status.kind === "working" || empty}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 sm:w-auto"
        >
          {status.kind === "working" ? dict.previewingLabel : dict.previewCta}
        </button>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{dict.previewNote}</p>
        <div role="status" aria-live="polite" className="mt-2 text-sm">
          {stale ? (
            <p className="text-amber-800 dark:text-amber-300">{dict.previewStale}</p>
          ) : status.kind === "ready" ? (
            <p className="text-emerald-700 dark:text-emerald-300">{dict.previewReady}</p>
          ) : null}
        </div>
        {status.kind === "error" ? (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {status.message}
          </p>
        ) : null}
      </div>

      <ApplyEditControls
        setup={setup}
        sceneId={sceneId}
        destinationId={destinationId}
        lang={lang}
        recipe={recipe}
        disabled={empty || status.kind === "working"}
        onApplied={() => {
          // The page reloads with the edited copy as the scene's photo; an old preview
          // would now describe the wrong file.
          onPreviewChange(null);
          setStatus({ kind: "idle" });
        }}
        dict={dict}
      />
    </section>
  );
}
