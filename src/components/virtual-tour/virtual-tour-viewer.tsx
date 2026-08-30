"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { events, Viewer } from "@photo-sphere-viewer/core";
import { EquirectangularVideoAdapter } from "@photo-sphere-viewer/equirectangular-video-adapter";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { VideoPlugin } from "@photo-sphere-viewer/video-plugin";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import { MapPlugin } from "@photo-sphere-viewer/map-plugin";
import { mapSizeForViewport } from "@/lib/map-size";
import { opacityToFraction, resolveOpacityPercent } from "@/lib/icon-opacity";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/video-plugin/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import "@photo-sphere-viewer/map-plugin/index.css";
import { DEFAULT_ARROW_COLOR, DEFAULT_PIN_COLOR } from "@/lib/tour-styling";
import type { TourScene, VirtualTour } from "./types";
import { capture } from "@/lib/analytics/capture";
import { createTourVisitAndCheckOpen } from "@/lib/analytics/tour-visit";
import { useAmbientAudio } from "./use-ambient-audio";
import { useTransitionAudio } from "./use-transition-audio";
import { resolveTransitionAudioUrl } from "@/lib/transition-audio";

/**
 * The scene-link arrow, copied verbatim from the plugin's own DEFAULT_ARROW
 * (@photo-sphere-viewer/virtual-tour-plugin). We render the arrow ourselves in
 * order to give the button an accessible name, and reproducing the exact path
 * keeps the visual identical — this change is about the name, not the look.
 *
 * `currentColor` is load-bearing: it is what lets a destination's accent tint
 * the arrow via arrowStyle.style.color.
 */
const PSV_DEFAULT_ARROW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
  '<path fill-rule="even-odd" fill="currentColor" d="' +
  "M50,50 m45,0 a45,45 0 1,0 -90,0 a45,45 0 1,0 90,0 " +
  "M50,50 m38,0 a38,38 0 0,1 -76,0 a38,38 0 0,1 76,0 " +
  "M50,50 m30,0 a30,30 0 1,0 -60,0 a30,30 0 1,0 60,0 " +
  "M50,40 m2.5,-2.5 l17.5,17.5 a 2.5,2.5 0 0 1 -5,5 l-15,-15 l-15,15 " +
  "a 2.5,2.5 0 0 1 -5,-5 l17.5,-17.5 a 3.5,3.5 0 0 1 5,0" +
  '"/></svg>';

/** Drop-pin SVG inlined as PSV marker `html`, with a creator-chosen fill. */
function pinMarkerHtml(fill: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M16 2C10 2 5 7 5 13c0 7 11 17 11 17s11-10 11-17c0-6-5-11-11-11z" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/><circle cx="16" cy="13" r="4" fill="#ffffff"/></svg>`;
}

export interface VirtualTourViewerApi {
  getPosition(): { yaw: number; pitch: number };
  /**
   * Jump directly to a scene, bypassing the link graph. Used by the stop rail
   * so a visitor can go anywhere in the tour without walking the arrows.
   * Unknown ids are ignored rather than throwing.
   */
  goToScene(sceneId: string): void;
  /**
   * Live-preview arrow and pin opacity without rebuilding the viewer.
   *
   * Percentages, or null to fall back to what the tour/scene resolved to at
   * mount. Used by the creator's sliders so a drag is visible as it happens —
   * the same shape as `setRoll`.
   */
  setIconOpacity(next: { link?: number | null; hotspot?: number | null }): void;
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
  /**
   * Point the live viewer at a position, so a creator adjusting numbers in a
   * form can SEE the result instead of saving and reloading to find out.
   * Instant, not animated: this is a preview following a button press, and a
   * glide would lag behind repeated clicks.
   */
  rotateTo(position: { yaw: number; pitch: number }): void;
}

interface VirtualTourViewerProps {
  tour: VirtualTour;
  height?: string;
  onPositionClick?: (position: { yaw: number; pitch: number }) => void;
  className?: string;
  apiRef?: MutableRefObject<VirtualTourViewerApi | null>;
  /**
   * Fires whenever the visible scene changes, including via link arrows and
   * map pins. Lets a creator surface act on the scene actually on screen
   * rather than the one the page was opened with.
   */
  onSceneChange?: (sceneId: string) => void;
  /**
   * Keys the visitor currently holds, for hunt game mechanics. A hotspot whose `requiresKeys` are
   * not all held stays hidden; a link whose `requiresKeys` are not all held renders no arrow.
   * Omit entirely (the default) and every hotspot and link behaves exactly as it did before hunts
   * existed, which is what every non-hunt tour needs.
   */
  heldKeys?: readonly string[];
  /** Called when the visitor opens a hotspot carrying `grantsKey`. */
  onKeyGranted?: (key: string, hotspotId: string) => void;
  /**
   * Labels for the ambient-sound toggle. English fallbacks match the viewer's
   * existing hardcoded aria-label; surfaces that have a dictionary pass the
   * translated strings.
   */
  soundOnLabel?: string;
  soundOffLabel?: string;
  /** Screen-reader prefix for the ambient-sound description. */
  soundDescriptionLabel?: string;
  /** Visitor-facing labels for the scene-name toggle. */
  labelsOnLabel?: string;
  labelsOffLabel?: string;
  /**
   * Accessible name for a scene-link arrow. `{name}` is replaced with the
   * creator's doorway label, or the target scene's name. English fallbacks
   * apply when omitted, same posture as the sound labels.
   */
  sceneLinkLabel?: string;
  sceneLinkFallbackLabel?: string;
}

