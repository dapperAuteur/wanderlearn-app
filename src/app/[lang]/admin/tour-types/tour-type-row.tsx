"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TOUR_COLOR_PRESETS } from "@/lib/tour-styling";
import type { Locale } from "@/lib/locales";
import { updateTourTypeSetting } from "./actions";

export interface TourTypeRowDict {
  colorLabel: string;
  sortLabel: string;
  activeLabel: string;
  save: string;
  saving: string;
  saved: string;
  genericError: string;
  preset: Record<string, string>;
}

export function TourTypeRow({
  type,
  label,
  color,
  sortOrder,
  active,
  lang,
  dict,
}: {
  type: string;
  label: string;
  color: string;
  sortOrder: number;
  active: boolean;
  lang: Locale;
  dict: TourTypeRowDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedColor, setSelectedColor] = useState(color);
  const [done, setDone] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("type", type);
    formData.set("lang", lang);
    formData.set("color", selectedColor);
    setDone(false);
    startTransition(async () => {
      const result = await updateTourTypeSetting(formData);
      if (result.ok) {
        setDone(true);
        router.refresh();
      } else {
        window.alert(dict.genericError);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 sm:flex-row sm:items-end dark:border-white/15"
    >
      <div className="flex items-center gap-3 sm:w-48">
        <span
          aria-hidden="true"
          className="inline-block h-5 w-5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/25"
          style={{ backgroundColor: selectedColor }}
        />
        <span className="font-medium">{label}</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`color-${type}`} className="text-xs font-medium">
          {dict.colorLabel}
        </label>
        <select
          id={`color-${type}`}
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        >
          {TOUR_COLOR_PRESETS.map((p) => (
            <option key={p.key} value={p.value}>
              {dict.preset[p.key] ?? p.key}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`sort-${type}`} className="text-xs font-medium">
          {dict.sortLabel}
        </label>
        <input
          id={`sort-${type}`}
          name="sortOrder"
          type="number"
          min={0}
          max={999}
          defaultValue={sortOrder}
          className="min-h-11 w-24 rounded-md border border-black/15 bg-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>

      <label
        htmlFor={`active-${type}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm"
      >
        <input
          id={`active-${type}`}
          name="active"
          type="checkbox"
          value="true"
          defaultChecked={active}
          className="h-4 w-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        />
        {dict.activeLabel}
      </label>

      <div className="flex items-center gap-3 sm:ml-auto">
        {done ? (
          <span role="status" aria-live="polite" className="text-sm text-emerald-600 dark:text-emerald-400">
            {dict.saved}
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.saving : dict.save}
        </button>
      </div>
    </form>
  );
}
