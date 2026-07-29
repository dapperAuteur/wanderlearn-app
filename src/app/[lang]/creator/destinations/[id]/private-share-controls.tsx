"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { setDestinationShareToken } from "@/lib/actions/destinations";
import { capture } from "@/lib/analytics/capture";

export type PrivateShareDict = {
  heading: string;
  intro: string;
  createCta: string;
  rotateCta: string;
  disableCta: string;
  workingLabel: string;
  copyCta: string;
  copiedLabel: string;
  copyFailedLabel: string;
  activeHint: string;
  rotateWarning: string;
  genericError: string;
};

/**
 * Private preview links: share a NOT-public tour with a client before launch.
 *
 * A capability token in the URL, deliberately not a PIN — a four-digit code on
 * a public URL is enumeration practice, and a PIN prompt puts login-shaped UI
 * on something that is not a login. Rotate kills every previously shared link
 * at once, which is the actual control a museum circulating a draft needs.
 */
export function PrivateShareControls({
  destinationId,
  destinationSlug,
  lang,
  initialToken,
  origin,
  dict,
}: {
  destinationId: string;
  destinationSlug: string;
  lang: Locale;
  initialToken: string | null;
  origin: string;
  dict: PrivateShareDict;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(initialToken);
  const [pending, startTransition] = useTransition();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const shareUrl = token
    ? `${origin}/${lang}/tours/${destinationSlug}?k=${token}`
    : null;

  function run(mode: "rotate" | "disable") {
    // Rotating with an existing token invalidates every link already sent —
    // worth a beat of friction; creating the first one needs none.
    if (mode === "rotate" && token && !window.confirm(dict.rotateWarning)) return;
    setError(null);
    setCopyState("idle");
    const form = new FormData();
    form.set("id", destinationId);
    form.set("mode", mode);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await setDestinationShareToken(form);
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      setToken(result.data.shareToken);
      router.refresh();
    });
  }

  async function onCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      capture("tour_shared", {
        destination_slug: destinationSlug,
        method: "preview_link",
        surface: "creator",
      });
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
      <h3 className="text-sm font-semibold">{dict.heading}</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{dict.intro}</p>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {shareUrl ? (
        <>
          <p className="mt-2 break-all rounded-md border border-black/10 bg-black/5 px-3 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5">
            {shareUrl}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{dict.activeHint}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {copyState === "copied"
                ? dict.copiedLabel
                : copyState === "failed"
                  ? dict.copyFailedLabel
                  : dict.copyCta}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run("rotate")}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {pending ? dict.workingLabel : dict.rotateCta}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run("disable")}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {pending ? dict.workingLabel : dict.disableCta}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("rotate")}
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
        >
          {pending ? dict.workingLabel : dict.createCta}
        </button>
      )}
    </div>
  );
}
