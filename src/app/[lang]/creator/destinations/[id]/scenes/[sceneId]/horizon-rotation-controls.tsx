"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { updateSceneRollOffset } from "@/lib/actions/scenes";

export type HorizonRotationDict = {
  heading: string;
  intro: string;
  label: string;
  helpAfterSave: string;
  resetCta: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  rangeError: string;
  genericError: string;
};

const MIN_DEG = -15;
const MAX_DEG = 15;
const STEP_DEG = 0.1;

export function HorizonRotationControls({
  sceneId,
  destinationId,
  lang,
  initialRollOffsetDeg,
  dict,
}: {
  sceneId: string;
  destinationId: string;
  lang: Locale;
  initialRollOffsetDeg: number | null;
  dict: HorizonRotationDict;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number>(initialRollOffsetDeg ?? 0);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const initial = initialRollOffsetDeg ?? 0;
  const dirty = Math.abs(value - initial) > 0.001;

  function onSave() {
    setError(null);
    setStatus("idle");
    if (value < MIN_DEG || value > MAX_DEG) {
      setStatus("error");
      setError(dict.rangeError);
      return;
    }
    const form = new FormData();
    form.set("sceneId", sceneId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    // Send empty string for 0 so the action stores null — "no correction"
    // and "0 degrees" are equivalent and we'd rather not pollute the DB.
    form.set("rollOffsetDeg", value === 0 ? "" : value.toFixed(2));
    startTransition(async () => {
      const result = await updateSceneRollOffset(form);
      if (!result.ok) {
        setStatus("error");
        setError(dict.genericError);
        return;
      }
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  function onReset() {
    setValue(0);
    setStatus("idle");
    setError(null);
  }

  return (
    <section
      aria-labelledby="horizon-rotation-heading"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 id="horizon-rotation-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      <div className="mt-4 flex flex-col gap-3">
        <label
          htmlFor="horizon-rotation-slider"
          className="flex items-center justify-between text-sm font-medium"
        >
          <span>{dict.label}</span>
          <span className="font-mono tabular-nums" aria-live="polite">
            {value.toFixed(1)}°
          </span>
        </label>
        <input
          id="horizon-rotation-slider"
          type="range"
          min={MIN_DEG}
          max={MAX_DEG}
          step={STEP_DEG}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          disabled={pending}
          className="h-3 w-full cursor-pointer rounded-full bg-black/10 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-white/15"
        />
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{dict.helpAfterSave}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !dirty}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.savingLabel : status === "saved" ? `✓ ${dict.savedLabel}` : dict.saveCta}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={pending || value === 0}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.resetCta}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
