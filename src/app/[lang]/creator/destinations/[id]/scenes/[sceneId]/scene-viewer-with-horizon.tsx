"use client";

import { useRef } from "react";
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
  dict,
}: {
  tour: VirtualTourType;
  sceneId: string;
  destinationId: string;
  lang: Locale;
  initialRollOffsetDeg: number | null;
  dict: HorizonRotationDict;
}) {
  // Shared ref so the horizon slider can push live previews into the
  // viewer's PSV sphereCorrection while the creator drags.
  const apiRef = useRef<VirtualTourViewerApi | null>(null);
  return (
    <>
      <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        <VirtualTour tour={tour} height="60vh" apiRef={apiRef} />
      </div>
      <div className="mt-6">
        <HorizonRotationControls
          sceneId={sceneId}
          destinationId={destinationId}
          lang={lang}
          initialRollOffsetDeg={initialRollOffsetDeg}
          viewerApiRef={apiRef}
          dict={dict}
        />
      </div>
    </>
  );
}
