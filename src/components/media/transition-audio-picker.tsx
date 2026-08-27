"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDestinationTransitionAudio } from "@/lib/actions/destinations";
import type { Locale } from "@/lib/locales";

export type TransitionAudioOption = {
  id: string;
  displayName: string | null;
  url: string | null;
  durationSeconds: number | null;
};

export type TransitionAudioDict = {
  heading: string;
  subtitle: string;
  lengthNote: string;
  currentLabel: string;
  noneLabel: string;
  noneOption: string;
  emptyState: string;
  saveCta: string;
  savingLabel: string;
  previewLabel: string;
  genericError: string;
  unnamedLabel: string;
  tooLongWarning: string;
};

/** Past this, a transition stops reading as punctuation and starts as a clip. */
const LONG_SECONDS = 3;

/**
 * The tour-wide transition sound: what plays when a visitor walks any link.
 *
 * A single select rather than the richer gallery used for panoramas. The
 * choice here is from a short list of audio files and the important decision
 * is not "which thumbnail" but "how long" — so the length is on every option
 * and over-long files are called out rather than silently accepted.
 */
export function TransitionAudioPicker({
  destinationId,
  lang,
  currentMediaId,
  options,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  currentMediaId: string | null;
  options: TransitionAudioOption[];
  dict: TransitionAudioDict;
}) {
  const fieldId = useId();
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(currentMediaId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = options.find((o) => o.id === selection) ?? null;
  const current = options.find((o) => o.id === currentMediaId) ?? null;
  const tooLong =
    selected?.durationSeconds !== null &&
    selected?.durationSeconds !== undefined &&
    selected.durationSeconds > LONG_SECONDS;

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("destinationId", destinationId);
    fd.set("lang", lang);
    if (selection) fd.set("transitionAudioMediaId", selection);
    startTransition(async () => {
      const result = await updateDestinationTransitionAudio(fd);
      if (!result.ok) {
        setError(result.error || dict.genericError);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-black/15 p-4 dark:border-white/20">
      <h3 className="text-base font-semibold">{dict.heading}</h3>
      <p className="mt-1 text-sm text-muted">{dict.subtitle}</p>
      {/*
        Said before the choice, not after. WCAG 1.4.2 wants a control for audio
        running past three seconds, and a transition long enough to need one is
        long enough to annoy — cheaper to say up front than to explain later.
      */}
      <p className="mt-1 text-xs text-muted">{dict.lengthNote}</p>

      {options.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{dict.emptyState}</p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            <span className="text-muted">{dict.currentLabel}: </span>
            <span className="font-medium">
              {current ? (current.displayName ?? dict.unnamedLabel) : dict.noneLabel}
            </span>
          </p>

          <label htmlFor={`${fieldId}-sel`} className="mt-3 block text-sm font-medium">
            {dict.heading}
          </label>
          <select
            id={`${fieldId}-sel`}
            value={selection ?? ""}
            onChange={(e) => setSelection(e.target.value || null)}
            className="mt-1 min-h-11 w-full rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
          >
            <option value="">{dict.noneOption}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {(o.displayName ?? dict.unnamedLabel) +
                  (o.durationSeconds !== null ? ` — ${o.durationSeconds}s` : "")}
              </option>
            ))}
          </select>

          {tooLong ? (
            <p role="alert" className="mt-2 text-sm font-medium">
              {dict.tooLongWarning}
            </p>
          ) : null}

          {selected?.url ? (
            <audio
              controls
              src={selected.url}
              aria-label={dict.previewLabel}
              className="mt-2 w-full"
            />
          ) : null}

          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pending ? dict.savingLabel : dict.saveCta}
          </button>

          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
