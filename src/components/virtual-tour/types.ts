export interface ScenePosition {
  yaw: number;
  pitch: number;
}

export interface CrossTourTarget {
  destinationId: string;
  slug: string;
  name: string;
  description?: string;
  posterUrl?: string;
}

export interface SceneHotspot {
  id: string;
  position: ScenePosition;
  title: string;
  content?: string;
  audioUrl?: string;
  externalUrl?: string;
  /**
   * When set, this hotspot navigates to another destination. The
   * viewer dispatches a `wanderlust:cross-tour-link` DOM event with
   * this payload; a wrapping React component picks up the event and
   * renders the preview card.
   */
  crossTourTarget?: CrossTourTarget;
  /**
   * Game mechanics (see src/db/schema/scenes.ts). `requiresKeys` hides the hotspot until the visitor
   * holds every listed key; `grantsKey` is handed out when they open it. Both undefined on an
   * ordinary hotspot, which is every hotspot that predates the hunts feature.
   */
  requiresKeys?: string[];
  grantsKey?: string;
}

export interface SceneLink {
  nodeId: string;
  name?: string;
  /** Where the link marker sits in the scene that owns this link. */
  position?: ScenePosition;
  /**
   * Where the camera should point on arrival at `nodeId`, for a visitor who
   * travelled along this link. Falls back to the target scene's `startPosition`
   * when unset, which is the pre-2026-07-28 behaviour.
   *
   * Arrival heading belongs to the edge rather than the node: the same room
   * entered from two different doors should leave you facing two different ways.
   */
  arrivalPosition?: ScenePosition;
  /**
   * The maze door. While the visitor lacks any of these keys the arrow is not rendered and the edge
   * cannot be traversed. Undefined on an ordinary link.
   *
   * NOT access control, deliberately: the payload still reaches the client, so someone reading the
   * page source can reach a locked scene. That is acceptable for a game and unacceptable for
   * privacy, which is why anything genuinely private uses the destination's own controls instead.
   */
  requiresKeys?: string[];
  /**
   * A one-shot sound for walking THIS link, overriding the tour's default.
   * Undefined means inherit; see `transitionAudioSilent` for the third state.
   */
  transitionAudioUrl?: string;
  /**
   * The creator deliberately silenced this link. Distinct from "inherit" —
   * a nullable url can only express one of the two, and both are real.
   */
  transitionAudioSilent?: boolean;
}

export interface TourScene {
  id: string;
  name: string;
  caption?: string;
  /**
   * Looping ambient bed for this scene: room tone, birdsong, the sound of the
   * place. Swapped and crossfaded as the visitor walks.
   *
   * Distinct from SceneHotspot.audioUrl, which is a clip the visitor
   * deliberately triggers by clicking a marker. This one they never ask for,
   * which is exactly why it starts muted -- see the viewer.
   */
  ambientAudioUrl?: string;
  /**
   * Whether the ambient bed loops. Defaults to true when absent, matching the
   * behaviour every scene had before the column existed.
   */
  ambientAudioLoop?: boolean;
  /**
   * What the ambient sound conveys, for anyone who cannot hear it. A
   * description rather than a transcript — see scenes.audioDescription.
   */
  ambientAudioDescription?: string;
  /** Per-scene override for link-arrow opacity (0-100). Undefined inherits the tour's. */
  sceneLinkIconOpacity?: number;
  /** Per-scene override for hotspot-pin opacity (0-100). */
  hotspotIconOpacity?: number;
  panorama: string;
  type?: "photo" | "video";
  thumbnail?: string;
  startPosition?: ScenePosition;
  links?: SceneLink[];
  hotspots?: SceneHotspot[];
  /**
   * Degrees of clockwise sphere-correction roll to apply when this
   * scene mounts. Compensates for tripod tilt at capture time. The
   * viewer hands this to PSV as `sphereCorrection.roll` per-node.
   */
  rollOffsetDeg?: number;
  /**
   * Position on the tour-map image, normalized 0..1. Undefined = not placed —
   * the scene is hidden from the visitor mini-map (node.map = false), which is
   * also the future maze/games hook.
   */
  mapPosition?: { x: number; y: number };
}

export interface VirtualTour {
  slug: string;
  title: string;
  description?: string;
  startSceneId: string;
  scenes: TourScene[];
  /**
   * Optional creator-controlled accent colors. Hex strings (e.g. "#10b981")
   * sourced from the destination row. Undefined = render with the
   * platform defaults baked into VirtualTourViewer.
   */
  arrowColor?: string;
  pinColor?: string;
  /**
   * Optional creator-uploaded image URL used as the hotspot pin marker
   * for every scene in this tour. Undefined = use the inline drop-pin
   * SVG tinted by `pinColor`. The URL should point to a Cloudinary
   * `image` asset (PNG/WebP recommended) at ~96 px square.
   */
  pinIconUrl?: string;
  /**
   * Default one-shot sound played when a visitor walks any link in this tour.
   * A link may override it, or silence itself. Resolution lives in
   * src/lib/transition-audio.ts.
   */
  transitionAudioUrl?: string;
  /**
   * Tour-wide opacity for link arrows and hotspot pins (0-100). Undefined is
   * fully opaque; a scene may override either.
   */
  sceneLinkIconOpacity?: number;
  hotspotIconOpacity?: number;
  /**
   * Optional creator-uploaded image URL used as the scene-to-scene
   * navigation arrow for every link in this tour. Undefined = use
   * PSV's default chevron tinted by `arrowColor`. When defined, the
   * color tint is ignored (PSV's `arrowStyle.image` path doesn't
   * flow through currentColor). The URL should point to a Cloudinary
   * `image` asset (transparent PNG or SVG recommended).
   */
  arrowImageUrl?: string;
  /**
   * Optional destination-level "next tour" CTA. When set, the tour
   * page (and embed) render a "Continue to {name}" card under the
   * viewer pointing at this destination. Resolved by assembleTour
   * from `destinations.next_destination_id` — null if the target was
   * deleted, made un-linkable, or never set.
   */
  nextDestination?: CrossTourTarget;
  /**
   * Floor-plan (or built-in template) backing the visitor mini-map. width and
   * height are the image's intrinsic pixels — the one conversion point from
   * normalized scene positions to the pixel coordinates PSV's MapPlugin wants.
   */
  map?: { imageUrl: string; width: number; height: number };
  /** Per-destination icon sizes in CSS pixels; undefined = built-in defaults. */
  sceneLinkIconSize?: number;
  hotspotIconSize?: number;
}
