"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";
import { updateScenePoster } from "@/lib/actions/scenes";

export type PosterOption = {
  id: string;
  kind: "image" | "photo_360" | "screenshot";
  thumbnailUrl: string | null;
  displayName: string | null;
};

export type PosterPickerDict = {
  heading: string;
  subtitle: string;
  currentLabel: string;
  noneLabel: string;
  emptyState: string;
  emptyStateCta: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  clearCta: string;
  genericError: string;
  unnamedLabel: string;
};

export function ScenePosterPicker({
  sceneId,
  destinationId,
  lang,
  currentPosterId,
  options,
  mediaLibraryHref,
  dict,
}: {
  sceneId: string;
  destinationId: string;
  lang: Locale;
  currentPosterId: string | null;
  options: PosterOption[];
  mediaLibraryHref: string;
  dict: PosterPickerDict;
}) {
  const fieldId = useId();
  const [selection, setSelection] = useState<string | null>(currentPosterId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = selection !== currentPosterId;

  function onSave() {
    setError(null);
    const form = new FormData();
    form.set("sceneId", sceneId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    if (selection) form.set("posterMediaId", selection);
    startTransition(async () => {
      const result = await updateScenePoster(form);
      if (!result.ok) {
        setError(dict.genericError);
      }
    });
  }

  function onCancel() {
    setSelection(currentPosterId);
    setError(null);
  }

  function onClear() {
    setSelection(null);
    setError(null);
  }

  const currentOption = options.find((o) => o.id === currentPosterId) ?? null;

  if (options.length === 0) {
    return (
      <section
        aria-labelledby={`${fieldId}-heading`}
        className="rounded-lg border border-black/10 p-4 dark:border-white/15"
      >
        <h2 id={`${fieldId}-heading`} className="text-lg font-semibold">
          {dict.heading}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.subtitle}</p>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{dict.emptyState}</p>
        <Link
          href={mediaLibraryHref}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.emptyStateCta}
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`${fieldId}-heading`}
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 id={`${fieldId}-heading`} className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.subtitle}</p>

      <p className="mt-3 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">{dict.currentLabel}: </span>
        <span className="font-medium">
          {currentOption?.displayName ?? (currentPosterId ? dict.unnamedLabel : dict.noneLabel)}
        </span>
      </p>

      <ul
        role="radiogroup"
        aria-labelledby={`${fieldId}-heading`}
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {options.map((option) => {
          const checked = selection === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setSelection(option.id)}
                className={`flex w-full flex-col gap-2 rounded-md border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                  checked
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                }`}
              >
                <div className="relative aspect-video w-full overflow-hidden rounded bg-black/5 dark:bg-white/5">
                  {option.thumbnailUrl ? (
                    <Image
                      src={option.thumbnailUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
                <span className="truncate text-xs font-medium">
                  {option.displayName ?? dict.unnamedLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !dirty}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.savingLabel : dict.saveCta}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={pending || selection === null}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.clearCta}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending || !dirty}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
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
