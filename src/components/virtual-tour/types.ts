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
   * viewer dispatches a `wanderlearn:cross-tour-link` DOM event with
   * this payload; a wrapping React component picks up the event and
   * renders the preview card.
   */
  crossTourTarget?: CrossTourTarget;
}

export interface SceneLink {
  nodeId: string;
  name?: string;
  position?: ScenePosition;
}

export interface TourScene {
  id: string;
  name: string;
  caption?: string;
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
}
