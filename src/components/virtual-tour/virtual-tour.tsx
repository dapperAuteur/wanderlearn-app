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
}

export function VirtualTour({
  tour,
  height,
  onPositionClick,
  className,
  apiRef,
}: VirtualTourProps) {
  return (
    <VirtualTourViewer
      tour={tour}
      height={height}
      onPositionClick={onPositionClick}
      className={className}
      apiRef={apiRef}
    />
  );
}
