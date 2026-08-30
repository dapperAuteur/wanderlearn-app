"use client";
import type { SceneUrlSyncMode } from "@/lib/scene-url-sync";

import dynamic from "next/dynamic";
import type { MutableRefObject } from "react";
import type { VirtualTour as VirtualTourType } from "./types";
import type { VirtualTourViewerApi } from "./virtual-tour-viewer";

export type { VirtualTourViewerApi };

const VirtualTourViewer = dynamic(() => import("./virtual-tour-viewer"), {
  ssr: false,
  loading: () => (
    <div
      className="flex w-full items-center justify-center bg-zinc-900 text-sm text-zinc-400"
      style={{ height: "70vh" }}
    >
      Loading virtual tour…
    </div>
  ),
});

interface VirtualTourProps {
  tour: VirtualTourType;
  height?: string;
  onPositionClick?: (position: { yaw: number; pitch: number }) => void;
  className?: string;
  apiRef?: MutableRefObject<VirtualTourViewerApi | null>;
  onSceneChange?: (sceneId: string) => void;
  soundOnLabel?: string;
  soundOffLabel?: string;
  sceneLinkLabel?: string;
  sceneLinkFallbackLabel?: string;
  /** Scene-label toggle text. English fallbacks apply when omitted. */
  labelsOnLabel?: string;
  labelsOffLabel?: string;
  /** Keep `?scene=` on the current scene; see VirtualTourViewer. */
  sceneUrlSync?: SceneUrlSyncMode;
  /** Hunt game mechanics; see VirtualTourViewer. Omit for an ordinary tour. */
  heldKeys?: readonly string[];
  onKeyGranted?: (key: string, hotspotId: string) => void;
}

export function VirtualTour({
  tour,
  height,
  onPositionClick,
  className,
  apiRef,
  onSceneChange,
  soundOnLabel,
  soundOffLabel,
  sceneLinkLabel,
  sceneLinkFallbackLabel,
  labelsOnLabel,
  labelsOffLabel,
  sceneUrlSync,
  heldKeys,
  onKeyGranted,
}: VirtualTourProps) {
  // Forwards the arrow labels. They were declared in this component's props
  // and never passed on, so a caller supplying localized labels would have got
  // the viewer's English defaults and no warning. Nothing passes them today —
  // which is precisely why it would have been found the hard way.
  return (
    <VirtualTourViewer
      tour={tour}
      height={height}
      onPositionClick={onPositionClick}
      className={className}
      apiRef={apiRef}
      onSceneChange={onSceneChange}
      soundOnLabel={soundOnLabel}
      soundOffLabel={soundOffLabel}
      sceneLinkLabel={sceneLinkLabel}
      sceneLinkFallbackLabel={sceneLinkFallbackLabel}
      labelsOnLabel={labelsOnLabel}
      labelsOffLabel={labelsOffLabel}
      sceneUrlSync={sceneUrlSync}
      heldKeys={heldKeys}
      onKeyGranted={onKeyGranted}
    />
  );
}
