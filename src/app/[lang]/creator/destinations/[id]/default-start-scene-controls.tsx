"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { setDestinationDefaultStartScene } from "@/lib/actions/destinations";

export type DefaultStartSceneDict = {
  heading: string;
  intro: string;
  label: string;
  autoOption: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  emptyState: string;
  mismatchError: string;
  genericError: string;
};

type SceneOption = { id: string; name: string };

export function DefaultStartSceneControls({
  destinationId,
  lang,
  initialDefaultStartSceneId,
  scenes,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  initialDefaultStartSceneId: string | null;
  /** Scenes at this destination, sorted however the caller prefers. */
  scenes: SceneOption[];
  dict: DefaultStartSceneDict;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialDefaultStartSceneId ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onSave() {
    setError(null);
    setStatus("idle");
    const form = new FormData();
    form.set("id", destinationId);
    form.set("defaultStartSceneId", selected);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await setDestinationDefaultStartScene(form);
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
      aria-labelledby="default-start-scene-heading"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 id="default-start-scene-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      {scenes.length === 0 ? (
        <p className="mt-4 text-sm italic text-zinc-500 dark:text-zinc-400">
          {dict.emptyState}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="default-start-scene" className="text-sm font-medium">
              {dict.label}
            </label>
            <select
              id="default-start-scene"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={pending}
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20"
            >
              <option value="">{dict.autoOption}</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || selected === (initialDefaultStartSceneId ?? "")}
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
