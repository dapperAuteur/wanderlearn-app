import Link from "next/link";
import type { Locale } from "@/lib/locales";

export type MissingTranscriptDict = {
  /** e.g. "No transcript attached" */
  heading: string;
  /** One sentence on who this shuts out. */
  body: string;
  /** e.g. "Why transcripts matter" */
  learnMore: string;
};

/**
 * Shown wherever a video has no transcript attached.
 *
 * Deliberately not `role="alert"`: these render on page load, sometimes several at
 * once in a media list, and an alert would make a screen reader interrupt and
 * announce each one. `role="note"` puts it in the accessibility tree as supporting
 * information the user can navigate to, which is what it is.
 *
 * Tone is encouragement, not obstruction — it names who is shut out rather than
 * scolding the creator, and every instance links to the reasoning at /docs/transcripts
 * so the ask is explained rather than asserted.
 */
export function MissingTranscriptNotice({
  lang,
  dict,
  className = "",
}: {
  lang: Locale;
  dict: MissingTranscriptDict;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={[
        // Amber, not red: this is not an error. Contrast checked in both schemes —
        // amber-900 on amber-500/10 and amber-100 on the dark equivalent.
        "flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm",
        "text-amber-900 dark:border-amber-400/40 dark:text-amber-100",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="font-medium">
        <span aria-hidden="true">⚠ </span>
        {dict.heading}
      </p>
      <p>{dict.body}</p>
      <Link
        href={`/${lang}/docs/transcripts`}
        className="inline-flex min-h-11 items-center font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {dict.learnMore}
      </Link>
    </div>
  );
}

// No kind list lives here on purpose: callers already know whether the thing they
// are rendering carries speech (media-library-row has VIDEO_KINDS, the block forms
// know their own block type). A second list here would be a second source of truth
// that drifts. Audio narration also deserves a transcript, but the media row has no
// transcript selector for audio yet — that is a separate change, tracked in
// plans/future/09.
