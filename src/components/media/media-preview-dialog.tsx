"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { imageUrl, type UploadKind } from "@/lib/cloudinary-urls";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";

export type PreviewableMedia = {
  id: string;
  kind: UploadKind;
  status: "uploading" | "processing" | "ready" | "failed" | "deleted";
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  displayName: string | null;
};

export type MediaPreviewDialogDict = {
  openCta: string;
  closeCta: string;
  unavailableTitle: string;
  unavailableBody: string;
  transcriptPreviewHint: string;
};

function pano360Tour(
  media: PreviewableMedia,
  type: "photo" | "video",
  url: string,
): VirtualTourType {
  return {
    slug: media.id,
    title: media.displayName ?? "",
    startSceneId: media.id,
    scenes: [
      {
        id: media.id,
        name: media.displayName ?? "",
        panorama: url,
        type,
        hotspots: [],
        links: [],
      },
    ],
  };
}

function PreviewBody({ media }: { media: PreviewableMedia }) {
  if (media.status !== "ready") return null;

  // 360° photo — show as full PSV panorama so the creator can spin around
  // and confirm the source is truly equirectangular.
  if (media.kind === "photo_360" && media.cloudinaryPublicId) {
    const url = imageUrl(media.cloudinaryPublicId, {
      format: "auto",
      quality: "auto",
    });
    return (
      <div className="overflow-hidden rounded-md">
        <VirtualTour tour={pano360Tour(media, "photo", url)} height="70vh" />
      </div>
    );
  }

  // 360° video — same path the runtime tour uses (secureUrl directly, no
  // Cloudinary transform, since edited MP4s 400 on f_mp4,vc_h264,q_auto).
  if (media.kind === "video_360") {
    const url = media.cloudinarySecureUrl;
    if (!url) return null;
    return (
      <div className="overflow-hidden rounded-md">
        <VirtualTour tour={pano360Tour(media, "video", url)} height="70vh" />
      </div>
    );
  }

  // Flat images.
  if (
    (media.kind === "image" || media.kind === "screenshot") &&
    media.cloudinaryPublicId
  ) {
    const url = imageUrl(media.cloudinaryPublicId, {
      format: "auto",
      quality: "auto",
      width: 1600,
    });
    return (
      // Cloudinary delivers its own optimization; using <img> avoids
      // next/image fighting the dialog's dynamic sizing.
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={media.displayName ?? ""}
        className="h-auto max-h-[70vh] w-full rounded-md object-contain"
      />
    );
  }

  // Standard / drone / screen-recording video.
  if (
    media.kind === "standard_video" ||
    media.kind === "drone_video" ||
    media.kind === "screen_recording"
  ) {
    const url = media.cloudinarySecureUrl;
    if (!url) return null;
    return (
      <video
        controls
        src={url}
        className="max-h-[70vh] w-full rounded-md bg-black"
      />
    );
  }

  // Audio.
  if (media.kind === "audio") {
    const url = media.cloudinarySecureUrl;
    if (!url) return null;
    return <audio controls src={url} className="w-full" />;
  }

  // Transcript — link out rather than trying to render subtitle markup
  // inline; the Cloudinary raw resource URL downloads the file.
  if (media.kind === "transcript" && media.cloudinarySecureUrl) {
    return (
      <a
        href={media.cloudinarySecureUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-4 text-sm font-semibold underline hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
      >
        {media.displayName ?? media.cloudinarySecureUrl}
      </a>
    );
  }

  return null;
}

export function MediaPreviewDialog({
  media,
  triggerClassName,
  dict,
}: {
  media: PreviewableMedia;
  triggerClassName?: string;
  dict: MediaPreviewDialogDict;
}) {
  const [open, setOpen] = useState(false);
  const disabled = media.status !== "ready";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={
            triggerClassName ??
            "inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
          }
        >
          {dict.openCta}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(90vw,72rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-auto rounded-lg bg-background p-4 shadow-2xl focus:outline-none sm:p-6"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold sm:text-lg">
              {media.displayName ?? ""}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={dict.closeCta}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-black/15 text-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
              >
                ×
              </button>
            </Dialog.Close>
          </div>
          {media.status !== "ready" ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-semibold">{dict.unavailableTitle}</p>
              <p className="mt-1">{dict.unavailableBody}</p>
            </div>
          ) : (
            <PreviewBody media={media} />
          )}
          {media.kind === "transcript" ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {dict.transcriptPreviewHint}
            </p>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
