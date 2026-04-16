"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

export type DestinationOption = {
  id: string;
  name: string;
  sceneCount: number;
};

export type SceneOption = {
  id: string;
  destinationId: string;
  name: string;
};

type Dict = {
  destinationLabel: string;
  destinationHelp: string;
  destinationEmpty: string;
  destinationEmptyCta: string;
  noScenesAtDestination: string;
  startSceneLabel: string;
  startSceneHelp: string;
  startSceneAutoOption: string;
  captionLabel: string;
  captionHelp: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
};

type ActionResult =
  | { ok: true; data: { id: string; lessonId: string; courseId: string } }
  | { ok: false; error: string; code: string };

export function VirtualTourBlockForm({
  lang,
  courseId,
  lessonId,
  destinations,
  scenes,
  destinationsHref,
  initial,
  dict,
  action,
  mode,
}: {
  lang: Locale;
  courseId: string;
  lessonId: string;
  destinations: DestinationOption[];
  scenes: SceneOption[];
  destinationsHref: string;
  initial?: { id?: string; destinationId?: string; startSceneId?: string; caption?: string };
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
  mode: "new" | "edit";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [destinationId, setDestinationId] = useState<string>(
    initial?.destinationId ?? destinations[0]?.id ?? "",
  );
  const [startSceneId, setStartSceneId] = useState<string>(initial?.startSceneId ?? "");

  const scenesAtDestination = useMemo(
    () => scenes.filter((s) => s.destinationId === destinationId),
    [scenes, destinationId],
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destinationId) return;
    const formData = new FormData(event.currentTarget);
    formData.set("lang", lang);
    formData.set("destinationId", destinationId);
    formData.set("startSceneId", startSceneId);
    if (mode === "new") {
      formData.set("lessonId", lessonId);
    } else if (initial?.id) {
      formData.set("id", initial.id);
    }
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        const flag = mode === "new" ? "block-created" : "block-saved";
        router.push(`/${lang}/creator/courses/${courseId}/lessons/${lessonId}?saved=${flag}`);
        router.refresh();
      } else {
        window.alert(dict.genericError);
      }
    });
  }

  if (destinations.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-black/15 p-6 text-center dark:border-white/20">
        <p className="text-base text-zinc-700 dark:text-zinc-200">{dict.destinationEmpty}</p>
        <Link
          href={destinationsHref}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.destinationEmptyCta}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="virtualTourDestination" className="text-sm font-medium">
          {dict.destinationLabel}
        </label>
        <select
          id="virtualTourDestination"
          value={destinationId}
          onChange={(e) => {
            setDestinationId(e.target.value);
            setStartSceneId("");
          }}
          required
          aria-describedby="vt-dest-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        >
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.sceneCount})
            </option>
          ))}
        </select>
        <p id="vt-dest-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.destinationHelp}
        </p>
      </div>

      {scenesAtDestination.length === 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:text-amber-300">
          {dict.noScenesAtDestination}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="virtualTourStart" className="text-sm font-medium">
            {dict.startSceneLabel}
          </label>
          <select
            id="virtualTourStart"
            value={startSceneId}
            onChange={(e) => setStartSceneId(e.target.value)}
            aria-describedby="vt-start-help"
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          >
            <option value="">{dict.startSceneAutoOption}</option>
            {scenesAtDestination.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p id="vt-start-help" className="text-xs text-zinc-600 dark:text-zinc-400">
            {dict.startSceneHelp}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="virtualTourCaption" className="text-sm font-medium">
          {dict.captionLabel}
        </label>
        <input
          id="virtualTourCaption"
          name="caption"
          type="text"
          maxLength={500}
          defaultValue={initial?.caption ?? ""}
          aria-describedby="vt-caption-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="vt-caption-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.captionHelp}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending || !destinationId || scenesAtDestination.length === 0}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.savingLabel : dict.saveCta}
        </button>
        <Link
          href={`/${lang}/creator/courses/${courseId}/lessons/${lessonId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
