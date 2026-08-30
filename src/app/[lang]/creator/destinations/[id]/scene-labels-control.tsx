"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDestinationSceneLabels } from "@/lib/actions/destinations";
import type { Locale } from "@/lib/locales";

export type SceneLabelsDict = {
  heading: string;
  intro: string;
  showLabel: string;
  hideLabel: string;
  visitorNote: string;
  savingLabel: string;
  savedLabel: string;
  genericError: string;
};

/**
 * Whether scene names and captions show over the panorama by default.
 *
 * Radios rather than a checkbox: "show" and "hide" are both deliberate choices
 * about how a tour reads, and a lone "hide labels" checkbox frames one of them
 * as the absence of the other.
 *
 * Saves on change. There is nothing to compose here — one value, two states —
 * so a Save button would only add a step to forget.
 */
export function SceneLabelsControl({
  destinationId,
  lang,
  initialShowSceneLabels,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  initialShowSceneLabels: boolean;
  dict: SceneLabelsDict;
}) {
  const router = useRouter();
  const [show, setShow] = useState(initialShowSceneLabels);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function save(next: boolean) {
    setShow(next);
    setStatus("idle");
    const fd = new FormData();
    fd.set("destinationId", destinationId);
    fd.set("lang", lang);
    fd.set("showSceneLabels", next ? "true" : "false");
    startTransition(async () => {
      const result = await updateDestinationSceneLabels(fd);
      setStatus(result.ok ? "saved" : "error");
      if (result.ok) router.refresh();
      // Put the control back if the save failed, so it never shows a state the
      // database does not hold.
      else setShow(!next);
    });
  }

  return (
    <section className="rounded-lg border border-black/15 p-4 dark:border-white/20">
      <h3 className="text-base font-semibold">{dict.heading}</h3>
      <p className="mt-1 text-sm text-muted">{dict.intro}</p>

      <fieldset className="mt-3 flex flex-col gap-2" disabled={pending}>
        <legend className="sr-only">{dict.heading}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scene-labels"
            checked={show}
            onChange={() => save(true)}
            className="size-5"
          />
          {dict.showLabel}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scene-labels"
            checked={!show}
            onChange={() => save(false)}
            className="size-5"
          />
          {dict.hideLabel}
        </label>
      </fieldset>

      {/* Says plainly that this is a default, not a lock — "hide labels" reads
          like a privacy control and is not one. */}
      <p className="mt-2 text-xs text-muted">{dict.visitorNote}</p>

      <p aria-live="polite" className="mt-1 text-sm text-muted">
        {pending ? dict.savingLabel : status === "saved" ? dict.savedLabel : status === "error" ? dict.genericError : ""}
      </p>
    </section>
  );
}
