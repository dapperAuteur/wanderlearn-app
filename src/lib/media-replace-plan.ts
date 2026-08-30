/**
 * Which of a file's uses a replacement is allowed to touch.
 *
 * BAM's decision, and a better one than either option on the table: rather
 * than "this slot only" or "everywhere", show the creator every place the file
 * appears and let them pick — all, none, or a selection.
 *
 * That matters because slots are not interchangeable. Each one accepts a
 * different set of media kinds: a panorama must be a 360 photo or video, a pin
 * icon must be a flat image, a scene's audio must be audio. So a replacement
 * that is legal for three of a file's five uses can be illegal for the other
 * two — and the honest answer is to say which, not to fail the whole operation
 * or, worse, half-apply it.
 *
 * Pure: no database, no Next. The action supplies the uses and the candidate's
 * kind; this decides what is allowed and what to say about the rest.
 */

import type { MediaUse, SlotKind } from "@/db/queries/media-uses";

/** Media kinds each slot will accept. Mirrors the checks in the actions. */
const SLOT_ACCEPTS: Record<SlotKind, readonly string[]> = {
  "scene.panorama": ["photo_360", "video_360"],
  "scene.poster": ["image", "photo_360", "screenshot"],
  "scene.audio": ["audio"],
  "hotspot.audio": ["audio"],
  "link.transitionAudio": ["audio"],
  "destination.hero": ["image", "photo_360"],
  "destination.profile": ["image", "photo_360"],
  "destination.pinIcon": ["image"],
  "destination.tourArrow": ["image"],
  "destination.map": ["image"],
  "destination.transitionAudio": ["audio"],
  "course.cover": ["image", "photo_360"],
  "course.profile": ["image", "photo_360"],
  "media.transcript": ["transcript"],
};

export type PlannedUse = MediaUse & {
  /** Whether the replacement's kind is valid for this slot. */
  eligible: boolean;
  /** Populated when not eligible, so the UI can say why rather than just grey it out. */
  reason?: string;
};

export type ReplacePlan = {
  planned: PlannedUse[];
  eligibleCount: number;
  ineligibleCount: number;
};

export function planReplacement(input: {
  uses: readonly MediaUse[];
  /** The kind of the file being swapped IN. */
  replacementKind: string;
}): ReplacePlan {
  const planned = input.uses.map((use): PlannedUse => {
    const accepts = SLOT_ACCEPTS[use.slot];
    const eligible = accepts.includes(input.replacementKind);
    return eligible
      ? { ...use, eligible }
      : {
          ...use,
          eligible,
          // Names both sides. "Not allowed here" tells a creator nothing they
          // can act on; "this slot takes a 360 photo, that file is audio"
          // tells them what to go and find.
          reason: `This slot takes ${accepts.join(" or ")}; the new file is ${input.replacementKind}.`,
        };
  });
  return {
    planned,
    eligibleCount: planned.filter((p) => p.eligible).length,
    ineligibleCount: planned.filter((p) => !p.eligible).length,
  };
}

/**
 * Narrow a chosen set down to what is actually allowed.
 *
 * The UI should not offer ineligible slots, but the selection arrives from the
 * client and a crafted request must not slip one through — the per-slot kind
 * checks are the only thing standing between a swap and a scene whose panorama
 * is an MP3.
 */
export function selectableSlots(
  plan: ReplacePlan,
  chosen: readonly { slot: SlotKind; rowId: string }[],
): { slot: SlotKind; rowId: string }[] {
  const allowed = new Set(
    plan.planned.filter((p) => p.eligible).map((p) => `${p.slot}::${p.rowId}`),
  );
  return chosen.filter((c) => allowed.has(`${c.slot}::${c.rowId}`));
}
