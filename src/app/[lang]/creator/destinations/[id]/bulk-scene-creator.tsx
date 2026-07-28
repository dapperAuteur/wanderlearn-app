"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkCreateScenes } from "@/lib/actions/scenes";
import type { Locale } from "@/lib/locales";

export type BulkSceneCandidate = {
  id: string;
  label: string;
  kind: "photo_360" | "video_360";
  thumbnailUrl: string | null;
};

export type BulkSceneCreatorDict = {
  heading: string;
  intro: string;
  toggleCta: string;
  selectAllCta: string;
  clearCta: string;
  createCta: string;
  creatingLabel: string;
  selectedCountLabel: string;
  emptyState: string;
  successLabel: string;
  skippedLabel: string;
  genericError: string;
};

/**
 * Turns the panoramas already assigned to this destination into scenes, in one go.
 *
 * Only offers media that is assigned to this tour AND does not already back a scene,
 * so repeat visits do not tempt the creator into duplicating rooms. Collapsed behind a
 * toggle because it is a setup-time action, not something you want occupying the page
 * once a tour is built.
 */
export function BulkSceneCreator({
  destinationId,
  lang,
  candidates,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  candidates: BulkSceneCandidate[];
  dict: BulkSceneCreatorDict;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onCreate() {
    if (selected.size === 0) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await bulkCreateScenes({
        destinationId,
        // Set iteration order follows insertion order, which is click order.
        panoramaMediaIds: Array.from(selected),
        lang,
      });
      if (!res.ok) {
        setError(dict.genericError);
        return;
      }
      setResult(res.data);
      setSelected(new Set());
      router.refresh();
    });
  }

  if (candidates.length === 0 && !result) return null;

  return (
    <section
      aria-labelledby="bulk-scene-heading"
      className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="bulk-scene-heading" className="text-sm font-semibold">
            {dict.heading}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{dict.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.toggleCta}
        </button>
      </div>

      {result ? (
        <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
          {dict.successLabel.replace("{count}", String(result.created))}
          {result.skipped > 0
            ? ` ${dict.skippedLabel.replace("{count}", String(result.skipped))}`
            : ""}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {open ? (
        candidates.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{dict.emptyState}</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set(candidates.map((c) => c.id)))}
                className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
              >
                {dict.selectAllCta}
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
              >
                {dict.clearCta}
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {dict.selectedCountLabel.replace("{count}", String(selected.size))}
              </span>
            </div>

            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-black/10 p-2 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 shrink-0"
                    />
                    {c.thumbnailUrl ? (
                      <Image
                        src={c.thumbnailUrl}
                        alt=""
                        width={64}
                        height={36}
                        className="h-9 w-16 shrink-0 rounded object-cover"
                        unoptimized
                      />
                    ) : null}
                    <span className="min-w-0 truncate text-sm">{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onCreate}
              disabled={pending || selected.size === 0}
              className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {pending ? dict.creatingLabel : dict.createCta}
            </button>
          </>
        )
      ) : null}
    </section>
  );
}
