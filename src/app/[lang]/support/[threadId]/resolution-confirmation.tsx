"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { confirmResolution } from "@/lib/actions/support";

export type ResolutionConfirmationDict = {
  heading: string;
  intro: string;
  confirmCta: string;
  disputeCta: string;
  disputeReasonLabel: string;
  disputeReasonHelp: string;
  cancelDisputeCta: string;
  submitDisputeCta: string;
  savingLabel: string;
  savedConfirmedLabel: string;
  savedDisputedLabel: string;
  genericError: string;
};

type Stage = "idle" | "disputing" | "saving" | "confirmed" | "disputed" | "error";

export function ResolutionConfirmation({
  threadId,
  lang,
  dict,
}: {
  threadId: string;
  lang: Locale;
  dict: ResolutionConfirmationDict;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(positive: boolean, disputeReason?: string) {
    setError(null);
    setStage("saving");
    const form = new FormData();
    form.set("threadId", threadId);
    form.set("positive", positive ? "true" : "false");
    form.set("lang", lang);
    if (disputeReason && disputeReason.length > 0) {
      form.set("reason", disputeReason);
    }
    startTransition(async () => {
      const result = await confirmResolution(form);
      if (!result.ok) {
        setStage("error");
        setError(dict.genericError);
        return;
      }
      setStage(positive ? "confirmed" : "disputed");
      router.refresh();
    });
  }

  if (stage === "confirmed") {
    return (
      <section
        aria-labelledby="resolution-heading"
        className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 dark:border-emerald-400/40"
      >
        <h2 id="resolution-heading" className="text-lg font-semibold">
          {dict.heading}
        </h2>
        <p role="status" aria-live="polite" className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          ✓ {dict.savedConfirmedLabel}
        </p>
      </section>
    );
  }

  if (stage === "disputed") {
    return (
      <section
        aria-labelledby="resolution-heading"
        className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 dark:border-amber-400/40"
      >
        <h2 id="resolution-heading" className="text-lg font-semibold">
          {dict.heading}
        </h2>
        <p role="status" aria-live="polite" className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200">
          {dict.savedDisputedLabel}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="resolution-heading"
      className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 dark:border-emerald-400/40"
    >
      <h2 id="resolution-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{dict.intro}</p>

      {stage === "disputing" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(false, reason.trim() || undefined);
          }}
          className="mt-4 flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="dispute-reason" className="text-sm font-medium">
              {dict.disputeReasonLabel}
            </label>
            <textarea
              id="dispute-reason"
              name="reason"
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby="dispute-reason-help"
              className="min-h-24 rounded-md border border-black/15 bg-transparent p-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
            />
            <p id="dispute-reason-help" className="text-xs text-zinc-600 dark:text-zinc-400">
              {dict.disputeReasonHelp}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {pending ? dict.savingLabel : dict.submitDisputeCta}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("idle");
                setReason("");
                setError(null);
              }}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.cancelDisputeCta}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-600 px-6 text-base font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pending && stage === "saving" ? dict.savingLabel : `✓ ${dict.confirmCta}`}
          </button>
          <button
            type="button"
            onClick={() => setStage("disputing")}
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-amber-600 bg-transparent px-6 text-base font-semibold text-amber-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-500/10"
          >
            ✗ {dict.disputeCta}
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
