"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/locales";
import type { CrossTourTarget, VirtualTour as VirtualTourType } from "./types";
import { VirtualTour } from "./virtual-tour";
import {
  CrossTourPreviewCard,
  type CrossTourPreviewCardDict,
} from "./cross-tour-preview-card";

/**
 * Mounts the virtual-tour viewer AND listens for the
 * `wanderlust:cross-tour-link` DOM event the viewer dispatches when a
 * cross-tour hotspot is clicked. On event, opens the preview card so
 * the visitor can confirm before navigating.
 *
 * Use this anywhere the public tour viewer renders. When the viewer
 * is embedded inside a course-lesson surface or an iframe, pass
 * `openInNewTab` to make the preview card's CTA open in a new tab —
 * preserves the course progress / partner iframe context.
 */
export function TourWithCrossTour({
  tour,
  height,
  lang,
  openInNewTab,
  dict,
  soundOnLabel,
  soundOffLabel,
  sceneLinkLabel,
  sceneLinkFallbackLabel,
  containerClassName,
  heldKeys,
  onKeyGranted,
}: {
  tour: VirtualTourType;
  height?: string;
  lang: Locale;
  openInNewTab: boolean;
  dict: CrossTourPreviewCardDict;
  /** Ambient-sound toggle labels. English fallbacks apply when omitted. */
  soundOnLabel?: string;
  soundOffLabel?: string;
  /** Accessible name for scene-link arrows; `{name}` is the destination. */
  sceneLinkLabel?: string;
  sceneLinkFallbackLabel?: string;
  containerClassName?: string;
  /** Hunt game mechanics; see VirtualTourViewer. Omit for an ordinary tour. */
  heldKeys?: readonly string[];
  onKeyGranted?: (key: string, hotspotId: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [previewTarget, setPreviewTarget] = useState<CrossTourTarget | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    function onCrossTour(event: Event) {
      const ce = event as CustomEvent<CrossTourTarget>;
      // Block the viewer's default action (open-in-new-tab fallback);
      // we'll render the preview card instead.
      event.preventDefault();
      setPreviewTarget(ce.detail);
    }
    el.addEventListener("wanderlust:cross-tour-link", onCrossTour);
    return () => {
      el.removeEventListener("wanderlust:cross-tour-link", onCrossTour);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={containerClassName}>
      <VirtualTour
        tour={tour}
        height={height}
        heldKeys={heldKeys}
        onKeyGranted={onKeyGranted}
        soundOnLabel={soundOnLabel}
        soundOffLabel={soundOffLabel}
        sceneLinkLabel={sceneLinkLabel}
        sceneLinkFallbackLabel={sceneLinkFallbackLabel}
      />
      <CrossTourPreviewCard
        open={previewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
        target={previewTarget}
        lang={lang}
        openInNewTab={openInNewTab}
        dict={dict}
      />
    </div>
  );
}
