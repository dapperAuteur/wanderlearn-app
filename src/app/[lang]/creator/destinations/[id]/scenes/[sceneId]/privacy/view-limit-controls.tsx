"use client";

import { useState, useTransition, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import type { VirtualTourViewerApi } from "@/components/virtual-tour/virtual-tour";
import { updateSceneMinPitch } from "@/lib/actions/scenes";
import {
  VIEW_LIMIT_DEFAULT_DEG,
  VIEW_LIMIT_MAX_DEG,
  VIEW_LIMIT_MIN_DEG,
} from "@/lib/view-limit";

export type ViewLimitDict = {
  heading: string;
  intro: string;
  toggleLabel: string;
  sliderLabel: string;
  valueBelow: string;
  valueHorizon: string;
  previewNote: string;
  privacyNote: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  genericError: string;
};

/** "50° below the horizon" for the screen and for assistive tech alike. */
function describe(deg: number, dict: ViewLimitDict): string {
  return deg >= 0 ? dict.valueHorizon : dict.valueBelow.replace("{degrees}", String(Math.abs(deg)));
}

export function ViewLimitControls({
  sceneId,
  destinationId,
  lang,
  initialMinPitchDeg,
  viewerApiRef,
  dict,
}: {
  sceneId: string;
  destinationId: string;
  lang: Locale;
  initialMinPitchDeg: number | null;
  /** Live preview target. Without it the control still saves; it just cannot preview. */
  viewerApiRef?: MutableRefObject<VirtualTourViewerApi | null>;
  dict: ViewLimitDict;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialMinPitchDeg !== null);
  const [value, setValue] = useState<number>(
    Math.round(initialMinPitchDeg ?? VIEW_LIMIT_DEFAULT_DEG),
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const saved = initialMinPitchDeg === null ? null : Math.round(initialMinPitchDeg);
  const current = enabled ? value : null;
  const dirty = current !== saved;

  function preview(next: number | null) {
    viewerApiRef?.current?.setMinPitch(next);
  }

  function onSave() {
    setStatus("idle");
    const form = new FormData();
    form.set("sceneId", sceneId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    // Empty clears the limit; the action stores null.
    form.set("minPitchDeg", current === null ? "" : String(current));
    startTransition(async () => {
      const result = await updateSceneMinPitch(form);
      if (!result.ok) {
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  return (
    <section
      aria-labelledby="view-limit-heading"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 id="view-limit-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            const next = e.target.checked;
            setEnabled(next);
            setStatus("idle");
            preview(next ? value : null);
          }}
          disabled={pending}
          className="h-5 w-5 shrink-0 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        />
        <span>{dict.toggleLabel}</span>
      </label>

      {enabled ? (
        <div className="mt-3 flex flex-col gap-3">
          <label
            htmlFor="view-limit-slider"
            className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium"
          >
            <span>{dict.sliderLabel}</span>
            <span className="font-mono tabular-nums" aria-live="polite">
              {describe(value, dict)}
            </span>
          </label>
          <input
            id="view-limit-slider"
            type="range"
            min={VIEW_LIMIT_MIN_DEG}
            max={VIEW_LIMIT_MAX_DEG}
            step={1}
            value={value}
            aria-valuetext={describe(value, dict)}
            onChange={(e) => {
              const next = Number(e.target.value);
              setValue(next);
              setStatus("idle");
              preview(next);
            }}
            disabled={pending}
            className="h-3 w-full cursor-pointer rounded-full bg-black/10 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-white/15"
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{dict.previewNote}</p>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{dict.privacyNote}</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !dirty}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.savingLabel : dict.saveCta}
        </button>
      </div>

      {status === "saved" ? (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
          {dict.savedLabel}
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {dict.genericError}
        </p>
      ) : null}
    </section>
  );
}
