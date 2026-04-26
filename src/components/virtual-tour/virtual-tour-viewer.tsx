"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { events, Viewer } from "@photo-sphere-viewer/core";
import { EquirectangularVideoAdapter } from "@photo-sphere-viewer/equirectangular-video-adapter";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { VideoPlugin } from "@photo-sphere-viewer/video-plugin";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/video-plugin/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { DEFAULT_ARROW_COLOR, DEFAULT_PIN_COLOR } from "@/lib/tour-styling";
import type { TourScene, VirtualTour } from "./types";

/** Drop-pin SVG inlined as PSV marker `html`, with a creator-chosen fill. */
function pinMarkerHtml(fill: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M16 2C10 2 5 7 5 13c0 7 11 17 11 17s11-10 11-17c0-6-5-11-11-11z" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/><circle cx="16" cy="13" r="4" fill="#ffffff"/></svg>`;
}

export interface VirtualTourViewerApi {
  getPosition(): { yaw: number; pitch: number };
}

interface VirtualTourViewerProps {
  tour: VirtualTour;
  height?: string;
  onPositionClick?: (position: { yaw: number; pitch: number }) => void;
  className?: string;
  apiRef?: MutableRefObject<VirtualTourViewerApi | null>;
}

function sceneToNode(scene: TourScene, pinColor: string) {
  // EquirectangularVideoAdapter expects panorama as `{ source: url }`;
  // the default image adapter takes a plain URL string. VirtualTourPlugin
  // passes panorama through opaquely, so we shape it per-scene here.
  const isVideo = scene.type === "video";
  const pinHtml = pinMarkerHtml(pinColor);
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
      // `html` (inline SVG) instead of `image` so the pin's fill can be
      // tinted per destination without spawning a per-color SVG asset.
      html: pinHtml,
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
  apiRef,
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

    const startScene =
      usableScenes.find((s) => s.id === tour.startSceneId) ?? usableScenes[0];
    const startSceneId = startScene.id;
    const arrowColor = tour.arrowColor ?? DEFAULT_ARROW_COLOR;
    const pinColor = tour.pinColor ?? DEFAULT_PIN_COLOR;
    // PSV's VirtualTourArrowStyle has no `color` field. The default
    // arrow's SVG renders with `fill="currentColor"`, so tinting goes
    // through CSS — `arrowStyle.style` is forwarded via
    // Object.assign(element.style, …) onto each link button. Setting
    // `color` here lights up the SVG fill via currentColor inheritance.
    const arrowStyle = { style: { color: arrowColor } };
    // If the start scene has a saved start orientation, hand it to PSV as
    // the viewer's initial defaults. Subsequent scene changes are handled
    // via the node-changed listener below.
    const defaultYaw = startScene.startPosition?.yaw;
    const defaultPitch = startScene.startPosition?.pitch;

    const viewer = allVideo
      ? new Viewer({
          container: containerRef.current,
          adapter: EquirectangularVideoAdapter,
          navbar: ["videoPlay", "videoVolume", "videoTime", "caption", "fullscreen"],
          ...(defaultYaw !== undefined ? { defaultYaw } : {}),
          ...(defaultPitch !== undefined ? { defaultPitch } : {}),
          plugins: [
            [VideoPlugin, {}],
            [MarkersPlugin, {}],
            [
              VirtualTourPlugin,
              {
                positionMode: "manual",
                // "2d" renders link arrows as flat markers at the exact
                // yaw/pitch the creator placed. PSV's "3d" mode (default)
                // projects arrows onto a virtual floor plane, so a link
                // placed at upper-left appears at lower-center. For
                // creator-controlled placement, 2d is the right call.
                renderMode: "2d",
                arrowStyle,
                nodes: usableScenes.map((s) => sceneToNode(s, pinColor)),
                startNodeId: startSceneId,
              },
            ],
          ],
        })
      : new Viewer({
          container: containerRef.current,
          navbar: ["zoom", "move", "caption", "fullscreen"],
          defaultZoomLvl: 30,
          ...(defaultYaw !== undefined ? { defaultYaw } : {}),
          ...(defaultPitch !== undefined ? { defaultPitch } : {}),
          plugins: [
            [MarkersPlugin, {}],
            [
              VirtualTourPlugin,
              {
                positionMode: "manual",
                // "2d" renders link arrows as flat markers at the exact
                // yaw/pitch the creator placed. PSV's "3d" mode (default)
                // projects arrows onto a virtual floor plane, so a link
                // placed at upper-left appears at lower-center. For
                // creator-controlled placement, 2d is the right call.
                renderMode: "2d",
                arrowStyle,
                nodes: usableScenes.map((s) => sceneToNode(s, pinColor)),
                startNodeId: startSceneId,
              },
            ],
          ],
        });

    viewerRef.current = viewer;
    if (apiRef) {
      apiRef.current = {
        getPosition: () => {
          const pos = viewer.getPosition();
          return { yaw: pos.yaw, pitch: pos.pitch };
        },
      };
    }

    // Rotate to each scene's saved start orientation on navigation.
    // VirtualTourPlugin fires "node-changed" after the panorama loads.
    const virtualTour = viewer.getPlugin(VirtualTourPlugin);
    const handleNodeChanged = (event: { node: { id: string } }) => {
      const scene = usableScenes.find((s) => s.id === event.node.id);
      if (scene?.startPosition) {
        viewer.rotate(scene.startPosition);
      }
    };
    virtualTour?.addEventListener("node-changed", handleNodeChanged);

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
          ? "The 360° video for this scene didn't load. If you just uploaded it, wait a minute for Cloudinary to finish processing. If the video was edited or shortened before upload, try re-uploading the raw camera file — some export tools produce MP4s that can't be re-served cleanly."
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
      virtualTour?.removeEventListener("node-changed", handleNodeChanged);
      viewer.destroy();
      viewerRef.current = null;
      if (apiRef) apiRef.current = null;
    };
  }, [tour, onPositionClick, apiRef]);

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
