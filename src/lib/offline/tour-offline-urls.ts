import type { VirtualTour } from "@/components/virtual-tour/types";

/**
 * Every file a tour loads while someone walks it: panoramas, card thumbnails,
 * ambient and transition sounds, hotspot sounds, the map and the custom
 * pin and arrow icons. Moment photos only when the tour opts in
 * (`destinations.offline_include_moments`), since each is another full 360
 * photo on the learner's device.
 *
 * Pure, so the offline manifest's choice of files is testable on its own.
 */
export function tourOfflineUrls(tour: VirtualTour, { includeMoments }: { includeMoments: boolean }): string[] {
  const urls = new Set<string>();
  const add = (url: string | undefined | null) => {
    if (url) urls.add(url);
  };
  add(tour.transitionAudioUrl);
  add(tour.map?.imageUrl);
  add(tour.pinIconUrl);
  add(tour.arrowImageUrl);
  for (const scene of tour.scenes) {
    add(scene.panorama);
    add(scene.thumbnail);
    add(scene.ambientAudioUrl);
    for (const link of scene.links ?? []) add(link.transitionAudioUrl);
    for (const hotspot of scene.hotspots ?? []) add(hotspot.audioUrl);
    if (includeMoments) {
      for (const photo of scene.moments ?? []) add(photo.panorama);
    }
  }
  return Array.from(urls);
}
