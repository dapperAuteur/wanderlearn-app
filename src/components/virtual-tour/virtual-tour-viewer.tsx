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
  // EquirectangularVideoAdapter expects panorama as `{ source: url }`;
  // the default image adapter takes a plain URL string. VirtualTourPlugin
  // passes panorama through opaquely, so we shape it per-scene here.
  const isVideo = scene.type === "video";
  return {
    id: scene.id,
    panorama: isVideo ? { source: scene.panorama } : scene.panorama,
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

    const videoScenes = tour.scenes.filter((s) => s.type === "video");
    const photoScenes = tour.scenes.filter((s) => s.type !== "video");
    const allVideo = videoScenes.length > 0 && photoScenes.length === 0;
    const mixed = videoScenes.length > 0 && photoScenes.length > 0;

    // PSV binds ONE adapter per Viewer instance. Mixed photo+video tours
    // can't render both types in a single viewer, so drop the video scenes
    // and show the photo scenes (which have hotspots + inter-scene links).
    // Creators see this as "my video scene disappeared" — a future branch
    // should surface the constraint in the tour editor before publish.
    const usableScenes = mixed ? photoScenes : tour.scenes;
    if (mixed) {
      console.warn(
        `[virtual-tour] mixed photo+video tour "${tour.title}" — hiding ${videoScenes.length} video scene(s); PSV cannot combine adapters in one viewer.`,
      );
    }

    if (usableScenes.length === 0) return;

    const startSceneId =
      usableScenes.find((s) => s.id === tour.startSceneId)?.id ??
      usableScenes[0].id;

    const viewer = allVideo
      ? new Viewer({
          container: containerRef.current,
          adapter: EquirectangularVideoAdapter,
          navbar: ["videoPlay", "videoVolume", "videoTime", "caption", "fullscreen"],
          plugins: [
            [VideoPlugin, {}],
            [MarkersPlugin, {}],
            [
              VirtualTourPlugin,
              {
                positionMode: "manual",
                renderMode: "3d",
                nodes: usableScenes.map(sceneToNode),
                startNodeId: startSceneId,
              },
            ],
          ],
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
                nodes: usableScenes.map(sceneToNode),
                startNodeId: startSceneId,
              },
            ],
          ],
        });

    viewerRef.current = viewer;

    const handleClick = (event: events.ClickEvent) => {
      if (event.data.rightclick) return;
      onPositionClick?.({ yaw: event.data.yaw, pitch: event.data.pitch });
    };

    const handlePanoramaError = (event: events.PanoramaErrorEvent) => {
      const source =
        typeof event.panorama === "string"
          ? event.panorama
          : (event.panorama as { source?: string })?.source ?? "";
      console.error("[virtual-tour] panorama load failed", {
        source,
        error: event.error,
      });
      viewer.overlay.show({
        id: "wanderlearn-panorama-error",
        title: "This scene couldn't load.",
        text: allVideo
          ? "The 360° video for this scene didn't load. If it was uploaded recently, Cloudinary may still be transcoding — try again in a minute. Otherwise, check the scene in the creator library."
          : "The 360° image for this scene didn't load. Try again, or check the scene in the creator library.",
      });
    };

    if (onPositionClick) {
      viewer.addEventListener("click", handleClick);
    }
    viewer.addEventListener("panorama-error", handlePanoramaError);

    return () => {
      if (onPositionClick) {
        viewer.removeEventListener("click", handleClick);
      }
      viewer.removeEventListener("panorama-error", handlePanoramaError);
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
