"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateScene, duplicateTour } from "@/lib/actions/duplicate";
import type { Locale } from "@/lib/locales";

export type DuplicateDict = {
  cta: string;
  confirmText: string;
  confirmCta: string;
  cancelCta: string;
  workingLabel: string;
  copySuffix: string;
  genericError: string;
  nothingToCopy?: string;
};

const BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5";

/**
 * "Duplicate scene" / "Duplicate tour". Asks first (saying exactly what is and
 * isn't copied), then opens the copy, so the creator lands where they'll work.
 */
export function DuplicateButton(
  props: { lang: Locale; dict: DuplicateDict } & (
    | { kind: "scene"; sceneId: string; destinationId: string }
    | { kind: "tour"; destinationId: string }
  ),
) {
  const { lang, dict } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  function go() {
    setError(null);
    startTransition(async () => {
      if (props.kind === "scene") {
        const result = await duplicateScene({
          sceneId: props.sceneId,
          destinationId: props.destinationId,
          copySuffix: dict.copySuffix,
          lang,
        });
        if (!result.ok) return setError(dict.genericError);
        router.push(`/${lang}/creator/destinations/${props.destinationId}/scenes/${result.data.sceneId}/edit`);
      } else {
        const result = await duplicateTour({ destinationId: props.destinationId, copySuffix: dict.copySuffix, lang });
        if (!result.ok) {
          return setError(result.code === "nothing_to_copy" && dict.nothingToCopy ? dict.nothingToCopy : dict.genericError);
        }
        router.push(`/${lang}/creator/destinations/${result.data.destinationId}`);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className={BUTTON}>
          {dict.cta}
        </button>
      ) : (
        <div role="alert" className="max-w-prose rounded-md border border-black/15 p-3 text-sm dark:border-white/20">
          <p>{dict.confirmText}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={go} className={BUTTON}>
              {pending ? dict.workingLabel : dict.confirmCta}
            </button>
            <button ref={cancelRef} type="button" disabled={pending} onClick={() => setConfirming(false)} className={BUTTON}>
              {dict.cancelCta}
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
