"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDestinationDisplayDefaults } from "@/lib/actions/destinations";
import type { Locale } from "@/lib/locales";

export type DisplayDefaultsDict = {
  heading: string;
  intro: string;
  labelsLegend: string;
  labelsShow: string;
  labelsHide: string;
  labelsNote: string;
  descriptionsLegend: string;
  descriptionsShow: string;
  descriptionsHide: string;
  descriptionsNote: string;
  visitorNote: string;
  savingLabel: string;
  savedLabel: string;
  genericError: string;
};

/**
 * What this tour prints over the photograph, by default.
 *
 * Two settings in one panel because they answer one question, and a creator
 * deciding how much text sits on their panorama wants both answers in view.
 * They were briefly two adjacent panels differing only in wording, which read
 * as a duplicate rather than a pair.
 *
 * Radios rather than checkboxes: "show" and "hide" are both deliberate choices
 * about how a tour reads, and a lone "hide" checkbox frames one of them as the
 * absence of the other.
 *
 * Saves on change. There is nothing to compose here — two values, two states
 * each — so a Save button would only add a step to forget.
 */
export function DisplayDefaultsControl({
  destinationId,
  lang,
  initialShowSceneLabels,
  initialShowSoundDescriptions,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  initialShowSceneLabels: boolean;
  initialShowSoundDescriptions: boolean;
  dict: DisplayDefaultsDict;
}) {
  const router = useRouter();
  const [labels, setLabels] = useState(initialShowSceneLabels);
  const [descriptions, setDescriptions] = useState(initialShowSoundDescriptions);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function save(next: { labels: boolean; descriptions: boolean }) {
    const previous = { labels, descriptions };
    setLabels(next.labels);
    setDescriptions(next.descriptions);
    setStatus("idle");

    const fd = new FormData();
    fd.set("destinationId", destinationId);
    fd.set("lang", lang);
    // Both every time — the action takes both, which keeps it free of
    // partial-update logic and keeps this free of guessing which changed.
    fd.set("showSceneLabels", next.labels ? "true" : "false");
    fd.set("showSoundDescriptions", next.descriptions ? "true" : "false");

    startTransition(async () => {
      const result = await updateDestinationDisplayDefaults(fd);
      setStatus(result.ok ? "saved" : "error");
      if (result.ok) {
        router.refresh();
      } else {
        // Put the controls back. Leaving them showing a state the database does
        // not hold is how a creator ends up certain they saved something.
        setLabels(previous.labels);
        setDescriptions(previous.descriptions);
      }
    });
  }

  return (
    <section className="rounded-lg border border-black/15 p-4 dark:border-white/20">
      <h3 className="text-base font-semibold">{dict.heading}</h3>
      <p className="mt-1 text-sm text-muted">{dict.intro}</p>

      <fieldset className="mt-4 flex flex-col gap-2" disabled={pending}>
        <legend className="text-sm font-medium">{dict.labelsLegend}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scene-labels"
            checked={labels}
            onChange={() => save({ labels: true, descriptions })}
            className="size-5"
          />
          {dict.labelsShow}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scene-labels"
            checked={!labels}
            onChange={() => save({ labels: false, descriptions })}
            className="size-5"
          />
          {dict.labelsHide}
        </label>
        <p className="text-xs text-muted">{dict.labelsNote}</p>
      </fieldset>

      <fieldset className="mt-4 flex flex-col gap-2" disabled={pending}>
        <legend className="text-sm font-medium">{dict.descriptionsLegend}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sound-descriptions"
            checked={descriptions}
            onChange={() => save({ labels, descriptions: true })}
            className="size-5"
          />
          {dict.descriptionsShow}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sound-descriptions"
            checked={!descriptions}
            onChange={() => save({ labels, descriptions: false })}
            className="size-5"
          />
          {dict.descriptionsHide}
        </label>
        {/* Says plainly that hiding does not remove the text alternative —
            otherwise "hide" reads as a decision about accessibility, and a
            creator who wants a clean panorama would rightly hesitate. */}
        <p className="text-xs text-muted">{dict.descriptionsNote}</p>
      </fieldset>

      <p className="mt-3 text-xs text-muted">{dict.visitorNote}</p>

      <p aria-live="polite" className="mt-1 text-sm text-muted">
        {pending
          ? dict.savingLabel
          : status === "saved"
            ? dict.savedLabel
            : status === "error"
              ? dict.genericError
              : ""}
      </p>
    </section>
  );
}
