/**
 * Visit-scoped scene tracking for a single tour viewing.
 *
 * Extracted from the viewer so the two rules that are easy to get wrong are
 * testable without a browser, PSV, or a real panorama:
 *
 *   1. The opening scene counts as seen. PSV does not reliably emit
 *      node-changed for the node it opens on, so anything that waits for the
 *      event starts one short. That undercounts every visit and makes
 *      completion unreachable — a tour could never report all of its scenes
 *      seen, because the first one never registered. The stop rail hit the
 *      same trap and seeds its own set for the same reason.
 *
 *   2. Completion fires exactly once. Scene changes keep arriving after the
 *      last new scene is reached — walking back through a tour is normal — and
 *      an unguarded check would fire on every one of them.
 *
 * Pure and synchronous: no analytics import, no side effects. The caller
 * decides what to do when `markVisited` reports completion.
 */
export type TourVisit = {
  /**
   * Records a scene arrival. Returns true ONLY on the single arrival that
   * completes the tour, so the caller can emit its event inline without
   * tracking a flag of its own. Returns false on every later call.
   */
  markVisited: (sceneId: string) => boolean;
  /** How many distinct scenes this visit has reached, opening scene included. */
  scenesViewed: () => number;
};

export function createTourVisit(startSceneId: string, scenesTotal: number): TourVisit {
  const seen = new Set<string>([startSceneId]);
  let completedReported = false;

  const isComplete = () => seen.size >= scenesTotal;

  // A one-scene tour is already complete before any arrival happens, and will
  // never produce a node-changed to notice it on. Resolving it here means the
  // caller gets the same "report once" contract in both cases.
  const reportOnce = () => {
    if (completedReported) return false;
    if (!isComplete()) return false;
    completedReported = true;
    return true;
  };

  return {
    markVisited: (sceneId: string) => {
      seen.add(sceneId);
      return reportOnce();
    },
    scenesViewed: () => seen.size,
  };
}

/**
 * True when the tour was already complete at open — the single-scene case.
 *
 * Separate from `markVisited` because the caller has no arrival to hang it on:
 * it must be checked immediately after the visit is created.
 */
export function createTourVisitAndCheckOpen(
  startSceneId: string,
  scenesTotal: number,
): { visit: TourVisit; completeAtOpen: boolean } {
  const visit = createTourVisit(startSceneId, scenesTotal);
  // markVisited on the opening scene is a no-op for the set (already seeded)
  // and returns true only if that alone completes the tour.
  const completeAtOpen = visit.markVisited(startSceneId);
  return { visit, completeAtOpen };
}
