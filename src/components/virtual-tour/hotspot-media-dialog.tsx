"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { YouTubePlayer } from "@/components/blocks/youtube-player";
import type { HotspotMedia } from "./types";

export type HotspotMediaLabels = {
  close: string;
  transcript: string;
  opensInNewTab: string;
  /** Shown under an image edited with generative AI (content policy condition 3). */
  aiEdited: string;
};

export type OpenHotspotMedia = { title: string; media: HotspotMedia };

/**
 * The dialog a media hotspot opens (plan 16 Part B). Radix Dialog: focus is
 * trapped, Escape closes, and the content unmounts on close so a video stops.
 * `container` is the element PSV sends fullscreen, so it works there too.
 */
export function HotspotMediaDialog({
  open,
  onClose,
  container,
  labels,
}: {
  open: OpenHotspotMedia | null;
  onClose: () => void;
  container: HTMLElement | null;
  labels: HotspotMediaLabels;
}) {
  const media = open?.media;
  return (
    <Dialog.Root open={Boolean(open)} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[101] flex max-h-[92dvh] w-[min(56rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-auto rounded-lg bg-background p-4 text-foreground shadow-2xl focus:outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold">{open?.title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={labels.close}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line-strong text-xl hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                <span aria-hidden="true">×</span>
              </button>
            </Dialog.Close>
          </div>
          {media?.kind === "image" && media.url ? (
            <figure className="flex flex-col gap-2">
              {/* A plain img: Cloudinary already sizes and formats it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.url} alt={media.alt ?? ""} className="mx-auto max-h-[70dvh] w-auto max-w-full object-contain" />
              {media.aiEdited ? <figcaption className="text-xs font-semibold">{labels.aiEdited}</figcaption> : null}
            </figure>
          ) : null}
          {media?.kind === "video" && media.url ? (
            <div className="flex flex-col gap-2">
              <video controls playsInline preload="metadata" poster={media.posterUrl} className="max-h-[70dvh] w-full rounded-md bg-black">
                <source src={media.url} />
                {media.captionsUrl ? <track kind="captions" src={media.captionsUrl} srcLang="en" label="Captions" default /> : null}
              </video>
              {media.transcriptUrl ? (
                <a
                  href={media.transcriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {labels.transcript}
                  <span className="sr-only"> ({labels.opensInNewTab})</span>
                </a>
              ) : null}
            </div>
          ) : null}
          {media?.kind === "youtube" && media.youtubeId ? (
            <YouTubePlayer videoId={media.youtubeId} title={open?.title ?? ""} />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
