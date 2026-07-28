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
  /**
   * Override the current panorama's sphere-correction roll at runtime.
   * Pass a number (degrees) for a live preview; pass `null` to clear
   * the runtime override and let PSV fall back to the per-node value
   * baked in at viewer mount. Used by the horizon-rotation slider to
   * show creators what their tweak looks like before they save.
   *
   * Note: this updates the GLOBAL viewer sphereCorrection. Per-node
   * settings re-apply on the next scene navigation, so unsaved
   * previews don't leak to other scenes.
   */
  setRoll(degrees: number | null): void;
}

interface VirtualTourViewerProps {
  tour: VirtualTour;
  height?: string;
  onPositionClick?: (position: { yaw: number; pitch: number }) => void;
  className?: string;
  apiRef?: MutableRefObject<VirtualTourViewerApi | null>;
}

function sceneToNode(scene: TourScene, pinColor: string, pinIconUrl?: string) {
  // EquirectangularVideoAdapter expects panorama as `{ source: url }`;
  // the default image adapter takes a plain URL string. VirtualTourPlugin
  // passes panorama through opaquely, so we shape it per-scene here.
  const isVideo = scene.type === "video";
  const pinHtml = pinMarkerHtml(pinColor);
  // Custom-icon mode uses `image: <url>` so the creator's uploaded asset
  // shows on every hotspot. Default mode uses inline SVG via `html` so the
  // pin's fill can be tinted per destination without spawning a per-color
  // SVG asset. PSV accepts only one of `image` / `html` per marker.
  const markerVisual = pinIconUrl
    ? { image: pinIconUrl, size: { width: 48, height: 48 } }
    : { html: pinHtml, size: { width: 32, height: 32 } };
  // Creator-applied horizon-tilt correction. PSV accepts radians (number)
  // or a units-suffixed string like "5deg"; we use the latter so the DB
  // value (degrees) doesn't need a radians conversion at the boundary.
  // Skip the property entirely when the scene has no correction so PSV
  // doesn't fight a `{ roll: 0 }` against its own pose-from-XMP path.
  const sphereCorrection =
    scene.rollOffsetDeg !== undefined && scene.rollOffsetDeg !== 0
      ? { roll: `${scene.rollOffsetDeg}deg` }
      : undefined;
  return {
    id: scene.id,
    panorama: isVideo ? { source: scene.panorama } : scene.panorama,
    thumbnail: scene.thumbnail,
    name: scene.name,
    caption: scene.caption,
    gps: undefined,
    sphereCorrection,
    links: (scene.links ?? []).map((link) => ({
      nodeId: link.nodeId,
      name: link.name,
      position: link.position,
    })),
    markers: (scene.hotspots ?? []).map((hotspot) => ({
      id: hotspot.id,
      position: hotspot.position,
      ...markerVisual,
      anchor: "bottom center",
      tooltip: hotspot.title,
      data: {
        content: hotspot.content,
        audioUrl: hotspot.audioUrl,
        externalUrl: hotspot.externalUrl,
        // Cross-tour target passes through marker data so the
        // select-marker handler can dispatch the wanderlearn:cross-tour-link
        // event without re-fetching anything.
        crossTourTarget: hotspot.crossTourTarget,
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
    // When a creator uploaded a custom arrow image, hand it to PSV as
    // `arrowStyle.image` — that path renders an <img>, which doesn't
    // inherit currentColor, so tourArrowColor stops applying. Stick
    // with the SVG-via-color-tint path otherwise so the existing
    // per-destination accent still works.
    const arrowStyle: { image?: string; style?: { color: string } } = tour.arrowImageUrl
      ? { image: tour.arrowImageUrl }
      : { style: { color: arrowColor } };
    // Soften the inter-scene transition. PSV's VirtualTourPlugin defaults
    // to `speed: '20rpm'` (≈3s per full revolution) and rotates toward
    // the link's position before swapping panoramas — feels snappy and
    // startling. Slowing to 5rpm makes the rotation deliberate so the
    // learner can track where they're being taken. Fade effect is kept
    // (also the default) to mask the panorama swap itself.
    const transitionOptions = {
      effect: "fade" as const,
      speed: "5rpm",
      rotation: true,
      showLoader: true,
    };
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
                transitionOptions,
                nodes: usableScenes.map((s) => sceneToNode(s, pinColor, tour.pinIconUrl)),
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
                transitionOptions,
                nodes: usableScenes.map((s) => sceneToNode(s, pinColor, tour.pinIconUrl)),
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
        setRoll: (degrees) => {
          // PSV's sphereCorrection is updatable. Setting to `{}` clears
          // the override; the next node-changed event will re-apply the
          // node's own sphereCorrection from its config.
          viewer.setOption(
            "sphereCorrection",
            degrees === null ? {} : { roll: `${degrees}deg` },
          );
        },
      };
    }

    // Rotate to each scene's saved start orientation on navigation.
    // VirtualTourPlugin fires "node-changed" after the panorama loads.
    // Using `animate` (not `rotate`) so the post-transition reframe is
    // a smooth glide rather than a snap, matching the deliberate pace
    // of the inter-scene fade above. `prefers-reduced-motion: reduce`
    // visitors get an instant set instead of the animation.
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const virtualTour = viewer.getPlugin(VirtualTourPlugin);
    // Arrival heading is resolved per traversed link, then per scene.
    //
    // This used to reframe to the destination scene's startPosition on every
    // transition, whichever door the visitor came through, so walking a corridor
    // backwards still snapped you to the same heading — reading as a teleport
    // rather than a walk. PSV hands us `fromNode` on node-changed, so we can look
    // up the link actually traversed and honour its arrival heading when the
    // creator has set one. Unset falls back to the old behaviour exactly.
    const handleNodeChanged = (event: {
      node: { id: string };
      fromNode?: { id: string } | null;
    }) => {
      const scene = usableScenes.find((s) => s.id === event.node.id);
      const traversedLink = event.fromNode
        ? usableScenes
            .find((s) => s.id === event.fromNode!.id)
            ?.links?.find((l) => l.nodeId === event.node.id)
        : undefined;
      const target = traversedLink?.arrivalPosition ?? scene?.startPosition;
      if (!target) return;
      if (reducedMotion) {
        viewer.rotate(target);
      } else {
        viewer.animate({ ...target, speed: "10rpm" });
      }
    };
    virtualTour?.addEventListener("node-changed", handleNodeChanged);

    // Hotspot click handling. Markers carry { content, audioUrl, externalUrl }
    // in their `data` payload, but PSV doesn't act on those by default —
    // without a `select-marker` listener, clicking a pin only highlights it.
    // Open external URLs in a new tab; show plain content in PSV's built-in
    // notification widget. Audio handling is intentionally deferred — needs
    // its own player UI / pause-other-media logic.
    //
    // Debounce guard: PSV fires `select-marker` twice in quick succession on
    // touch devices (touchend + synthesized click both pass through), and on
    // some desktop click paths a re-selection of the same marker also fires
    // a second event. Skip duplicate fires for the same marker within 500ms
    // so a hotspot opens exactly one tab per tap.
    const markersPlugin = viewer.getPlugin(MarkersPlugin);
    type MarkerData = {
      content?: string;
      audioUrl?: string;
      externalUrl?: string;
      crossTourTarget?: {
        destinationId: string;
        slug: string;
        name: string;
        description?: string;
        posterUrl?: string;
      };
    };
    let lastSelect: { id: string; at: number } | null = null;
    const containerEl = containerRef.current;
    const handleSelectMarker = (event: {
      marker: { id?: string; config?: { id?: string; data?: MarkerData } };
    }) => {
      const markerId = event.marker.id ?? event.marker.config?.id ?? "";
      const now = Date.now();
      if (lastSelect && lastSelect.id === markerId && now - lastSelect.at < 500) return;
      lastSelect = { id: markerId, at: now };

      const data = event.marker.config?.data;
      if (!data) return;
      // Cross-tour link takes precedence over content/external: it's
      // the explicit "go elsewhere" type, and the action layer cleared
      // those other payloads when the cross-tour target was set. The
      // wrapping React component picks up this event and renders the
      // preview card; the viewer itself does no navigation.
      if (data.crossTourTarget) {
        const detail = data.crossTourTarget;
        // Cancelable so a wrapping React listener can show the
        // preview card via preventDefault(). When no wrapper listens
        // (e.g., inside a course lesson_block render), the default
        // action runs: open the target tour in a new tab. That keeps
        // cross-tour hotspots functional in any context without
        // requiring every embed to mount the preview-card UI.
        const ce = new CustomEvent("wanderlearn:cross-tour-link", {
          bubbles: true,
          cancelable: true,
          detail,
        });
        const allowDefault = containerEl?.dispatchEvent(ce) ?? true;
        if (allowDefault) {
          window.open(`/en/tours/${detail.slug}`, "_blank", "noopener,noreferrer");
        }
        return;
      }
      if (data.externalUrl) {
        window.open(data.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (data.content) {
        viewer.notification.show({ content: data.content, timeout: 6000 });
      }
    };
    markersPlugin?.addEventListener("select-marker", handleSelectMarker);

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
          ? "The 360° video for this scene didn't load. If you just uploaded it, wait a minute for Cloudinary to finish processing. If the video was edited or shortened before upload, try re-uploading the raw camera file. Some export tools produce MP4s that can't be re-served cleanly."
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
      markersPlugin?.removeEventListener("select-marker", handleSelectMarker);
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
