import "server-only";
import { getDestinationById } from "@/db/queries/destinations";
import type { VirtualTourBlockData } from "@/lib/actions/content-blocks";
import { assembleTour } from "@/lib/assemble-tour";

/**
 * The tour a lesson's virtual_tour block shows. Shared by the lesson page and
 * the offline manifest, so "Save for offline" caches exactly the URLs the
 * lesson will request; a URL built any other way is a cache miss offline.
 */
export async function assembleLessonTour(data: VirtualTourBlockData, courseCreatorId: string) {
  const destination = await getDestinationById(data.destinationId);
  const assembled = await assembleTour({
    destinationId: data.destinationId,
    creatorId: courseCreatorId,
    startSceneId: data.startSceneId ?? null,
    title: data.caption ?? "",
    arrowColor: destination?.tourArrowColor,
    pinColor: destination?.tourPinColor,
    pinIconMediaId: destination?.pinIconMediaId,
    tourArrowMediaId: destination?.tourArrowMediaId,
    nextDestinationId: destination?.nextDestinationId,
    mapMediaId: destination?.mapMediaId,
    mapTemplate: destination?.mapTemplate,
    sceneLinkIconSize: destination?.sceneLinkIconSize,
    hotspotIconSize: destination?.hotspotIconSize,
    tourLinks: destination?.tourLinks,
  });
  return { destination, assembled };
}
