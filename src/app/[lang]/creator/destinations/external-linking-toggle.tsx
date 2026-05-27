"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { setCreatorAllowExternalLinking } from "@/lib/actions/destinations";

export type ExternalLinkingToggleDict = {
  heading: string;
  intro: string;
  onLabel: string;
  offLabel: string;
  onState: string;
  offState: string;
  savingLabel: string;
  savedLabel: string;
  genericError: string;
};

export function ExternalLinkingToggle({
  lang,
  initial,
  dict,
}: {
  lang: Locale;
  initial: boolean;
  dict: ExternalLinkingToggleDict;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function flip() {
    const next = !value;
    setValue(next);
    setStatus("idle");
    const form = new FormData();
    form.set("value", next ? "true" : "false");
    form.set("lang", lang);
    startTransition(async () => {
      const result = await setCreatorAllowExternalLinking(form);
      if (!result.ok) {
        setValue(!next);
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  return (
    <section
      aria-labelledby="external-linking-toggle-heading"
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h2 id="external-linking-toggle-heading" className="text-lg font-semibold">
            {dict.heading}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              value
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {value ? dict.onState : dict.offState}
          </span>
          <button
            type="button"
            onClick={flip}
            disabled={pending}
            aria-pressed={value}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
          >
            {pending
              ? dict.savingLabel
              : value
                ? dict.offLabel
                : dict.onLabel}
          </button>
        </div>
      </div>
      {status === "saved" ? (
        <p role="status" aria-live="polite" className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          ✓ {dict.savedLabel}
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {dict.genericError}
        </p>
      ) : null}
    </section>
  );
}
