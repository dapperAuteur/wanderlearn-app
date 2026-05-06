"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publishScene, unpublishScene } from "@/lib/actions/scenes";
import type { Locale } from "@/lib/locales";

type SceneStatus = "draft" | "published" | "unpublished";

type Dict = {
  heading: string;
  intro: string;
  currentStatusLabel: string;
  statuses: Record<SceneStatus, string>;
  publishCta: string;
  publishingLabel: string;
  unpublishCta: string;
  unpublishingLabel: string;
  liveBadge: string;
  draftBadge: string;
  unpublishedBadge: string;
  genericError: string;
};

export function ScenePublishControls({
  lang,
  destinationId,
  sceneId,
  status,
  dict,
}: {
  lang: Locale;
  destinationId: string;
  sceneId: string;
  status: SceneStatus;
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(action: typeof publishScene | typeof unpublishScene) {
    setError(null);
    const formData = new FormData();
    formData.set("lang", lang);
    formData.set("sceneId", sceneId);
    formData.set("destinationId", destinationId);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.refresh();
      } else {
        setError(dict.genericError);
      }
    });
  }

  const isPublished = status === "published";
  const badgeTone = isPublished
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300"
    : status === "unpublished"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:border-amber-400/40 dark:text-amber-200"
      : "border-zinc-400/40 bg-zinc-400/10 text-zinc-700 dark:border-zinc-300/40 dark:text-zinc-200";

  return (
    <section
      aria-labelledby="scene-publish-heading"
      className="rounded-lg border border-black/10 p-5 dark:border-white/15"
    >
      <h2 id="scene-publish-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      <p className="mt-4 flex items-center gap-2 text-sm">
        <span className="font-semibold">{dict.currentStatusLabel}:</span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeTone}`}
        >
          {dict.statuses[status]}
        </span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isPublished ? (
          <button
            type="button"
            onClick={() => submit(unpublishScene)}
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-amber-500/50 px-6 text-base font-semibold text-amber-900 hover:bg-amber-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-amber-400/50 dark:text-amber-200"
          >
            {pending ? dict.unpublishingLabel : dict.unpublishCta}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit(publishScene)}
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pending ? dict.publishingLabel : dict.publishCta}
          </button>
        )}
        {error ? (
          <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
