"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { applyPrivacyEdit, revertPrivacyEdit } from "@/lib/actions/privacy-edits";
import type { PrivacyRecipe } from "@/lib/privacy-edit";
import { editErrorMessage, paintPatchFor } from "./patch-painter";
import type { ImageEditSetup, PrivacyEditDict } from "./privacy-types";

const radioClasses =
  "h-5 w-5 shrink-0 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

type Outcome =
  | { kind: "idle" }
  | { kind: "applied"; lines: string[] }
  | { kind: "reverted" }
  | { kind: "error"; message: string };

/**
 * Save the edit as a new photo and swap it in, or swap the original back.
 *
 * "Everywhere" is the default because the usual reason for this page is privacy, and a
 * person blurred in one scene but visible as the tour's hero image is not hidden.
 */
export function ApplyEditControls({
  setup,
  sceneId,
  destinationId,
  lang,
  recipe,
  aiAcknowledged,
  disabled,
  onApplied,
  dict,
}: {
  setup: ImageEditSetup;
  sceneId: string;
  destinationId: string;
  lang: Locale;
  recipe: PrivacyRecipe;
  aiAcknowledged: boolean;
  disabled: boolean;
  onApplied: () => void;
  dict: PrivacyEditDict;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"everywhere" | "scene">("everywhere");
  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"apply" | "revert" | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  function onApply() {
    setOutcome({ kind: "idle" });
    setAction("apply");
    startTransition(async () => {
      let patchDataUrl: string | null;
      try {
        patchDataUrl = await paintPatchFor(recipe, setup.logoOptions);
      } catch {
        setOutcome({ kind: "error", message: dict.patchLogoError });
        return;
      }
      const result = await applyPrivacyEdit({
        sceneId,
        destinationId,
        lang,
        currentMediaId: setup.currentMediaId,
        recipe,
        patchDataUrl,
        scope,
        aiAcknowledged,
        deleteOriginal: scope === "everywhere" && deleteOriginal,
        displayNameSuffix: dict.editedSuffix,
      });
      if (!result.ok) {
        setOutcome({ kind: "error", message: editErrorMessage(result.code, dict) });
        return;
      }
      const lines = [
        dict.appliedLabel.replace("{count}", String(result.data.replaced + result.data.blocks)),
      ];
      if (result.data.originalDeleted) lines.push(dict.originalDeletedLabel);
      else if (result.data.originalStillUsed > 0) {
        lines.push(dict.originalKeptLabel.replace("{count}", String(result.data.originalStillUsed)));
      }
      setOutcome({ kind: "applied", lines });
      setDeleteOriginal(false);
      onApplied();
      router.refresh();
    });
  }

  function onRevert() {
    setOutcome({ kind: "idle" });
    setAction("revert");
    startTransition(async () => {
      const result = await revertPrivacyEdit({
        sceneId,
        destinationId,
        lang,
        currentMediaId: setup.currentMediaId,
      });
      if (!result.ok) {
        setOutcome({ kind: "error", message: editErrorMessage(result.code, dict) });
        return;
      }
      setOutcome({ kind: "reverted" });
      onApplied();
      router.refresh();
    });
  }

  return (
    <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/15">
      <h3 className="text-base font-semibold">{dict.applyHeading}</h3>
      <fieldset className="mt-2">
        <legend className="text-sm font-medium">{dict.scopeLabel}</legend>
        <div className="mt-1 flex flex-col gap-1">
          {(
            [
              ["everywhere", dict.scopeEverywhere],
              ["scene", dict.scopeScene],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="privacy-scope"
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
                disabled={pending}
                className={radioClasses}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {scope === "everywhere" ? (
        <div className="mt-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={deleteOriginal}
              onChange={(e) => setDeleteOriginal(e.target.checked)}
              aria-describedby="privacy-delete-original-hint"
              disabled={pending}
              className="h-5 w-5 shrink-0 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            />
            <span>{dict.deleteOriginal}</span>
          </label>
          <p id="privacy-delete-original-hint" className="text-xs text-zinc-600 dark:text-zinc-400">
            {dict.deleteOriginalHint}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onApply}
        disabled={disabled || pending}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 sm:w-auto"
      >
        {pending && action === "apply" ? dict.applyingLabel : dict.applyCta}
      </button>

      {setup.basis === "fromOriginal" ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold">{dict.revertHeading}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.revertIntro}</p>
          <button
            type="button"
            onClick={onRevert}
            disabled={pending}
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
          >
            {pending && action === "revert" ? dict.revertingLabel : dict.revertCta}
          </button>
        </div>
      ) : null}

      <div role="status" aria-live="polite" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
        {outcome.kind === "applied" ? outcome.lines.map((line) => <p key={line}>{line}</p>) : null}
        {outcome.kind === "reverted" ? <p>{dict.revertedLabel}</p> : null}
      </div>
      {outcome.kind === "error" ? (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {outcome.message}
        </p>
      ) : null}
    </div>
  );
}
