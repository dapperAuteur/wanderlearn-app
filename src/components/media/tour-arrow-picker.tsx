"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";
import {
  Pager,
  PickerToggle,
  usePagedOptions,
  type PickerChromeDict,
} from "./media-picker-chrome";
import { replaceDestinationTourArrow } from "@/lib/actions/destinations";

export type TourArrowOption = {
  id: string;
  thumbnailUrl: string | null;
  displayName: string | null;
};

export type TourArrowPickerDict = {
  heading: string;
  subtitle: string;
  currentLabel: string;
  defaultLabel: string;
  emptyState: string;
  emptyStateCta: string;
  savingLabel: string;
  savedLabel: string;
  genericError: string;
  unnamedLabel: string;
  colorTintCaveat: string;
  expandCta: string;
  collapseCta: string;
};

export function TourArrowPicker({
  destinationId,
  lang,
  currentTourArrowId,
  options,
  mediaLibraryHref,
  dict,
  chromeDict,
}: {
  destinationId: string;
  lang: Locale;
  currentTourArrowId: string | null;
  options: TourArrowOption[];
  mediaLibraryHref: string;
  dict: TourArrowPickerDict;
  chromeDict: PickerChromeDict;
}) {
  const fieldId = useId();
  const paged = usePagedOptions({ options });
  const [selection, setSelection] = useState<string | null>(currentTourArrowId);
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [pending, startTransition] = useTransition();

  // Last-write-wins guard mirrors the pin-icon picker.
  const fireIdRef = useRef(0);

  function persist(newSelection: string | null) {
    if (newSelection === selection) return;
    setSelection(newSelection);
    setError(null);
    const myId = ++fireIdRef.current;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", destinationId);
      fd.set("tourArrowMediaId", newSelection ?? "");
      fd.set("lang", lang);
      const result = await replaceDestinationTourArrow(fd);
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
        <p className="mt-2 text-xs italic text-zinc-500 dark:text-zinc-400">
          {dict.colorTintCaveat}
        </p>
      </div>

      <PickerToggle
        open={paged.open}
        setOpen={paged.setOpen}
        count={options.length}
        expandCta={dict.expandCta}
        collapseCta={dict.collapseCta}
        dict={chromeDict}
      />

      {!paged.open ? null : options.length === 0 ? (
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
                name={`${fieldId}-tour-arrow`}
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
                ➤
              </span>
              <span className="font-medium">{dict.defaultLabel}</span>
            </label>
            {paged.pageItems.map((option) => {
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
                    name={`${fieldId}-tour-arrow`}
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

          <Pager
            page={paged.page}
            totalPages={paged.totalPages}
            from={paged.from}
            to={paged.to}
            total={paged.total}
            setPage={paged.setPage}
            dict={chromeDict}
          />

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
