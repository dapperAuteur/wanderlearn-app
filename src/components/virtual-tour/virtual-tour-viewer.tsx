"use client";

import { useEffect, useRef } from "react";
import { events, Viewer } from "@photo-sphere-viewer/core";
import { EquirectangularVideoAdapter } from "@photo-sphere-viewer/equirectangular-video-adapter";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { VideoPlugin } from "@photo-sphere-viewer/video-plugin";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/video-plugin/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import type { TourScene, VirtualTour } from "./types";

interface VirtualTourViewerProps {
  tour: VirtualTour;
  height?: string;
  onPositionClick?: (position: { yaw: number; pitch: number }) => void;
  className?: string;
}

function sceneToNode(scene: TourScene) {
  return {
    id: scene.id,
    panorama: scene.panorama,
    thumbnail: scene.thumbnail,
    name: scene.name,
    caption: scene.caption,
    gps: undefined,
    links: (scene.links ?? []).map((link) => ({
      nodeId: link.nodeId,
      name: link.name,
      position: link.position,
    })),
    markers: (scene.hotspots ?? []).map((hotspot) => ({
      id: hotspot.id,
      position: hotspot.position,
      image: "/tour-assets/pin.png",
      size: { width: 32, height: 32 },
      anchor: "bottom center",
      tooltip: hotspot.title,
      data: {
        content: hotspot.content,
        audioUrl: hotspot.audioUrl,
        externalUrl: hotspot.externalUrl,
      },
    })),
  };
}

export default function VirtualTourViewer({
  tour,
  height = "70vh",
  onPositionClick,
  className,
}: VirtualTourViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const hasVideo = tour.scenes.some((s) => s.type === "video");
    const startScene =
      tour.scenes.find((s) => s.id === tour.startSceneId) ?? tour.scenes[0];

    const viewer = hasVideo && startScene
      ? new Viewer({
          container: containerRef.current,
          adapter: EquirectangularVideoAdapter,
          panorama: { source: startScene.panorama },
          caption: startScene.caption,
          navbar: ["videoPlay", "videoVolume", "videoTime", "caption", "fullscreen"],
          // Don't pass a `keypoints` option here: PSV treats its presence
          // (even an empty array) as a request for keypoint-driven autorotate
          // and then requires AutorotatePlugin to be registered. We don't do
          // keypoint autorotate, so the plugin config stays empty.
          plugins: [[VideoPlugin, {}]],
        })
      : new Viewer({
          container: containerRef.current,
          navbar: ["zoom", "move", "caption", "fullscreen"],
          defaultZoomLvl: 30,
          plugins: [
            [MarkersPlugin, {}],
            [
              VirtualTourPlugin,
              {
                positionMode: "manual",
                renderMode: "3d",
                nodes: tour.scenes.map(sceneToNode),
                startNodeId: tour.startSceneId,
              },
            ],
          ],
        });

    viewerRef.current = viewer;

    const handleClick = (event: events.ClickEvent) => {
      if (event.data.rightclick) return;
      onPositionClick?.({ yaw: event.data.yaw, pitch: event.data.pitch });
    };

    if (onPositionClick) {
      viewer.addEventListener("click", handleClick);
    }

    return () => {
      if (onPositionClick) {
        viewer.removeEventListener("click", handleClick);
      }
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [tour, onPositionClick]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height }}
      role="application"
      aria-label={`Virtual tour of ${tour.title}`}
    />
  );
}
