"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
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
  savedLabel: string;
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
  const [savedTick, setSavedTick] = useState(0);
  const [pending, startTransition] = useTransition();

  // Last-write-wins guard: rapid clicks can fire two actions; whichever
  // started last is the source of truth, so older completions are ignored.
  const fireIdRef = useRef(0);

  function persist(newSelection: string | null) {
    if (newSelection === selection) return;
    setSelection(newSelection);
    setError(null);
    const myId = ++fireIdRef.current;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", destinationId);
      fd.set("pinIconMediaId", newSelection ?? "");
      fd.set("lang", lang);
      const result = await replaceDestinationPinIcon(fd);
      if (myId !== fireIdRef.current) return;
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      setSavedTick((t) => t + 1);
    });
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
                onChange={() => persist(null)}
                disabled={pending}
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
                    onChange={() => persist(option.id)}
                    disabled={pending}
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

          <p
            role={error ? "alert" : "status"}
            aria-live="polite"
            className={`min-h-5 text-sm ${
              error
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {error
              ? error
              : pending
                ? dict.savingLabel
                : savedTick > 0
                  ? dict.savedLabel
                  : ""}
          </p>
        </fieldset>
      )}
    </section>
  );
}
