"use client";

import { useState, useTransition, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import type { VirtualTourViewerApi } from "@/components/virtual-tour/virtual-tour-viewer";
import { updateSceneIconOpacity } from "@/lib/actions/scenes";
import { MIN_OPACITY_PERCENT } from "@/lib/icon-opacity";
import type { Locale } from "@/lib/locales";

export type IconOpacityDict = {
  heading: string;
  intro: string;
  linkLabel: string;
  hotspotLabel: string;
  inheritLabel: string;
  floorNote: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  resetCta: string;
  genericError: string;
};

/**
 * One labelled slider.
 *
 * A component rather than a function called during the parent's render: the
 * change handler reaches into the viewer ref, and calling a helper that closes
 * over a ref mid-render is exactly what `react-hooks/refs` forbids — the ref
 * may not be attached yet. As a component the handler only ever runs from an
 * event, which is when the viewer definitely exists.
 */
function OpacitySlider({
  id,
  label,
  value,
  inheritLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  inheritLabel: string;
  onChange: (next: number) => void;
}) {
  return (
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
          onChange={(e) => onChange(Number(e.target.value))}
          className="min-h-11 flex-1"
        />
        <span className="w-24 shrink-0 text-sm tabular-nums text-muted">
          {value === null ? inheritLabel : `${value}%`}
        </span>
      </div>
    </div>
  );
}

/**
 * Per-scene opacity for link arrows and hotspot pins, previewed live.
 *
 * WHY LIVE PREVIEW IS THE WHOLE POINT. Opacity is a judgement about legibility
 * against one specific photograph — pale walls, a bright window, a busy
 * pattern. A number chosen without seeing the panorama behind it is a guess,
 * and save-then-reload turns each guess into a page load. So the slider writes
 * straight through to the viewer while it is being dragged, and saving just
 * makes the last preview permanent.
 *
 * The floor lives in src/lib/icon-opacity.ts and is enforced on read, but the
 * input is also bounded here so the slider cannot even express a value that
 * would be clamped — a control whose result differs from what it showed is
 * worse than one with a shorter range.
 */
export function IconOpacityControls({
  sceneId,
  destinationId,
  lang,
  initialLinkOpacity,
  initialHotspotOpacity,
  viewerApiRef,
  dict,
}: {
  sceneId: string;
  destinationId: string;
  lang: Locale;
  /** Null means the scene inherits the tour's value. */
  initialLinkOpacity: number | null;
  initialHotspotOpacity: number | null;
  /** Optional: without it the control still saves, it just cannot preview. */
  viewerApiRef?: MutableRefObject<VirtualTourViewerApi | null>;
  dict: IconOpacityDict;
}) {
  const router = useRouter();
  const [link, setLink] = useState<number | null>(initialLinkOpacity);
  const [hotspot, setHotspot] = useState<number | null>(initialHotspotOpacity);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const dirty = link !== initialLinkOpacity || hotspot !== initialHotspotOpacity;

  function previewLink(next: number | null) {
    setLink(next);
    // null clears the override so the viewer falls back to what the tour and
    // scene resolved to at mount — which is what "inherit" should look like.
    viewerApiRef?.current?.setIconOpacity({ link: next });
  }
  function previewHotspot(next: number | null) {
    setHotspot(next);
    viewerApiRef?.current?.setIconOpacity({ hotspot: next });
  }

  function onSave() {
    setStatus("idle");
    const form = new FormData();
    form.set("sceneId", sceneId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    // Empty string stores null — "inherit the tour's" rather than a number
    // that happens to equal it today and would stop tracking it tomorrow.
    form.set("sceneLinkIconOpacity", link === null ? "" : String(link));
    form.set("hotspotIconOpacity", hotspot === null ? "" : String(hotspot));
    startTransition(async () => {
      const result = await updateSceneIconOpacity(form);
      setStatus(result.ok ? "saved" : "error");
      if (result.ok) router.refresh();
    });
  }

  function reset() {
    previewLink(null);
    previewHotspot(null);
  }

  return (
    <section className="mt-6 rounded-lg border border-black/15 p-4 dark:border-white/20">
      <h3 className="text-base font-semibold">{dict.heading}</h3>
      <p className="mt-1 text-sm text-muted">{dict.intro}</p>

      <div className="mt-3 flex flex-col gap-4">
        <OpacitySlider
          id="icon-opacity-link"
          label={dict.linkLabel}
          value={link}
          inheritLabel={dict.inheritLabel}
          onChange={previewLink}
        />
        <OpacitySlider
          id="icon-opacity-hotspot"
          label={dict.hotspotLabel}
          value={hotspot}
          inheritLabel={dict.inheritLabel}
          onChange={previewHotspot}
        />
      </div>

      {/* Says why the slider stops where it does, so the limit reads as a
          decision rather than a bug. */}
      <p className="mt-2 text-xs text-muted">{dict.floorNote}</p>

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
          onClick={reset}
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