/** True when every required key is held. No requirement means always visible. */
function unlocked(requiresKeys: string[] | undefined, held: ReadonlySet<string>): boolean {
  if (!requiresKeys || requiresKeys.length === 0) return true;
  return requiresKeys.every((k) => held.has(k));
}

function sceneToNode(
  scene: TourScene,
  pinColor: string,
  pinIconUrl?: string,
  map?: { imageUrl: string; width: number; height: number },
  hotspotIconSize?: number,
  held: ReadonlySet<string> = new Set(),
) {
  // EquirectangularVideoAdapter expects panorama as `{ source: url }`;
  // the default image adapter takes a plain URL string. VirtualTourPlugin
  // passes panorama through opaquely, so we shape it per-scene here.
  const isVideo = scene.type === "video";
  const pinHtml = pinMarkerHtml(pinColor);
  // Custom-icon mode uses `image: <url>` so the creator's uploaded asset
  // shows on every hotspot. Default mode uses inline SVG via `html` so the
  // pin's fill can be tinted per destination without spawning a per-color
  // SVG asset. PSV accepts only one of `image` / `html` per marker.
  // Defaults differ by mode: a creator's uploaded icon reads smaller than the
  // built-in pin at the same box, so it has always been 48 vs 32. A
  // per-destination override replaces whichever default applies.
  const pinSize = hotspotIconSize ?? (pinIconUrl ? 48 : 32);
  const markerVisual = pinIconUrl
    ? { image: pinIconUrl, size: { width: pinSize, height: pinSize } }
    : { html: pinHtml, size: { width: pinSize, height: pinSize } };
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
    // Always defined, and always carrying the scene name. PSV core does
    // `if (options.caption === undefined) options.caption = this.config.caption`
    // on every setPanorama, so a scene with no caption of its own inherited the
    // viewer's INITIAL caption and the navbar stayed stuck on the start scene's
    // name for the whole tour.
    // The `!== name` guard is for the single-scene tours that lesson blocks and
    // the media preview dialog synthesize, where name and caption are the same
    // string — without it the navbar reads "Chocolate room — Chocolate room".
    caption:
      scene.caption && scene.caption !== scene.name
        ? `${scene.name} — ${scene.caption}`
        : scene.name,
    gps: undefined,
    sphereCorrection,
    // MapPlugin wants pixel coordinates on the map image — this is the single
    // normalized→pixel conversion point. `false` hides the node from the map
    // (unplaced scenes stay off it; also the future maze/games hook).
    map:
      map && scene.mapPosition
        ? { x: scene.mapPosition.x * map.width, y: scene.mapPosition.y * map.height }
        : (false as const),
    // Locked links are omitted rather than hidden: PSV renders an arrow for every link it is given,
    // so a "hidden" one would still be a visible arrow. Recomputed on every key change via
    // updateNode() below.
    links: (scene.links ?? [])
      .filter((link) => unlocked(link.requiresKeys, held))
      .map((link) => ({
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
        // select-marker handler can dispatch the wanderlust:cross-tour-link
        // event without re-fetching anything.
        crossTourTarget: hotspot.crossTourTarget,
        grantsKey: hotspot.grantsKey,
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
  onSceneChange,
  heldKeys,
  onKeyGranted,
  soundOnLabel = "Sound on",
  soundOffLabel = "Sound off",
  soundDescriptionLabel = "Sound in this scene",
  labelsOnLabel = "Labels on",
  labelsOffLabel = "Labels off",
  sceneLinkLabel = "Go to {name}",
  sceneLinkFallbackLabel = "Go to the next scene",
}: VirtualTourViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Which scene's ambient bed should be playing, and whether the visitor has
  // asked for sound at all. Sound starts off: see use-ambient-audio.
  const [audioSceneId, setAudioSceneId] = useState<string | undefined>(
    () => tour.scenes[0]?.id,
  );
  const [soundOn, setSoundOn] = useState(false);
  /**
   * Whether the scene name/caption strip is showing.
   *
   * Starts from the tour's default and is the VISITOR's from then on — their
   * choice must not be undone by walking into the next room. Session-only, like
   * the sound toggle: a preference about one visit, not a stored setting.
   */
  const [labelsOn, setLabelsOn] = useState(tour.showSceneLabels !== false);
  // Read inside the PSV effect without becoming a dependency of it: including
  // `labelsOn` there would tear down and rebuild the viewer on every toggle,
  // reloading the panorama to hide a line of text.
  const labelsOnRef = useRef(labelsOn);
  labelsOnRef.current = labelsOn;
  // Set when the viewer is built; lets the toggle reach into the live viewer.
  const setNavbarCaptionRef = useRef<((show: boolean) => void) | null>(null);
  /**
   * Where the camera was pointing when the viewer was last torn down.
   *
   * The effect below rebuilds the whole viewer whenever `tour` changes
   * identity — which `router.refresh()` causes after every save in the scene
   * editor. Without this, saving a scene threw the creator back to the
   * panorama's default heading, so checking your own edit meant dragging back
   * to where you had been. Reported by BAM: "after saving inside edit scene
   * screen, refresh with view of scene that was saved or view prior to
   * pressing save button."
   *
   * Keyed by scene id: restoring a heading onto a DIFFERENT panorama would be
   * worse than resetting, because the creator's start-position work would be
   * silently overridden by wherever they happened to be looking.
   */
  const lastPositionRef = useRef<{ sceneId: string; yaw: number; pitch: number } | null>(null);

  const transitionAudio = useTransitionAudio();
  // Read through a ref inside the PSV effect: including these in its deps
  // would tear down and rebuild the whole viewer whenever sound is toggled,
  // reloading the panorama and losing the visitor's heading.
  const transitionAudioRef = useRef<{ soundOn: boolean; play: (url: string | null) => void }>({
    soundOn: false,
    play: () => {},
  });
  transitionAudioRef.current = { soundOn, play: transitionAudio.play };
  useAmbientAudio({
    url: tour.scenes.find((s) => s.id === audioSceneId)?.ambientAudioUrl,
    // Absent means loop: every scene behaved that way before the column
    // existed, and a silent change to one-shot would be a regression.
    loop: tour.scenes.find((s) => s.id === audioSceneId)?.ambientAudioLoop ?? true,
    enabled: soundOn,
  });
  const viewerRef = useRef<Viewer | null>(null);
  // Held keys and the grant callback live in refs, NOT in the construction effect's dependency
  // array. Putting them in deps would tear down and rebuild the viewer every time the visitor earned
  // a key, which reloads the panorama and throws away their heading.
  const heldKeysRef = useRef<ReadonlySet<string>>(new Set(heldKeys ?? []));
  const onKeyGrantedRef = useRef(onKeyGranted);
  useEffect(() => {
    heldKeysRef.current = new Set(heldKeys ?? []);
    onKeyGrantedRef.current = onKeyGranted;
  }, [heldKeys, onKeyGranted]);

  /**
   * Apply the key mechanics to an already-mounted viewer.
   *
   * Runs when the held-key set changes, and again on every node change (a node's markers only exist
   * once that node is loaded, so visibility has to be re-applied on arrival).
   *
   * Two PSV APIs do the work, both verified against the installed typings rather than assumed:
   *   · MarkersPlugin.hideMarker/showMarker  — per-marker, no re-render of the rest
   *   · VirtualTourPlugin.updateNode         — merges into ONE node, unlike setNodes() which resets
   *                                            the tour and reloads the panorama
   *
   * Nodes with no key-gated links are skipped entirely, so an ordinary tour never calls updateNode
   * and behaves exactly as it did before this existed.
   */
  const applyKeyMechanics = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const held = heldKeysRef.current;

    // The generic form: getPlugin() returns AbstractPlugin without it, which has addEventListener
    // but none of the typed methods this function relies on.
    const markers = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
    const virtualTour = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);

    // Links: only touch nodes that actually have a gated link.
    for (const scene of tour.scenes) {
      const links = scene.links ?? [];
      if (!links.some((l) => l.requiresKeys && l.requiresKeys.length > 0)) continue;
      try {
        virtualTour?.updateNode({
          id: scene.id,
          links: links
            .filter((link) => unlocked(link.requiresKeys, held))
            .map((link) => ({ nodeId: link.nodeId, name: link.name, position: link.position })),
        });
      } catch {
        // updateNode throws outside client mode. Nothing to recover, and a game mechanic must never
        // take the viewer down.
      }
    }

    // Markers: only the current node's markers exist right now.
    let currentId: string | undefined;
    try {
      currentId = virtualTour?.getCurrentNode()?.id;
    } catch {
      currentId = undefined;
    }
    const scene = tour.scenes.find((sc) => sc.id === currentId);
    for (const hotspot of scene?.hotspots ?? []) {
      if (!hotspot.requiresKeys || hotspot.requiresKeys.length === 0) continue;
      try {
        if (unlocked(hotspot.requiresKeys, held)) markers?.showMarker(hotspot.id);
        else markers?.hideMarker(hotspot.id);
      } catch {
        // The marker may not be mounted yet on a mid-transition call; the node-changed pass catches it.
      }
    }
  }, [tour.scenes]);

  // Held in a ref as well, so the viewer-construction effect's node-changed handler can call it
  // without taking applyKeyMechanics as a dependency (which would rebuild the viewer).
  const applyKeyMechanicsRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    applyKeyMechanicsRef.current = applyKeyMechanics;
    applyKeyMechanics();
  }, [applyKeyMechanics, heldKeys]);

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
    // ── Scene-link arrows ───────────────────────────────────────────────────
    //
    // These are the primary way anyone walks a tour, and until now they were
    // unusable without sight: PSV's default arrow is a <button> with an icon
    // and no accessible name, so a screen reader announced "button" and
    // nothing else. axe flagged it CRITICAL. It was never caught because tour
    // pages have no automated a11y coverage (they need seeded data), so the
    // flagship surface had none at all.
    //
    // The fix is supported upstream rather than a DOM hack: PSV calls
    // `arrowStyle.element(link)` per arrow and hands it the link, so we can
    // build a properly-labelled control and still let the plugin own
    // placement, sizing and classes.
    //
    // Two halves, and the second is the one that is easy to forget:
    //
    //  1. A NAME. From the creator's doorway label ("Into the gallery") when
    //     they wrote one, else the target scene's own name.
    //  2. KEYBOARD OPERATION. PSV navigates from a viewer-level ClickEvent,
    //     not from the button, so a focused arrow did nothing on Enter. A
    //     labelled control you cannot activate is still broken — it just fails
    //     later. `event.detail === 0` distinguishes a keyboard activation from
    //     a mouse click, so we handle only the former and let real clicks flow
    //     to PSV exactly as before rather than navigating twice.
    const sceneNameById = new Map(tour.scenes.map((scene) => [scene.id, scene.name]));
    const arrowLabelFor = (link: { nodeId: string; name?: string }) => {
      const target = link.name?.trim() || sceneNameById.get(link.nodeId);
      return target ? sceneLinkLabel.replace("{name}", target) : sceneLinkFallbackLabel;
    };

    const buildArrowElement = (link: { nodeId: string; name?: string }) => {
      const button = document.createElement("button");
      button.type = "button";
      // PSV styles and hit-tests on this class; it also adds
      // `.psv-virtual-tour-link` itself and stamps the link onto the node.
      button.className = "psv-virtual-tour-arrow";
      button.setAttribute("aria-label", arrowLabelFor(link));

      if (tour.arrowImageUrl) {
        const image = document.createElement("img");
        image.src = tour.arrowImageUrl;
        // Empty alt, deliberately: the button already carries the name, and a
        // described image inside a labelled button reads the destination twice.
        image.alt = "";
        image.style.width = "100%";
        image.style.height = "100%";
        button.appendChild(image);
      } else {
        // Copied verbatim from the plugin's own DEFAULT_ARROW so the arrow
        // looks exactly as it did — this change is about the accessible name,
        // not the visual. `currentColor` is what lets the per-destination
        // accent still tint it through `arrowStyle.style.color` below.
        // RE-CHECK THIS on any @photo-sphere-viewer/virtual-tour-plugin
        // upgrade: if upstream restyles its arrow, this silently keeps the old
        // one.
        button.innerHTML = PSV_DEFAULT_ARROW_SVG;
      }

      button.addEventListener("click", (event) => {
        // detail === 0 means Enter/Space on a focused button. A real pointer
        // click reports >= 1 and is left alone, so PSV's own handler runs and
        // nothing navigates twice.
        if (event.detail !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        virtualTourPluginRef?.setCurrentNode(link.nodeId);
      });

      return button;
    };

    // Assigned once the viewer exists, a few lines below. The arrow handlers
    // above only read it when someone actually presses a key, by which point
    // it is set.
    let virtualTourPluginRef: VirtualTourPlugin | null = null;

    // `image` is deliberately NOT passed alongside `element`: PSV checks
    // `style.image` first and would render a bare <img>, throwing away the
    // labelled button. The custom image is nested inside the button instead.
    const arrowStyle: {
      element?: (link: { nodeId: string; name?: string }) => HTMLElement;
      style?: { color: string };
      size?: { width: number; height: number };
    } = tour.arrowImageUrl
      ? { element: buildArrowElement }
      : { element: buildArrowElement, style: { color: arrowColor } };
    // PSV's VirtualTourArrowStyle.size is honoured in both image and SVG modes.
    if (tour.sceneLinkIconSize) {
      arrowStyle.size = { width: tour.sceneLinkIconSize, height: tour.sceneLinkIconSize };
    }
    // Soften the inter-scene transition. PSV's VirtualTourPlugin defaults
    // to `speed: '20rpm'` (≈3s per full revolution) and rotates toward
    // the link's position before swapping panoramas — feels snappy and
    // startling. Slowing to 5rpm makes the rotation deliberate so the
    // learner can track where they're being taken. Fade effect is kept
    // (also the default) to mask the panorama swap itself.
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Resolve where the camera should point on arrival at `toId`, for a visitor
    // who came from `fromId`: the traversed link's arrival heading, else the
    // target scene's own start view. Shared by the transition and, as a
    // safety net, nothing else — see the note on handleNodeChanged.
    const arrivalPositionFor = (
      toId: string,
      fromId?: string | null,
    ): { yaw: number; pitch: number } | undefined => {
      const link = fromId
        ? usableScenes.find((s) => s.id === fromId)?.links?.find((l) => l.nodeId === toId)
        : undefined;
      return link?.arrivalPosition ?? usableScenes.find((s) => s.id === toId)?.startPosition;
    };

    // Arrival orientation is applied DURING the panorama swap, not after it.
    //
    // PSV passes `rotateTo` straight through to setPanorama's `position`, so the
    // incoming scene is composited already facing the right way. Previously we
    // let the new scene open at the old scene's link heading and then animated
    // to the arrival heading on node-changed — the visitor watched the room spin
    // under them every single transition, which reads as being shoved rather
    // than walking.
    //
    // `rotation: false` for the same reason: no blended rotation during the
    // fade either. Cut to the correct view. Returning nothing for rotateTo
    // leaves PSV's default (the traversed link's position), which is the right
    // fallback for a scene with no arrival or start orientation set.
    const transitionOptions = (
      toNode: { id: string },
      fromNode?: { id: string },
    ) => {
      const rotateTo = arrivalPositionFor(toNode.id, fromNode?.id);
      return {
        // prefers-reduced-motion: cut straight to the new scene. With
        // rotation:false this is a true instant swap — PSV only animates the
        // outgoing panorama when rotation is on AND the effect is "none".
        effect: (reducedMotion ? "none" : "fade") as "none" | "fade",
        speed: "5rpm",
        rotation: false,
        showLoader: true,
        ...(rotateTo ? { rotateTo } : {}),
      };
    };
    // If the start scene has a saved start orientation, hand it to PSV as
    // the viewer's initial defaults. Subsequent scene changes are handled
    // via the node-changed listener below.
    const defaultYaw = startScene.startPosition?.yaw;
    const defaultPitch = startScene.startPosition?.pitch;

    // MapPlugin renders the visitor mini-map when the tour carries one. Verified
    // against the installed 5.14.1 d.ts: position, shape, size,
    // minimizeOnHotspotClick are top-level config keys. VirtualTourPlugin picks
    // the plugin up automatically and manages hotspots + you-are-here itself.
    // Mutable [ctor, config] tuples + an imperatively-built config: PSV's
    // plugin typing rejects readonly tuples and union-typed optional keys.
    const mapPluginEntry: [typeof MapPlugin, Record<string, unknown>][] = tour.map
      ? [
          [
            MapPlugin,
            {
              position: "bottom left",
              shape: "round",
              // Sized to the viewport, not flat. A fixed 180px is a quarter of
              // a phone screen sitting on top of the photograph — the map is
              // an orientation aid and at that size it competes with the thing
              // it exists to help you look at. See mapSizeForViewport.
              size: mapSizeForViewport(
                typeof window === "undefined" ? 1280 : window.innerWidth,
              ),
              minimizeOnHotspotClick: true,
            },
          ],
        ]
      : [];
    const tourPluginConfig: Record<string, unknown> = {
      positionMode: "manual",
      // "2d" renders link arrows as flat markers at the exact yaw/pitch the
      // creator placed (see the inline note at the original config site).
      renderMode: "2d",
      arrowStyle,
      transitionOptions,
      nodes: usableScenes.map((s) =>
        sceneToNode(s, pinColor, tour.pinIconUrl, tour.map, tour.hotspotIconSize, new Set(heldKeys ?? [])),
      ),
      startNodeId: startSceneId,
    };
    if (tour.map) tourPluginConfig.map = { imageUrl: tour.map.imageUrl };

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
            ...mapPluginEntry,
            [VirtualTourPlugin, tourPluginConfig],
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
            ...mapPluginEntry,
            [VirtualTourPlugin, tourPluginConfig],
          ],
        });

    viewerRef.current = viewer;
    if (apiRef) {
      apiRef.current = {
        getPosition: () => {
          const pos = viewer.getPosition();
          return { yaw: pos.yaw, pitch: pos.pitch };
        },
        rotateTo: (position) => {
          viewer.rotate(position);
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
        setIconOpacity: (next) => {
          const el = containerRef.current;
          if (!el) return;
          // Writing the custom property is the whole mechanism: the CSS in
          // globals.css reads it, so no PSV API is touched and nothing rebuilds.
          if (next.link !== undefined) {
            if (next.link === null) el.style.removeProperty("--wl-link-opacity");
            else el.style.setProperty("--wl-link-opacity", String(opacityToFraction(next.link)));
          }
          if (next.hotspot !== undefined) {
            if (next.hotspot === null) el.style.removeProperty("--wl-hotspot-opacity");
            else
              el.style.setProperty("--wl-hotspot-opacity", String(opacityToFraction(next.hotspot)));
          }
        },
        goToScene: (sceneId) => {
          // Jumps straight to a node without traversing a link, which is what
          // the stop rail needs — a visitor picking scene 7 from a list has not
          // walked there. PSV still fires node-changed with `fromNode` set but
          // no traversed link, so the existing handler records this as
          // `scene_link_followed { via: "jump" }`, which is exactly what that
          // property already means.
          //
          // Guarded because the id comes from UI: setCurrentNode on an unknown
          // node throws inside PSV rather than returning false.
          if (!tour.scenes.some((scene) => scene.id === sceneId)) return;
          void viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin)?.setCurrentNode(sceneId);
        },
      };
    }

    // Visit-scoped analytics counters. Refs rather than state: these must not
    // re-render the viewer, and they are read once on unmount.
    const visitStartedAt = Date.now();
    // Scene counting lives in createTourVisit (pure, unit-tested) because the
    // two rules it enforces are the ones that were wrong: the opening scene
    // must count as seen even though PSV may never emit node-changed for it,
    // and completion must report exactly once however long the visitor keeps
    // walking. Both are covered in tour-visit.test.ts.
    const { visit, completeAtOpen } = createTourVisitAndCheckOpen(
      startScene.id,
      usableScenes.length,
    );
    const captureCompleted = () => {
      capture("tour_completed", {
        destination_slug: tour.slug,
        scenes_viewed: visit.scenesViewed(),
        scenes_total: usableScenes.length,
        duration_ms: Date.now() - visitStartedAt,
      });
    };
    // Tracked here rather than read back off the plugin: getCurrentNode is not on
    // PSV's exported plugin type, and node-changed already tells us.
    let currentSceneId = tour.startSceneId;
    // "embed" is inferred from the route rather than passed, so the caller does not
    // have to thread an analytics-only prop through three components.
    const entry: "direct" | "globe" | "embed" | "course" =
      typeof window === "undefined"
        ? "direct"
        : window.location.pathname.startsWith("/embed/")
          ? "embed"
          : window.location.search.includes("start=1")
            ? "globe"
            : window.location.pathname.includes("/learn/")
              ? "course"
              : "direct";
    capture("tour_opened", { destination_slug: tour.slug, entry });
    // A one-scene tour is already complete on open and will never emit another
    // node-changed, so the arrival path above would never catch it. Ordered
    // after tour_opened so the two never arrive out of sequence.
    if (completeAtOpen) captureCompleted();

    const virtualTour = viewer.getPlugin(VirtualTourPlugin);
    // Hand the plugin to the arrow buttons so keyboard activation can navigate.
    virtualTourPluginRef = virtualTour as VirtualTourPlugin | null;
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
      // Re-apply key visibility on arrival: a node's markers do not exist until that node loads, so
      // a hotspot hidden behind a key would otherwise appear the moment the visitor walked into the
      // scene, regardless of whether they hold the key.
      applyKeyMechanicsRef.current?.();
      const traversedLink = event.fromNode
        ? usableScenes
            .find((s) => s.id === event.fromNode!.id)
            ?.links?.find((l) => l.nodeId === event.node.id)
        : undefined;
      if (scene) {
        currentSceneId = scene.id;
        setAudioSceneId(scene.id);
        onSceneChange?.(scene.id);
        const completedNow = visit.markVisited(scene.id);
        capture("scene_viewed", {
          destination_slug: tour.slug,
          scene_id: scene.id,
          index: visit.scenesViewed(),
        });
        if (completedNow) captureCompleted();
      }
      if (scene) {
        // `traversedLink` is already resolved above for arrival headings, so a
        // rail jump or map-pin click (no link traversed) correctly falls back
        // to the tour's default rather than going silent.
        transitionAudioRef.current.play(
          resolveTransitionAudioUrl({
            link: traversedLink
              ? {
                  transitionAudioUrl: traversedLink.transitionAudioUrl ?? null,
                  transitionAudioSilent: traversedLink.transitionAudioSilent ?? false,
                }
              : null,
            tourDefaultUrl: tour.transitionAudioUrl ?? null,
            soundEnabled: transitionAudioRef.current.soundOn,
          }),
        );
      }

      if (event.fromNode && scene) {
        capture("scene_link_followed", {
          destination_slug: tour.slug,
          from_scene_id: event.fromNode.id,
          to_scene_id: scene.id,
          // Map-pin jumps also fire node-changed with fromNode set but no
          // traversed link — without this they would silently pollute the
          // link-arrow series.
          via: traversedLink ? "link" : "jump",
        });
      }

      // No repositioning here any more. transitionOptions already opened the
      // scene at its arrival heading, so animating now would re-introduce the
      // exact spin this change removes. This handler is analytics + key
      // mechanics only.
    };
    // Put the camera back after a rebuild, but ONLY on the same scene: applying
    // a remembered heading to a different panorama would silently override the
    // creator's start position with wherever they last happened to look.
    const remembered = lastPositionRef.current;
    if (remembered && remembered.sceneId === startSceneId) {
      viewer.addEventListener(
        "ready",
        () => {
          try {
            viewer.rotate({ yaw: remembered.yaw, pitch: remembered.pitch });
          } catch {
            // Not worth breaking the viewer over a heading.
          }
        },
        { once: true },
      );
    }

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
      grantsKey?: string;
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
      // Granting happens on open, before any navigation branch below, so a cross-tour hotspot that
      // also carries a key still hands it over.
      if (data.grantsKey) onKeyGrantedRef.current?.(data.grantsKey, markerId);
      capture("hotspot_opened", {
        destination_slug: tour.slug,
        scene_id: currentSceneId,
        hotspot_id: markerId,
        hotspot_type: data.crossTourTarget
          ? "cross_tour"
          : data.externalUrl
            ? "external"
            : "content",
      });
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
        const ce = new CustomEvent("wanderlust:cross-tour-link", {
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
        id: "wanderlust-panorama-error",
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

    // The caption item is what prints the scene name (and, for an auto-named
    // scene, its filename) across the panorama. Removing it from the navbar is
    // how it hides — PSV has no "caption: off" switch, and rebuilding the
    // viewer to change a label would reload the panorama.
    setNavbarCaptionRef.current = (show: boolean) => {
      const base = allVideo
        ? ["videoPlay", "videoVolume", "videoTime", "fullscreen"]
        : ["zoom", "move", "fullscreen"];
      const withCaption = allVideo
        ? ["videoPlay", "videoVolume", "videoTime", "caption", "fullscreen"]
        : ["zoom", "move", "caption", "fullscreen"];
      viewer.setOption("navbar", show ? withCaption : base);
    };
    setNavbarCaptionRef.current(labelsOnRef.current);

    const mapPlugin = tour.map ? viewer.getPlugin<MapPlugin>(MapPlugin) : null;
    // Rotating a phone crosses a breakpoint, and the viewer is not rebuilt for
    // that — without this the map keeps whatever size it was built with.
    // `size` is in UpdatableMapPluginConfig, checked against the installed
    // map-plugin 5.15.0 d.ts.
    const handleResize = () => {
      mapPlugin?.setOptions({ size: mapSizeForViewport(window.innerWidth) });
    };
    if (mapPlugin) window.addEventListener("resize", handleResize);

    return () => {
      if (onPositionClick) {
        viewer.removeEventListener("click", handleClick);
      }
      viewer.removeEventListener("panorama-error", handlePanoramaError);
      if (mapPlugin) window.removeEventListener("resize", handleResize);
      virtualTour?.removeEventListener("node-changed", handleNodeChanged);
      markersPlugin?.removeEventListener("select-marker", handleSelectMarker);
      capture("tour_exited", {
        destination_slug: tour.slug,
        scenes_viewed: visit.scenesViewed(),
        duration_ms: Date.now() - visitStartedAt,
      });
      // Remember where the camera was, so a rebuild (any `tour` identity change
      // — every save in the scene editor causes one) can put it back.
      try {
        const pos = viewer.getPosition();
        lastPositionRef.current = { sceneId: currentSceneId, yaw: pos.yaw, pitch: pos.pitch };
      } catch {
        // A viewer torn down mid-initialisation has no position to read. Losing
        // the heading is the pre-existing behaviour, so this is not worth
        // surfacing.
      }
      // Drop the handle before destroying: the toggle button holds no
      // knowledge of viewer lifetime, and calling setOption on a destroyed
      // viewer throws.
      setNavbarCaptionRef.current = null;
      viewer.destroy();
      viewerRef.current = null;
      if (apiRef) apiRef.current = null;
    };
    // `heldKeys` is deliberately NOT a dependency. Including it would destroy and rebuild the whole
    // viewer every time the visitor earned a key, reloading the panorama and losing their heading.
    // The initial key set is read through heldKeysRef, and subsequent changes are applied
    // incrementally by applyKeyMechanics via hideMarker/showMarker and updateNode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, onPositionClick, apiRef]);

  const tourHasAudio = tour.scenes.some((s) => s.ambientAudioUrl);
  // The current scene's sound, in words.
  //
  // Shown whether or not the visitor has turned sound ON, and that is the
  // point: someone who cannot hear it will never press the sound button, so
  // gating the text behind that button would hide it from exactly the person
  // it exists for. WCAG 1.2.1 wants a text alternative for prerecorded
  // audio-only content; a description is the useful form for atmosphere, which
  // has no words to transcribe.
  const audioDescription = tour.scenes.find((s) => s.id === audioSceneId)
    ?.ambientAudioDescription;

  return (
    <div className="relative" style={{ width: "100%", height }}>
      <div
        ref={containerRef}
        className={className}
        style={
          {
            width: "100%",
            height: "100%",
            // Resolved per CURRENT scene, so walking into a room with its own
            // setting changes the arrows without a rebuild. The CSS in
            // globals.css reads these; the creator's sliders overwrite them
            // directly via setIconOpacity for a live preview.
            "--wl-link-opacity": String(
              opacityToFraction(
                resolveOpacityPercent({
                  scene: tour.scenes.find((s) => s.id === audioSceneId)?.sceneLinkIconOpacity,
                  tour: tour.sceneLinkIconOpacity,
                }),
              ),
            ),
            "--wl-hotspot-opacity": String(
              opacityToFraction(
                resolveOpacityPercent({
                  scene: tour.scenes.find((s) => s.id === audioSceneId)?.hotspotIconOpacity,
                  tour: tour.hotspotIconOpacity,
                }),
              ),
            ),
          } as CSSProperties
        }
        role="application"
        aria-label={`Virtual tour of ${tour.title}`}
      />
      {/* Only offered when the tour actually has sound, so a silent tour does
          not grow a dead control. */}
      {audioDescription ? (
        <p
          // Not aria-hidden and not visually hidden: a hearing visitor with the
          // sound off benefits from knowing what they are missing, and a deaf
          // visitor needs it regardless. One affordance, both audiences.
          className="absolute bottom-3 left-3 z-10 max-w-[min(28rem,calc(100%-8rem))] rounded-md bg-black/70 px-3 py-2 text-xs text-white backdrop-blur"
        >
          <span className="sr-only">{soundDescriptionLabel}: </span>
          {audioDescription}
        </p>
      ) : null}

      {/*
        Visitor controls, bottom-right.

        One flex row rather than two absolutely-placed buttons: the sound button
        is conditional, so hard-coding a `right-40` offset for the labels button
        would leave a hole on silent tours and would break the moment either
        label translated longer than the offset guessed.

        `flex-wrap` + `max-w` so two long translations stack instead of running
        off the left edge on a 375px screen.
      */}
      <div className="absolute bottom-3 right-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-2">
        {/*
          Labels on/off. Offered always, not only when the creator defaulted
          them on: someone arriving with labels hidden may still want to know
          where they are, and a control that appears in only one direction is
          not a toggle.
        */}
        <button
          type="button"
          onClick={() => {
            const next = !labelsOn;
            setLabelsOn(next);
            // Straight to the live viewer — no rebuild, no panorama reload.
            setNavbarCaptionRef.current?.(next);
          }}
          aria-pressed={labelsOn}
          className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-black/70 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span aria-hidden="true">{labelsOn ? "\u{1F3F7}" : "\u{1F5C2}"}</span>
          {labelsOn ? labelsOnLabel : labelsOffLabel}
        </button>

        {tourHasAudio ? (
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-pressed={soundOn}
            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-black/70 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span aria-hidden="true">{soundOn ? "\u{1F50A}" : "\u{1F507}"}</span>
            {soundOn ? soundOnLabel : soundOffLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
