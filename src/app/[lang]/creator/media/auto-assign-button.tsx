"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoAssignSceneMediaToDestinations } from "@/lib/actions/destination-media";
import type { MediaLibraryDict } from "@/components/media/media-library";
import type { Locale } from "@/lib/locales";

/**
 * One-click bulk backfill: promotes every scene-referenced panorama and
 * poster into an explicit assignment on that scene's tour. Additive and
 * idempotent (duplicate assignments are no-ops), so no confirm step.
 */
export function AutoAssignButton({
  dict,
  lang,
}: {
  dict: Pick<
    MediaLibraryDict,
    "autoAssignCta" | "autoAssignHelp" | "autoAssignDoneLabel" | "autoAssignNoneLabel" | "genericError"
  >;
  lang: Locale;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("lang", lang);
      const response = await autoAssignSceneMediaToDestinations(formData);
      if (!response.ok) {
        setError(response.error || dict.genericError);
        return;
      }
      setResult(response.data.assigned);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/15">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
        >
          {dict.autoAssignCta}
        </button>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{dict.autoAssignHelp}</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {result !== null ? (
        <p role="status" aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-400">
          {result > 0
            ? dict.autoAssignDoneLabel.replace("{count}", String(result))
            : dict.autoAssignNoneLabel}
        </p>
      ) : null}
    </div>
  );
}
