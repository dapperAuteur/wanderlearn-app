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
  /** In this destination's library, or already used by a scene here. */
  inThisTour?: boolean;
};

export type PosterPickerDict = {
  heading: string;
  subtitle: string;
  specsHint: string;
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
  scopeThisTour: string;
  scopeAll: string;
  expandCta: string;
  collapseCta: string;
  countLabel: string;
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
  // Collapsed by default, and scoped to this tour when opened. Same reasoning as
  // the panorama picker directly above it: this grid is every image the creator
  // owns, which on a real library is hundreds of thumbnails sitting between the
  // viewer and the hotspot editor, and it is only needed when actually changing
  // the poster.
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"tour" | "all">(
    options.some((o) => o.inThisTour) ? "tour" : "all",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = selection !== currentPosterId;

  const visibleOptions = scope === "tour" ? options.filter((o) => o.inThisTour) : options;

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
        {/* Target shape/size, so creators stop guessing and stop uploading files
            that get cropped badly or rejected. */}
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{dict.specsHint}</p>
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-4 inline-flex min-h-11 w-fit items-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
      >
        {open ? dict.collapseCta : dict.expandCta}{" "}
        <span className="ml-2 text-zinc-600 dark:text-zinc-400">
          {dict.countLabel.replace("{count}", String(options.length))}
        </span>
      </button>

      {open ? (
        <>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["tour", dict.scopeThisTour],
            ["all", dict.scopeAll],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            aria-pressed={scope === value}
            className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
              scope === value
                ? "bg-foreground text-background"
                : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul
        role="radiogroup"
        aria-labelledby={`${fieldId}-heading`}
        className="mt-4 grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4"
      >
        {visibleOptions.map((option) => {
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
        </>
      ) : null}

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
