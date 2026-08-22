"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { setDestinationPeakScene } from "@/lib/actions/destinations";

export type PeakSceneDict = {
  heading: string;
  intro: string;
  label: string;
  noneOption: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  emptyState: string;
  mismatchError: string;
  genericError: string;
};

type SceneOption = {
  id: string;
  name: string;
  /** The media file's current name, when it differs from the scene name. */
  fileName?: string | null;
};

/**
 * Lets a creator mark the high point of their tour.
 *
 * Deliberately a sibling of DefaultStartSceneControls rather than a field on
 * the main edit form: start, peak, and end are three different questions about
 * the same tour, and grouping them keeps a creator from setting one while
 * thinking about another. It is also the one setting here that asks for an
 * editorial judgement rather than a fact, which is worth its own space.
 */
export function PeakSceneControls({
  destinationId,
  lang,
  initialPeakSceneId,
  scenes,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  initialPeakSceneId: string | null;
  /** Scenes at this destination, in whatever order the caller prefers. */
  scenes: SceneOption[];
  dict: PeakSceneDict;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialPeakSceneId ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onSave() {
    setError(null);
    setStatus("idle");
    const form = new FormData();
    form.set("id", destinationId);
    form.set("peakSceneId", selected);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await setDestinationPeakScene(form);
      if (!result.ok) {
        setStatus("error");
        setError(result.code === "scene_mismatch" ? dict.mismatchError : dict.genericError);
        return;
      }
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  return (
    <section
      aria-labelledby="peak-scene-heading"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 id="peak-scene-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      {scenes.length === 0 ? (
        <p className="mt-4 text-sm italic text-zinc-500 dark:text-zinc-400">{dict.emptyState}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="peak-scene" className="text-sm font-medium">
              {dict.label}
            </label>
            <select
              id="peak-scene"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={pending}
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20"
            >
              <option value="">{dict.noneOption}</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fileName ? `${s.name} — ${s.fileName}` : s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || selected === (initialPeakSceneId ?? "")}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pending ? dict.savingLabel : status === "saved" ? `✓ ${dict.savedLabel}` : dict.saveCta}
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
