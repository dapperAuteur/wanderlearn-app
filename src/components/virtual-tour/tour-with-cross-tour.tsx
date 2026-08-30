"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/locales";
import type { CrossTourTarget, VirtualTour as VirtualTourType } from "./types";
import { VirtualTour, type VirtualTourViewerApi } from "./virtual-tour";
import {
  CrossTourPreviewCard,
  type CrossTourPreviewCardDict,
} from "./cross-tour-preview-card";
import { TourStopRail, type TourStopRailDict } from "./tour-stop-rail";

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
 *
 * This is also where the viewer's scene-change stream becomes visible to the
 * rest of the app. The viewer has always emitted `onSceneChange`, but this
 * wrapper dropped it, and every learner surface mounts through here — which is
 * why nothing learner-facing could say which scene was on screen.
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
  stopRailDict,
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
  /**
   * Pass to render the "where am I / what's left" stop rail beneath the
   * viewer. Opt-in rather than opt-out on purpose: the hunt runner already
   * shows its own ordered stop list and would otherwise display two, and the
   * embed surface has its own tight layout with pinned corners.
   *
   * When omitted, this component renders exactly the markup it always has —
   * no extra wrapper element — so existing mounts are untouched.
   */
  stopRailDict?: TourStopRailDict;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewerApiRef = useRef<VirtualTourViewerApi | null>(null);
  const [previewTarget, setPreviewTarget] = useState<CrossTourTarget | null>(null);

  // Seeded with the start scene rather than left empty: PSV does not
  // necessarily emit node-changed for the node it opens on, so waiting for the
  // event would show "Stop 0 of 14" until the visitor moved.
  const [currentSceneId, setCurrentSceneId] = useState<string>(tour.startSceneId);
  const [visitedSceneIds, setVisitedSceneIds] = useState<ReadonlySet<string>>(
    () => new Set([tour.startSceneId]),
  );

  const handleSceneChange = useCallback((sceneId: string) => {
    setCurrentSceneId(sceneId);
    // Announce it on the window so siblings can follow along.
    //
    // The share button sits AFTER the viewer in the page — deliberately, since
    // sharing is something you do having seen the place — and both are client
    // components under a server component, so there is no common React parent
    // holding this state. A window event keeps them where they belong in the
    // layout instead of restructuring the page around a provider.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("wanderlust:scene-changed", { detail: { sceneId } }),
      );
    }
    setVisitedSceneIds((prev) => {
      if (prev.has(sceneId)) return prev; // keep the reference stable — no re-render
      const next = new Set(prev);
      next.add(sceneId);
      return next;
    });
  }, []);

  const handleSelectStop = useCallback((sceneId: string) => {
    viewerApiRef.current?.goToScene(sceneId);
  }, []);


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

  const viewer = (
    <VirtualTour
      tour={tour}
      height={height}
      heldKeys={heldKeys}
      onKeyGranted={onKeyGranted}
      soundOnLabel={soundOnLabel}
      soundOffLabel={soundOffLabel}
      sceneLinkLabel={sceneLinkLabel}
      sceneLinkFallbackLabel={sceneLinkFallbackLabel}
      onSceneChange={handleSceneChange}
      apiRef={viewerApiRef}
    />
  );

  const previewCard = (
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
  );

  // No rail: the original single-element output, unchanged.
  if (!stopRailDict) {
    return (
      <div ref={wrapperRef} className={containerClassName}>
        {viewer}
        {previewCard}
      </div>
    );
  }

  // With a rail, `containerClassName` stays on the framed panorama box so the
  // rail sits outside the border and rounded corners rather than being clipped
  // by the frame's `overflow-hidden`.
  return (
    <div>
      <div ref={wrapperRef} className={containerClassName}>
        {viewer}
      </div>
      <TourStopRail
        scenes={tour.scenes}
        currentSceneId={currentSceneId}
        visitedSceneIds={visitedSceneIds}
        onSelect={handleSelectStop}
        dict={stopRailDict}
      />
      {previewCard}
    </div>
  );
}
