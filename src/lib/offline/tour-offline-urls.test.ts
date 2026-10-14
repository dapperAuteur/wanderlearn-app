import { describe, expect, it } from "vitest";
import type { VirtualTour } from "@/components/virtual-tour/types";
import { tourOfflineUrls } from "./tour-offline-urls";

const tour: VirtualTour = {
  slug: "t",
  title: "T",
  startSceneId: "a",
  transitionAudioUrl: "https://c/step.mp3",
  map: { imageUrl: "https://c/map.png", width: 10, height: 10 },
  arrowImageUrl: "https://c/arrow.png",
  scenes: [
    {
      id: "a",
      name: "A",
      panorama: "https://c/a.jpg",
      thumbnail: "https://c/a-thumb.jpg",
      ambientAudioUrl: "https://c/room.mp3",
      links: [{ nodeId: "b", transitionAudioUrl: "https://c/door.mp3" }],
      hotspots: [
        { id: "h", position: { yaw: 0, pitch: 0 }, title: "H", audioUrl: "https://c/h.mp3" },
        { id: "v", position: { yaw: 1, pitch: 0 }, title: "V", media: { kind: "video", url: "https://c/v.mp4", posterUrl: "https://c/v.jpg", transcriptUrl: "https://c/v.vtt" } },
        { id: "y", position: { yaw: 2, pitch: 0 }, title: "Y", media: { kind: "youtube", youtubeId: "dQw4w9WgXcQ" } },
      ],
      moments: [{ momentId: "m", panorama: "https://c/a-1998.jpg", headingOffsetDeg: 0 }],
    },
    // Shares the arrow and the room sound: each URL is listed once.
    { id: "b", name: "B", panorama: "https://c/b.jpg", ambientAudioUrl: "https://c/room.mp3" },
  ],
};

describe("tourOfflineUrls", () => {
  it("lists every file the tour loads, once each, without moments by default", () => {
    expect(tourOfflineUrls(tour, { includeMoments: false }).sort()).toEqual(
      [
        "https://c/step.mp3",
        "https://c/map.png",
        "https://c/arrow.png",
        "https://c/a.jpg",
        "https://c/a-thumb.jpg",
        "https://c/room.mp3",
        "https://c/door.mp3",
        "https://c/h.mp3",
        "https://c/v.mp4",
        "https://c/v.jpg",
        "https://c/v.vtt",
        "https://c/b.jpg",
      ].sort(),
    );
  });

  it("adds moment photos when the tour opts in", () => {
    expect(tourOfflineUrls(tour, { includeMoments: true })).toContain("https://c/a-1998.jpg");
    expect(tourOfflineUrls(tour, { includeMoments: false })).not.toContain("https://c/a-1998.jpg");
  });
});
