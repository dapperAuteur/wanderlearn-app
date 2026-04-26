"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";
import {
  addCourseDestination,
  removeCourseDestination,
  setPrimaryCourseDestination,
} from "@/lib/actions/courses";

export type AttachedDestination = {
  destinationId: string;
  destinationName: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  isPrimary: boolean;
};

export type DestinationOption = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export type AdditionalDestinationsDict = {
  heading: string;
  intro: string;
  primaryBadge: string;
  makePrimaryCta: string;
  removeCta: string;
  removingLabel: string;
  addLabel: string;
  addPlaceholder: string;
  addCta: string;
  addingLabel: string;
  emptyState: string;
  noOptionsState: string;
  genericError: string;
};

export function AdditionalDestinations({
  courseId,
  lang,
  attached,
  options,
  dict,
}: {
  courseId: string;
  lang: Locale;
  attached: AttachedDestination[];
  options: DestinationOption[];
  dict: AdditionalDestinationsDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selection, setSelection] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const attachedIds = new Set(attached.map((a) => a.destinationId));
  const availableOptions = options.filter((o) => !attachedIds.has(o.id));

  function onAdd() {
    if (!selection) return;
    setError(null);
    const form = new FormData();
    form.set("courseId", courseId);
    form.set("destinationId", selection);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await addCourseDestination(form);
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      setSelection("");
      router.refresh();
    });
  }

  function onRemove(destinationId: string) {
    setError(null);
    const form = new FormData();
    form.set("courseId", courseId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await removeCourseDestination(form);
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      router.refresh();
    });
  }

  function onMakePrimary(destinationId: string) {
    setError(null);
    const form = new FormData();
    form.set("courseId", courseId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await setPrimaryCourseDestination(form);
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="additional-destinations-heading"
      className="rounded-lg border border-black/10 p-6 dark:border-white/15"
    >
      <h2 id="additional-destinations-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      {attached.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {dict.emptyState}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {attached.map((item) => (
            <li
              key={item.destinationId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/10 p-3 dark:border-white/15"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {item.destinationName}
                  {item.isPrimary ? (
                    <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      ★ {dict.primaryBadge}
                    </span>
                  ) : null}
                </p>
                {item.destinationCity || item.destinationCountry ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {[item.destinationCity, item.destinationCountry].filter(Boolean).join(", ")}
                  </p>
                ) : null}
              </div>
              {item.isPrimary ? null : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onMakePrimary(item.destinationId)}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-black/15 px-3 text-xs font-semibold hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
                  >
                    {dict.makePrimaryCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.destinationId)}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-red-600/30 px-3 text-xs font-semibold text-red-700 hover:bg-red-600/10 disabled:opacity-60 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-400/10"
                  >
                    {pending ? dict.removingLabel : dict.removeCta}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor="add-destination" className="text-sm font-medium">
          {dict.addLabel}
        </label>
        {availableOptions.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {dict.noOptionsState}
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              id="add-destination"
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
              disabled={pending}
              className="min-h-11 flex-1 rounded-md border border-black/15 bg-transparent px-3 text-base disabled:opacity-60 dark:border-white/20"
            >
              <option value="">{dict.addPlaceholder}</option>
              {availableOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.city || option.country
                    ? ` (${[option.city, option.country].filter(Boolean).join(", ")})`
                    : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAdd}
              disabled={pending || !selection}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {pending ? dict.addingLabel : dict.addCta}
            </button>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
