import { eq, or } from "drizzle-orm";
import { db, schema } from "@/db/client";

/**
 * Every place a media file is used.
 *
 * WHY THIS EXISTS SEPARATELY FROM `findReferences`. That helper answers a
 * narrower question — "is anything blocking a delete?" — and checks 4 of the
 * 14 columns that point at a media asset. Ten were unchecked, and five of
 * those columns have no foreign key at all, so a hard delete could leave a
 * dangling uuid rather than a null.
 *
 * This enumerates ALL of them, because "replace this file" needs to show the
 * creator every place it appears and let them choose. Checked against
 * production: 80 files currently occupy more than one KIND of slot — the same
 * image serving as a scene's panorama, that scene's poster, and a
 * destination's hero all at once. A blanket swap would change things the
 * creator was not looking at, which is exactly why BAM asked for a chooser.
 *
 * A "slot" is one column on one row. It is addressable — table, column, row id
 * — so the replace action can be told precisely which ones to change.
 */

/** Every column in the schema that points at `media_assets.id`. */
export type SlotKind =
  | "scene.panorama"
  | "scene.poster"
  | "scene.audio"
  | "hotspot.audio"
  | "link.transitionAudio"
  | "destination.hero"
  | "destination.profile"
  | "destination.pinIcon"
  | "destination.tourArrow"
  | "destination.map"
  | "destination.transitionAudio"
  | "course.cover"
  | "course.profile"
  | "media.transcript";

export type MediaUse = {
  slot: SlotKind;
  /** The row that holds the reference. */
  rowId: string;
  /** Human label for that row — a scene name, a tour name, a course title. */
  label: string;
  /** Where to send the creator to see it, when there is somewhere sensible. */
  destinationId?: string;
};

/**
 * Find every use of one media asset.
 *
 * Deliberately one query per slot kind rather than a union: the tables have
 * different shapes and different label columns, and a union would need casting
 * every one of them to a common row type before we had anything useful. The
 * queries are small and indexed on the foreign key.
 */
export async function findMediaUses(mediaId: string): Promise<MediaUse[]> {
  const [
    scenes,
    hotspots,
    links,
    destinations,
    courses,
    transcriptOf,
  ] = await Promise.all([
    db
      .select({
        id: schema.scenes.id,
        name: schema.scenes.name,
        destinationId: schema.scenes.destinationId,
        panoramaMediaId: schema.scenes.panoramaMediaId,
        posterMediaId: schema.scenes.posterMediaId,
        audioMediaId: schema.scenes.audioMediaId,
      })
      .from(schema.scenes)
      .where(
        or(
          eq(schema.scenes.panoramaMediaId, mediaId),
          eq(schema.scenes.posterMediaId, mediaId),
          eq(schema.scenes.audioMediaId, mediaId),
        ),
      ),
    db
      .select({ id: schema.sceneHotspots.id, title: schema.sceneHotspots.title })
      .from(schema.sceneHotspots)
      .where(eq(schema.sceneHotspots.audioMediaId, mediaId)),
    db
      .select({ id: schema.sceneLinks.id, name: schema.sceneLinks.name })
      .from(schema.sceneLinks)
      .where(eq(schema.sceneLinks.transitionAudioMediaId, mediaId)),
    db
      .select({
        id: schema.destinations.id,
        name: schema.destinations.name,
        heroMediaId: schema.destinations.heroMediaId,
        profileMediaId: schema.destinations.profileMediaId,
        pinIconMediaId: schema.destinations.pinIconMediaId,
        tourArrowMediaId: schema.destinations.tourArrowMediaId,
        mapMediaId: schema.destinations.mapMediaId,
        transitionAudioMediaId: schema.destinations.transitionAudioMediaId,
      })
      .from(schema.destinations)
      .where(
        or(
          eq(schema.destinations.heroMediaId, mediaId),
          eq(schema.destinations.profileMediaId, mediaId),
          eq(schema.destinations.pinIconMediaId, mediaId),
          eq(schema.destinations.tourArrowMediaId, mediaId),
          eq(schema.destinations.mapMediaId, mediaId),
          eq(schema.destinations.transitionAudioMediaId, mediaId),
        ),
      ),
    db
      .select({
        id: schema.courses.id,
        title: schema.courses.title,
        coverMediaId: schema.courses.coverMediaId,
        profileMediaId: schema.courses.profileMediaId,
      })
      .from(schema.courses)
      .where(
        or(
          eq(schema.courses.coverMediaId, mediaId),
          eq(schema.courses.profileMediaId, mediaId),
        ),
      ),
    // A transcript attached to some OTHER asset. Easy to forget: the reference
    // lives on media_assets pointing at media_assets.
    db
      .select({ id: schema.mediaAssets.id, displayName: schema.mediaAssets.displayName })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.transcriptMediaId, mediaId)),
  ]);

  const uses: MediaUse[] = [];

  for (const s of scenes) {
    // destinationId is nullable on scenes; undefined means "nowhere to link to".
    const base = { rowId: s.id, label: s.name, destinationId: s.destinationId ?? undefined };
    // One scene can hold the same file in several slots at once — a 360 photo
    // is routinely both the panorama and its own poster — so these are checked
    // independently rather than with else-if.
    if (s.panoramaMediaId === mediaId) uses.push({ ...base, slot: "scene.panorama" });
    if (s.posterMediaId === mediaId) uses.push({ ...base, slot: "scene.poster" });
    if (s.audioMediaId === mediaId) uses.push({ ...base, slot: "scene.audio" });
  }
  for (const h of hotspots) {
    uses.push({ slot: "hotspot.audio", rowId: h.id, label: h.title });
  }
  for (const l of links) {
    uses.push({ slot: "link.transitionAudio", rowId: l.id, label: l.name ?? "Scene link" });
  }
  for (const d of destinations) {
    const base = { rowId: d.id, label: d.name, destinationId: d.id };
    if (d.heroMediaId === mediaId) uses.push({ ...base, slot: "destination.hero" });
    if (d.profileMediaId === mediaId) uses.push({ ...base, slot: "destination.profile" });
    if (d.pinIconMediaId === mediaId) uses.push({ ...base, slot: "destination.pinIcon" });
    if (d.tourArrowMediaId === mediaId) uses.push({ ...base, slot: "destination.tourArrow" });
    if (d.mapMediaId === mediaId) uses.push({ ...base, slot: "destination.map" });
    if (d.transitionAudioMediaId === mediaId)
      uses.push({ ...base, slot: "destination.transitionAudio" });
  }
  for (const c of courses) {
    const base = { rowId: c.id, label: c.title };
    if (c.coverMediaId === mediaId) uses.push({ ...base, slot: "course.cover" });
    if (c.profileMediaId === mediaId) uses.push({ ...base, slot: "course.profile" });
  }
  for (const m of transcriptOf) {
    uses.push({
      slot: "media.transcript",
      rowId: m.id,
      label: m.displayName ?? "Untitled media",
    });
  }

  return uses;
}
