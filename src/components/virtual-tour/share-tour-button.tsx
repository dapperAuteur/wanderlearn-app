"use client";

import { useState } from "react";
import { capture } from "@/lib/analytics/capture";

export type ShareTourDict = {
  /** Button label. */
  cta: string;
  /** Confirmation after the link is on the clipboard. */
  copiedLabel: string;
  /** Shown when neither sharing nor copying is available. */
  fallbackLabel: string;
  /** Title handed to the OS share sheet. */
  shareTitle: string;
  /** Short line handed to the OS share sheet alongside the link. */
  shareText: string;
};

/**
 * Lets a visitor share a tour.
 *
 * WHY THIS DID NOT EXIST. Searching the app for any learner-facing share
 * control returned nothing: `public-share-controls.tsx` and
 * `private-share-controls.tsx` are CREATOR tools for distributing a
 * destination, and the only completion artifact was a PDF certificate behind a
 * sign-in and an enrolment. A PDF does not preview in a group chat — it
 * downloads. So the mechanism the growth plan rested on was absent.
 *
 * WHAT IT SHARES. When the creator has marked a peak scene, the link opens
 * there rather than at the tour's beginning. Memory of an experience is
 * dominated by its most intense moment rather than its duration, and the
 * emotion that actually travels is awe — which a 360° capture of a real place
 * is uniquely good at producing. So the recipient should land on the best view
 * in the tour, not on a doorway.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. There is no free-text note yet. Encoding
 * one in the URL would be trivial and wrong: anything in a query string ends
 * up rendered into the link-preview image, which means a stranger could craft
 * a URL that puts arbitrary text on a card carrying our branding and share it
 * as if we published it. A note needs storage and a moderation posture, not a
 * query parameter.
 */
export function ShareTourButton({
  destinationSlug,
  shareUrl,
  dict,
}: {
  destinationSlug: string;
  /** Absolute URL, already pointed at the peak scene where one is set. */
  shareUrl: string;
  dict: ShareTourDict;
}) {
  const [state, setState] = useState<"idle" | "copied" | "unavailable">("idle");

  async function onShare() {
    // The OS share sheet is the right surface on a phone — it reaches the
    // group chat directly, which is where this is meant to go. Desktop
    // browsers mostly lack it, so clipboard is the fallback rather than the
    // afterthought.
    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

    if (canShare) {
      try {
        await navigator.share({ title: dict.shareTitle, text: dict.shareText, url: shareUrl });
        capture("tour_shared", {
          destination_slug: destinationSlug,
          method: "public_link",
          surface: "public",
        });
        return;
      } catch {
        // A cancelled share sheet throws exactly like a failed one, so this
        // must not be reported as an error or counted as a share. Fall
        // through to copying, which is harmless if they simply changed their
        // mind.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setState("copied");
      capture("tour_shared", {
        destination_slug: destinationSlug,
        method: "public_link",
        surface: "public",
      });
      setTimeout(() => setState("idle"), 2500);
    } catch {
      // Clipboard access can be refused outright — an insecure origin, or a
      // browser that gates it behind a permission. Say so rather than
      // appearing to succeed.
      setState("unavailable");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onShare}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-brand-text bg-brand px-4 text-sm font-bold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {/* Decorative: the button's own text already names the action. */}
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M13 5.83 15.59 8.41 17 7l-5-5-5 5 1.41 1.41L11 5.83V16h2V5.83Z" />
          <path d="M5 18v-7H3v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7H5Z" />
        </svg>
        {dict.cta}
      </button>

      {/*
        One live region covering both outcomes. `polite` because a share is
        something the visitor initiated and is already looking at — an
        assertive interruption would be rude for a confirmation.
      */}
      <p aria-live="polite" className="text-sm text-muted">
        {state === "copied" ? dict.copiedLabel : state === "unavailable" ? dict.fallbackLabel : ""}
      </p>
    </div>
  );
}
