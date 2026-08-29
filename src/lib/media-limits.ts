/**
 * Upload size limits, in one place.
 *
 * These must never exceed what the storage account actually accepts. They used to:
 * the table said 50 MB for images and 5 GB for 360° video while the account caps are
 * 10 MB and 100 MB. Anything in that gap passed our own check, uploaded in full from
 * the creator's browser, and was then rejected by the provider — so a partner on hotel
 * wifi waited out a 300 MB transfer to receive an opaque failure.
 *
 * Current account limits (confirmed by BAM 2026-07-28, tier upgrade explicitly
 * deferred — revisit `plans/bugs/20` if that changes):
 *
 *   10 MB   image          100 MB  image transformation
 *   100 MB  video          40 MB   video transformation
 *   10 MB   raw            25 MP   per image
 *                          50 MP   across all frames
 *
 * `raw` covers transcripts.
 *
 * AUDIO: measured, not guessed. This sat at 10 MB — the raw cap — because nobody had
 * checked which cap Cloudinary applies to audio, and under-guessing was the safe
 * default. BAM tested it against the live account on 2026-08-27: audio goes through
 * the video pipeline and takes the **video** cap, so the real ceiling is 100 MB. The
 * old value was ten times too strict and was rejecting files that upload fine.
 */
export const MAX_BYTES_BY_KIND = {
  image: 10 * 1024 * 1024,
  // A 360° still is an image as far as the account is concerned, not a special case.
  photo_360: 10 * 1024 * 1024,
  standard_video: 100 * 1024 * 1024,
  video_360: 100 * 1024 * 1024,
  drone_video: 100 * 1024 * 1024,
  // Video cap, not raw — confirmed against the live account 2026-08-27.
  audio: 100 * 1024 * 1024,
  transcript: 10 * 1024 * 1024,
  screenshot: 10 * 1024 * 1024,
  screen_recording: 100 * 1024 * 1024,
} as const;

export type LimitedKind = keyof typeof MAX_BYTES_BY_KIND;

/**
 * Megapixel ceiling for still images. NOT enforced in code yet — measuring it means
 * decoding the file, and the size cap already rejects most offenders.
 *
 * It matters because the 360° guidance and this number disagree: a 2:1 equirectangular
 * at 8K is 8192 × 4096 = 33.5 MP and will be rejected even if it somehow fits 10 MB.
 * 6K (6144 × 3072) is 18.9 MP and safe. The docs now say 6K rather than "4K or better",
 * which read as an invitation to exceed this.
 */
export const MAX_IMAGE_MEGAPIXELS = 25;

export function maxBytesForKind(kind: string): number | null {
  return kind in MAX_BYTES_BY_KIND
    ? MAX_BYTES_BY_KIND[kind as LimitedKind]
    : null;
}

/** "10 MB" / "1.5 GB" — for limit copy, not for reporting an actual file size. */
export function formatLimit(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}
