"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { setDestinationPublic } from "@/lib/actions/destinations";

type Dict = {
  heading: string;
  intro: string;
  toggleLabel: string;
  publicState: string;
  privateState: string;
  makingPublicLabel: string;
  makingPrivateLabel: string;
  shareLinkLabel: string;
  copyCta: string;
  copiedLabel: string;
  copyFailedLabel: string;
  shareHintScene: string;
  shareHintDestination: string;
  genericError: string;
};

export function PublicShareControls({
  destinationId,
  destinationSlug,
  lang,
  initialIsPublic,
  sceneId,
  origin,
  dict,
}: {
  destinationId: string;
  destinationSlug: string;
  lang: Locale;
  initialIsPublic: boolean;
  /** When provided, the copied link includes ?scene=<sceneId>. */
  sceneId?: string;
  /** Absolute origin (e.g., "https://wanderlearn.witus.online"); the
   *  page passes this in so SSR + client render the same string. */
  origin: string;
  dict: Dict;
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pending, startTransition] = useTransition();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const shareUrl = sceneId
    ? `${origin}/${lang}/tours/${destinationSlug}?scene=${sceneId}`
    : `${origin}/${lang}/tours/${destinationSlug}`;

  function onToggle(nextPublic: boolean) {
    setError(null);
    const form = new FormData();
    form.set("id", destinationId);
    form.set("isPublic", nextPublic ? "true" : "false");
    form.set("lang", lang);
    startTransition(async () => {
      const result = await setDestinationPublic(form);
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      setIsPublic(nextPublic);
      router.refresh();
    });
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section
      aria-labelledby="public-share-heading"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="public-share-heading" className="text-lg font-semibold">
            {dict.heading}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {dict.intro}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isPublic
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {isPublic ? dict.publicState : dict.privateState}
          </span>
          <button
            type="button"
            onClick={() => onToggle(!isPublic)}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
          >
            {pending
              ? isPublic
                ? dict.makingPrivateLabel
                : dict.makingPublicLabel
              : dict.toggleLabel}
          </button>
        </div>
      </div>

      {isPublic ? (
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor="public-share-url" className="text-sm font-medium">
            {dict.shareLinkLabel}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="public-share-url"
              type="url"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 flex-1 rounded-md border border-black/15 bg-transparent px-3 font-mono text-xs dark:border-white/20"
            />
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {copyState === "copied"
                ? `✓ ${dict.copiedLabel}`
                : copyState === "failed"
                  ? dict.copyFailedLabel
                  : dict.copyCta}
            </button>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {sceneId ? dict.shareHintScene : dict.shareHintDestination}
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
