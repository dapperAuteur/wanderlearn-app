export interface ScenePosition {
  yaw: number;
  pitch: number;
}

export interface SceneHotspot {
  id: string;
  position: ScenePosition;
  title: string;
  content?: string;
  audioUrl?: string;
  externalUrl?: string;
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
}
