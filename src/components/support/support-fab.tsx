"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/locales";

export type SupportFabDict = {
  fabLabel: string;
  fabMenuTitle: string;
  fabMenuBlurb: string;
  fabHelpArticles: string;
  fabHelpArticlesBlurb: string;
  fabNewThread: string;
  fabNewThreadBlurb: string;
  fabMyThreads: string;
  fabMyThreadsBlurb: string;
  fabUnreadBadgeOne: string;
  fabUnreadBadgeMany: string;
  fabCloseLabel: string;
};

/**
 * Floating "Get help" affordance. Opens a two-choice sheet rather than jumping
 * straight to the new-thread form: most questions are already answered in the
 * Help Center, and routing everyone into a ticket both buries the articles and
 * loads the (single-admin) support queue. Help is listed first, deliberately.
 *
 * Built on @radix-ui/react-dialog — the same primitive as the nav drawer — so
 * focus trap, Escape-to-close, and focus-return-to-trigger come for free
 * without adding a dropdown-menu dependency.
 */
/** English-style 1-vs-many. Both strings are translatable, so a locale that needs a
 *  different rule changes the strings, not this helper. */
function unreadLabel(dict: SupportFabDict, count: number): string {
  return count === 1
    ? dict.fabUnreadBadgeOne
    : dict.fabUnreadBadgeMany.replace("{count}", String(count));
}

export function SupportFab({
  lang,
  dict,
  unreadCount = 0,
}: {
  lang: Locale;
  dict: SupportFabDict;
  /** Unseen admin replies across the signed-in user's threads. */
  unreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const choiceClasses =
    "flex min-h-12 flex-col justify-center gap-0.5 rounded-lg border border-black/10 px-4 py-3 text-left hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:bg-white/5";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `${dict.fabLabel} — ${unreadLabel(dict, unreadCount)}`
              : dict.fabLabel
          }
          className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-lg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:bottom-6 sm:right-6"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <span aria-hidden="true" className="mr-2">
            ?
          </span>
          {dict.fabLabel}
          {unreadCount > 0 ? (
            <span
              // Count is announced through the button's aria-label rather than left
              // as a bare number a screen reader would read without context.
              aria-hidden="true"
              className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-bold text-foreground"
            >
              {unreadCount}
            </span>
          ) : null}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 z-50 flex w-[min(100vw,28rem)] -translate-x-1/2 flex-col gap-4 rounded-t-2xl bg-background p-5 shadow-2xl focus:outline-none sm:bottom-6 sm:rounded-2xl"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
          aria-describedby="support-fab-blurb"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">
                {dict.fabMenuTitle}
              </Dialog.Title>
              <p
                id="support-fab-blurb"
                className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
              >
                {dict.fabMenuBlurb}
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={dict.fabCloseLabel}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-black/10 text-xl hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:bg-white/5"
              >
                <span aria-hidden="true">×</span>
              </button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-2">
            <Link href={`/${lang}/help`} onClick={close} className={choiceClasses}>
              <span className="text-base font-medium">{dict.fabHelpArticles}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {dict.fabHelpArticlesBlurb}
              </span>
            </Link>
            <Link href={`/${lang}/support`} onClick={close} className={choiceClasses}>
              <span className="text-base font-medium">
                {dict.fabMyThreads}
                {unreadCount > 0 ? (
                  <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-bold text-background">
                    {unreadCount}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {unreadCount > 0
                  ? unreadLabel(dict, unreadCount)
                  : dict.fabMyThreadsBlurb}
              </span>
            </Link>
            <Link href={`/${lang}/support/new`} onClick={close} className={choiceClasses}>
              <span className="text-base font-medium">{dict.fabNewThread}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {dict.fabNewThreadBlurb}
              </span>
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
