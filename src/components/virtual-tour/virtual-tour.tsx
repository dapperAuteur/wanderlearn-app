"use client";

import dynamic from "next/dynamic";
import type { VirtualTour as VirtualTourType } from "./types";

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
}

export function VirtualTour({ tour, height, onPositionClick, className }: VirtualTourProps) {
  return (
    <VirtualTourViewer
      tour={tour}
      height={height}
      onPositionClick={onPositionClick}
      className={className}
    />
  );
}
