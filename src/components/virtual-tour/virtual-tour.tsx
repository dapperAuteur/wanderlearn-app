"use client";

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
  heldKeys,
  onKeyGranted,
}: VirtualTourProps) {
  return (
    <VirtualTourViewer
      tour={tour}
      height={height}
      onPositionClick={onPositionClick}
      className={className}
      apiRef={apiRef}
      heldKeys={heldKeys}
      onKeyGranted={onKeyGranted}
    />
  );
}
