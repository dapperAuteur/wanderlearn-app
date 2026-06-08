/**
 * YouTube URL helpers. Shared by the lesson `youtube` content block and the
 * destination "video tour" field so both validate + render identically.
 * We store the original URL and derive the id at render time.
 */

/**
 * Extract an 11-char video id from the common YouTube URL shapes:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/shorts/ID
 *   - https://www.youtube-nocookie.com/embed/ID
 * Returns null if the input isn't a recognizable YouTube URL.
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const isYouTubeHost =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be";
  if (!isYouTubeHost) return null;

  const idPattern = /^[A-Za-z0-9_-]{11}$/;

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return idPattern.test(id) ? id : null;
  }

  // watch?v=<id>
  const v = url.searchParams.get("v");
  if (v && idPattern.test(v)) return v;

  // /embed/<id> or /shorts/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  if (
    segments.length >= 2 &&
    (segments[0] === "embed" || segments[0] === "shorts") &&
    idPattern.test(segments[1])
  ) {
    return segments[1];
  }

  return null;
}

export function isYouTubeUrl(input: string | null | undefined): boolean {
  return parseYouTubeId(input) !== null;
}

/** Privacy-friendly embed URL for an id. */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
