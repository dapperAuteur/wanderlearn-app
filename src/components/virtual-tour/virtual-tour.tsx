"use client";
import type { TourLinksLabels } from "./tour-links-overlay";
import type { MomentSwitcherLabels } from "./moment-switcher";
import type { SceneUrlSyncMode } from "@/lib/scene-url-sync";

import dynamic from "next/dynamic";
import type { MutableRefObject } from "react";
import type { VirtualTour as VirtualTourType } from "./types";
import type {
  PositionClick,
  TexturePosition,
  ViewerHandle,
  ViewerOverlay,
  VirtualTourViewerApi,
} from "./virtual-tour-viewer";

export type { PositionClick, TexturePosition, ViewerHandle, ViewerOverlay, VirtualTourViewerApi };

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
  onPositionClick?: (position: PositionClick) => void;
  overlays?: ViewerOverlay[];
  handles?: ViewerHandle[];
  onHandleMove?: (id: string, at: TexturePosition, phase: "move" | "end" | "nudge") => void;
  className?: string;
  apiRef?: MutableRefObject<VirtualTourViewerApi | null>;
  onSceneChange?: (sceneId: string) => void;
  soundOnLabel?: string;
  soundOffLabel?: string;
  sceneLinkLabel?: string;
  sceneLinkFallbackLabel?: string;
  aiEditedLabel?: string;
  tourLinksLabels?: TourLinksLabels;
  momentLabels?: MomentSwitcherLabels;
  kindSwitchLabels?: { loadingVideo: string; loadingPhoto: string };
  /** Scene-label toggle text. English fallbacks apply when omitted. */
  labelsOnLabel?: string;
  labelsOffLabel?: string;
  /** Sound-description toggle text. */
  soundDescriptionOnLabel?: string;
  soundDescriptionOffLabel?: string;
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
  overlays,
  handles,
  onHandleMove,
  className,
  apiRef,
  onSceneChange,
  soundOnLabel,
  soundOffLabel,
  sceneLinkLabel,
  sceneLinkFallbackLabel,
  aiEditedLabel,
  tourLinksLabels,
  momentLabels,
  kindSwitchLabels,
  labelsOnLabel,
  labelsOffLabel,
  soundDescriptionOnLabel,
  soundDescriptionOffLabel,
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
      overlays={overlays}
      handles={handles}
      onHandleMove={onHandleMove}
      className={className}
      apiRef={apiRef}
      onSceneChange={onSceneChange}
      soundOnLabel={soundOnLabel}
      soundOffLabel={soundOffLabel}
      sceneLinkLabel={sceneLinkLabel}
      sceneLinkFallbackLabel={sceneLinkFallbackLabel}
      aiEditedLabel={aiEditedLabel}
      tourLinksLabels={tourLinksLabels}
      momentLabels={momentLabels}
      kindSwitchLabels={kindSwitchLabels}
      labelsOnLabel={labelsOnLabel}
      labelsOffLabel={labelsOffLabel}
      soundDescriptionOnLabel={soundDescriptionOnLabel}
      soundDescriptionOffLabel={soundDescriptionOffLabel}
      sceneUrlSync={sceneUrlSync}
      heldKeys={heldKeys}
      onKeyGranted={onKeyGranted}
    />
  );
}
