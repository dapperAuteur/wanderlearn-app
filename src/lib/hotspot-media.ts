/**
 * Plan 16 Part B: what a hotspot may open, and what each kind needs before it
 * can be saved. Pure, so the rules are testable and shared by the action, the
 * editor and assembleTour.
 */

/** Library kinds a hotspot can show. 360 media belongs in scenes, not pop-ups. */
export const HOTSPOT_MEDIA_KINDS = ["image", "standard_video", "drone_video"] as const;
export type HotspotMediaKind = (typeof HOTSPOT_MEDIA_KINDS)[number];

export function isHotspotMediaKind(kind: string): kind is HotspotMediaKind {
  return (HOTSPOT_MEDIA_KINDS as readonly string[]).includes(kind);
}

export function isHotspotVideoKind(kind: string): boolean {
  return kind === "standard_video" || kind === "drone_video";
}

export type HotspotMediaProblem =
  | "media_kind"
  | "media_not_ready"
  | "alt_required"
  | "transcript_required";

/**
 * Why this media can't be attached yet, or null when it can. Images need a
 * text alternative; videos need a transcript, the same rule lesson videos meet
 * before a course can be published (WCAG 1.1.1 and 1.2.x).
 */
export function hotspotMediaProblem(media: {
  kind: string;
  status: string;
  alt: string | null | undefined;
  hasTranscript: boolean;
}): HotspotMediaProblem | null {
  if (!isHotspotMediaKind(media.kind)) return "media_kind";
  if (media.status !== "ready") return "media_not_ready";
  if (media.kind === "image" && !media.alt?.trim()) return "alt_required";
  if (isHotspotVideoKind(media.kind) && !media.hasTranscript) return "transcript_required";
  return null;
}

/** True when a transcript file can double as a captions track. */
export function isVttUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".vtt");
  } catch {
    return false;
  }
}
