"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";
import { replaceDestinationPinIcon } from "@/lib/actions/destinations";

export type PinIconOption = {
  id: string;
  thumbnailUrl: string | null;
  displayName: string | null;
};

export type PinIconPickerDict = {
  heading: string;
  subtitle: string;
  currentLabel: string;
  defaultLabel: string;
  emptyState: string;
  emptyStateCta: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
  unnamedLabel: string;
};

export function PinIconPicker({
  destinationId,
  lang,
  currentPinIconId,
  options,
  mediaLibraryHref,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  currentPinIconId: string | null;
  options: PinIconOption[];
  mediaLibraryHref: string;
  dict: PinIconPickerDict;
}) {
  const fieldId = useId();
  const [selection, setSelection] = useState<string | null>(currentPinIconId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = selection !== currentPinIconId;

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("id", destinationId);
    fd.set("pinIconMediaId", selection ?? "");
    fd.set("lang", lang);
    startTransition(async () => {
      const result = await replaceDestinationPinIcon(fd);
      if (!result.ok) {
        setError(dict.genericError);
      }
    });
  }

  function onCancel() {
    setSelection(currentPinIconId);
    setError(null);
  }

  return (
    <section aria-labelledby={`${fieldId}-heading`} className="flex flex-col gap-4">
      <div>
        <h2 id={`${fieldId}-heading`} className="text-lg font-semibold">
          {dict.heading}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.subtitle}</p>
      </div>

      {options.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-6 text-center dark:border-white/20">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{dict.emptyState}</p>
          <Link
            href={mediaLibraryHref}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.emptyStateCta}
          </Link>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">{dict.heading}</legend>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            <label
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-2 text-center text-xs ${
                selection === null
                  ? "border-foreground bg-foreground/5"
                  : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name={`${fieldId}-pin-icon`}
                value=""
                checked={selection === null}
                onChange={() => setSelection(null)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex aspect-square w-full items-center justify-center rounded-md bg-black/5 text-zinc-500 dark:bg-white/5"
              >
                📍
              </span>
              <span className="font-medium">{dict.defaultLabel}</span>
            </label>
            {options.map((option) => {
              const selected = selection === option.id;
              const label = option.displayName ?? dict.unnamedLabel;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer flex-col items-stretch gap-2 rounded-lg border p-2 text-center text-xs ${
                    selected
                      ? "border-foreground bg-foreground/5"
                      : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${fieldId}-pin-icon`}
                    value={option.id}
                    checked={selected}
                    onChange={() => setSelection(option.id)}
                    className="sr-only"
                  />
                  {option.thumbnailUrl ? (
                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black/5 dark:bg-white/5">
                      <Image
                        src={option.thumbnailUrl}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 12vw, 30vw"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex aspect-square w-full items-center justify-center rounded-md bg-black/5 text-zinc-500 dark:bg-white/5"
                    >
                      —
                    </div>
                  )}
                  <span className="font-medium break-words">{label}</span>
                  {selected ? (
                    <span className="text-[10px] uppercase tracking-wide text-foreground/70">
                      {dict.currentLabel}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || pending}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {pending ? dict.savingLabel : dict.saveCta}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={!dirty || pending}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.cancelCta}
            </button>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </fieldset>
      )}
    </section>
  );
}
