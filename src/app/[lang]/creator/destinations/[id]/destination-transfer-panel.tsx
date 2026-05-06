"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transferDestinationContent } from "@/lib/actions/destination-transfer";
import type { Locale } from "@/lib/locales";

type Dict = {
  heading: string;
  intro: string;
  emailLabel: string;
  emailPlaceholder: string;
  submitCta: string;
  submittingLabel: string;
  confirmPrompt: string;
  successMessage: string;
  noScenesError: string;
  selfTransferError: string;
  targetNotFoundError: string;
  genericError: string;
};

export function DestinationTransferPanel({
  lang,
  destinationId,
  ownsAnyScene,
  dict,
}: {
  lang: Locale;
  destinationId: string;
  ownsAnyScene: boolean;
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    if (!confirm(dict.confirmPrompt.replace("{email}", email))) return;
    startTransition(async () => {
      const result = await transferDestinationContent(formData);
      if (result.ok) {
        setSuccess(
          dict.successMessage
            .replace("{scenes}", String(result.data.sceneCount))
            .replace("{media}", String(result.data.mediaCount)),
        );
        setEmail("");
        router.refresh();
      } else {
        setError(
          result.code === "no_scenes_owned"
            ? dict.noScenesError
            : result.code === "self_transfer"
              ? dict.selfTransferError
              : result.code === "target_not_found"
                ? dict.targetNotFoundError
                : dict.genericError,
        );
      }
    });
  }

  return (
    <section
      aria-labelledby="destination-transfer-heading"
      className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 dark:border-amber-400/40"
    >
      <h2 id="destination-transfer-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{dict.intro}</p>

      {!ownsAnyScene ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-zinc-400/40 bg-zinc-400/10 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-300/40 dark:text-zinc-200"
        >
          {dict.noScenesError}
        </p>
      ) : (
        <form
          action={onSubmit}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="destinationId" value={destinationId} />
          <input type="hidden" name="lang" value={lang} />
          <label className="flex-1 text-sm">
            <span className="block font-medium">{dict.emailLabel}</span>
            <input
              type="email"
              name="toUserEmail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={dict.emailPlaceholder}
              className="mt-1 block w-full min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-sm dark:border-white/20"
            />
          </label>
          <button
            type="submit"
            disabled={pending || !email.trim()}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pending ? dict.submittingLabel : dict.submitCta}
          </button>
        </form>
      )}

      {success ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {success}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}
