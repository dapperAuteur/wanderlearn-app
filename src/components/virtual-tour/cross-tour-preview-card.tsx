"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import type { CrossTourTarget } from "./types";

export type CrossTourPreviewCardDict = {
  title: string;
  enterCta: string;
  cancelCta: string;
  newTabNote: string;
  closeAria: string;
};

export function CrossTourPreviewCard({
  open,
  onOpenChange,
  target,
  lang,
  openInNewTab,
  dict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: CrossTourTarget | null;
  lang: Locale;
  /**
   * Pass true when the viewer is inside a course lesson — opens the
   * target in a new tab so course progress in the current tab stays
   * intact. Pass false on the public tour page for same-tab nav.
   */
  openInNewTab: boolean;
  dict: CrossTourPreviewCardDict;
}) {
  const router = useRouter();
  if (!target) return null;
  const href = `/${lang}/tours/${target.slug}`;

  function enterTour() {
    if (openInNewTab) {
      window.open(href, "_blank", "noopener,noreferrer");
      onOpenChange(false);
      return;
    }
    router.push(href);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none"
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-black/10 bg-background p-0 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:border-white/15"
          aria-describedby={target.description ? "cross-tour-description" : undefined}
        >
          {target.posterUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-black/5 dark:bg-white/5">
              <Image
                src={target.posterUrl}
                alt=""
                fill
                sizes="(min-width: 640px) 28rem, 92vw"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-3 p-5">
            <Dialog.Title className="text-xl font-semibold tracking-tight">
              {target.name}
            </Dialog.Title>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {dict.title}
            </p>
            {target.description ? (
              <p
                id="cross-tour-description"
                className="text-sm leading-6 text-zinc-700 dark:text-zinc-200"
              >
                {target.description}
              </p>
            ) : null}
            {openInNewTab ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-900 dark:border-amber-400/30 dark:text-amber-200">
                {dict.newTabNote}
              </p>
            ) : null}
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={enterTour}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {dict.enterCta} →
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
                >
                  {dict.cancelCta}
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
