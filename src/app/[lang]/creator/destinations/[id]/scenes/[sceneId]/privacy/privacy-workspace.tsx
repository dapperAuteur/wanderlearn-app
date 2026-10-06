"use client";

import { useRef } from "react";
import type { Locale } from "@/lib/locales";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { VirtualTour, type VirtualTourViewerApi } from "@/components/virtual-tour/virtual-tour";
import { ViewLimitControls, type ViewLimitDict } from "./view-limit-controls";

/**
 * The working surface of the "Hide people and gear" page: one viewer, and the
 * controls that act on it.
 *
 * A single-scene tour on purpose. The creator is fixing THIS photograph, and a
 * viewer they could walk out of would let a saved setting land on a scene they
 * were not looking at (the wrong-target bug the scene page once had).
 */
export function PrivacyWorkspace({
  tour,
  sceneId,
  destinationId,
  lang,
  initialMinPitchDeg,
  viewLimitDict,
}: {
  tour: VirtualTourType;
  sceneId: string;
  destinationId: string;
  lang: Locale;
  initialMinPitchDeg: number | null;
  viewLimitDict: ViewLimitDict;
}) {
  const apiRef = useRef<VirtualTourViewerApi | null>(null);

  return (
    <>
      <div className="mt-8 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        <VirtualTour tour={tour} height="60vh" apiRef={apiRef} />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <ViewLimitControls
          sceneId={sceneId}
          destinationId={destinationId}
          lang={lang}
          initialMinPitchDeg={initialMinPitchDeg}
          viewerApiRef={apiRef}
          dict={viewLimitDict}
        />
      </div>
    </>
  );
}
