import { youtubeEmbedUrl } from "@/lib/youtube";

/**
 * Lazy, privacy-friendly YouTube embed (youtube-nocookie, native
 * loading="lazy"). 16:9. Used by the lesson `youtube` block and the
 * destination "video tour" page. Offline: the iframe simply won't load —
 * the surrounding page (lesson text, tour details) still renders.
 */
export function YouTubePlayer({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        className="absolute inset-0 h-full w-full"
        src={youtubeEmbedUrl(videoId)}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
