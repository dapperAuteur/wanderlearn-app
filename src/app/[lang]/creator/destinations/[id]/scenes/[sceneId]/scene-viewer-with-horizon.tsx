"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Locale } from "@/lib/locales";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { VirtualTour, type VirtualTourViewerApi } from "@/components/virtual-tour/virtual-tour";
import {
  HorizonRotationControls,
  type HorizonRotationDict,
} from "./horizon-rotation-controls";

export function SceneViewerWithHorizon({
  tour,
  sceneId,
  destinationId,
  lang,
  initialRollOffsetDeg,
  editCtaLabel,
  nowViewingLabel,
  dict,
}: {
  tour: VirtualTourType;
  sceneId: string;
  destinationId: string;
  lang: Locale;
  initialRollOffsetDeg: number | null;
  editCtaLabel: string;
  /** "Now viewing: {scene}" — takes a {scene} placeholder. */
  nowViewingLabel: string;
  dict: HorizonRotationDict;
}) {
  // Shared ref so the horizon slider can push live previews into the
  // viewer's PSV sphereCorrection while the creator drags.
  const apiRef = useRef<VirtualTourViewerApi | null>(null);

  // This page previews the WHOLE tour, so the creator can walk into any scene
  // from here. Everything below has to follow them: the edit link used to point
  // at whichever scene the page was opened with, and — worse — so did the
  // horizon slider, which meant adjusting the tilt while looking at scene B
  // silently saved it onto scene A.
  const [currentSceneId, setCurrentSceneId] = useState(sceneId);
  const currentScene = tour.scenes.find((s) => s.id === currentSceneId);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        <VirtualTour
          tour={tour}
          height="60vh"
          apiRef={apiRef}
          onSceneChange={setCurrentSceneId}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          {nowViewingLabel.replace("{scene}", currentScene?.name ?? "")}
        </p>
        <Link
          href={`/${lang}/creator/destinations/${destinationId}/scenes/${currentSceneId}/edit`}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {editCtaLabel}
        </Link>
      </div>

      <div className="mt-6">
        {/* Keyed on the scene so the slider fully resets when the creator walks
            into another room — otherwise it would show the previous scene's
            saved tilt as this scene's starting value. */}
        <HorizonRotationControls
          key={currentSceneId}
          sceneId={currentSceneId}
          destinationId={destinationId}
          lang={lang}
          initialRollOffsetDeg={
            currentSceneId === sceneId
              ? initialRollOffsetDeg
              : (currentScene?.rollOffsetDeg ?? null)
          }
          viewerApiRef={apiRef}
          dict={dict}
        />
      </div>
    </>
  );
}
