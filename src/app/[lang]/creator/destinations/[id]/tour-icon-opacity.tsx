"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDestinationIconOpacity } from "@/lib/actions/destinations";
import { MIN_OPACITY_PERCENT } from "@/lib/icon-opacity";
import type { Locale } from "@/lib/locales";

export type TourIconOpacityDict = {
  heading: string;
  intro: string;
  linkLabel: string;
  hotspotLabel: string;
  defaultLabel: string;
  floorNote: string;
  perSceneNote: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  resetCta: string;
  genericError: string;
};

/**
 * The tour-wide default for arrow and pin opacity.
 *
 * NO LIVE PREVIEW HERE, and that is the honest choice rather than a gap: this
 * page has no viewer to preview into. A slider that changes nothing visible
 * invites a value picked blind, so the copy points at the scene editor — where
 * the same setting previews against the actual photograph, which is the only
 * place the judgement can really be made.
 *
 * This control is for the coarse pass ("arrows are too loud across this whole
 * tour"); the scene editor is for the room that needs different treatment.
 */
export function TourIconOpacity({
  destinationId,
  lang,
  initialLinkOpacity,
  initialHotspotOpacity,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  initialLinkOpacity: number | null;
  initialHotspotOpacity: number | null;
  dict: TourIconOpacityDict;
}) {
  const router = useRouter();
  const [link, setLink] = useState<number | null>(initialLinkOpacity);
  const [hotspot, setHotspot] = useState<number | null>(initialHotspotOpacity);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const dirty = link !== initialLinkOpacity || hotspot !== initialHotspotOpacity;

  function onSave() {
    setStatus("idle");
    const form = new FormData();
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    form.set("sceneLinkIconOpacity", link === null ? "" : String(link));
    form.set("hotspotIconOpacity", hotspot === null ? "" : String(hotspot));
    startTransition(async () => {
      const result = await updateDestinationIconOpacity(form);
      setStatus(result.ok ? "saved" : "error");
      if (result.ok) router.refresh();
    });
  }

  const row = (id: string, label: string, value: number | null, set: (n: number | null) => void) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={MIN_OPACITY_PERCENT}
          max={100}
          step={5}
          value={value ?? 100}
          onChange={(e) => set(Number(e.target.value))}
          className="min-h-11 flex-1"
        />
        <span className="w-24 shrink-0 text-sm tabular-nums text-muted">
          {value === null ? dict.defaultLabel : `${value}%`}
        </span>
      </div>
    </div>
  );

  return (
    <section className="rounded-lg border border-black/15 p-4 dark:border-white/20">
      <h3 className="text-base font-semibold">{dict.heading}</h3>
      <p className="mt-1 text-sm text-muted">{dict.intro}</p>

      <div className="mt-3 flex flex-col gap-4">
        {row("tour-opacity-link", dict.linkLabel, link, setLink)}
        {row("tour-opacity-hotspot", dict.hotspotLabel, hotspot, setHotspot)}
      </div>

      <p className="mt-2 text-xs text-muted">{dict.floorNote}</p>
      {/* Names where the judgement is actually made, so this control does not
          pretend to be the whole story. */}
      <p className="mt-1 text-xs text-muted">{dict.perSceneNote}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
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
          onClick={() => {
            setLink(null);
            setHotspot(null);
          }}
          disabled={pending || (link === null && hotspot === null)}
          className="inline-flex min-h-11 items-center rounded-md border border-black/20 px-4 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/25 dark:hover:bg-white/10"
        >
          {dict.resetCta}
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {status === "saved" ? dict.savedLabel : status === "error" ? dict.genericError : ""}
        </p>
      </div>
    </section>
  );
}
