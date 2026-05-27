"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import {
  setDestinationAllowExternalLinkingOverride,
  setDestinationNextDestination,
} from "@/lib/actions/destinations";

export type ExternalLinkingControlsDict = {
  heading: string;
  intro: string;
  accountDefaultLabel: string;
  accountDefaultOn: string;
  accountDefaultOff: string;
  overrideHeading: string;
  overrideInherit: string;
  overrideAllow: string;
  overrideBlock: string;
  overrideSavedLabel: string;
  nextTourHeading: string;
  nextTourIntro: string;
  nextTourNoneOption: string;
  nextTourEmptyState: string;
  nextTourSavedLabel: string;
  savingLabel: string;
  genericError: string;
};

type LinkableOption = { id: string; name: string; slug: string };
type Override = "inherit" | "allow" | "block";

function fromDb(value: boolean | null): Override {
  if (value === true) return "allow";
  if (value === false) return "block";
  return "inherit";
}

export function ExternalLinkingControls({
  destinationId,
  lang,
  accountDefaultOn,
  initialOverride,
  initialNextDestinationId,
  linkableOptions,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  accountDefaultOn: boolean;
  initialOverride: boolean | null;
  initialNextDestinationId: string | null;
  linkableOptions: LinkableOption[];
  dict: ExternalLinkingControlsDict;
}) {
  const router = useRouter();
  const [override, setOverride] = useState<Override>(fromDb(initialOverride));
  const [nextId, setNextId] = useState<string>(initialNextDestinationId ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved-override" | "saved-next" | "error">("idle");

  function saveOverride(next: Override) {
    const prev = override;
    setOverride(next);
    setStatus("idle");
    const form = new FormData();
    form.set("id", destinationId);
    form.set("lang", lang);
    form.set(
      "value",
      next === "allow" ? "true" : next === "block" ? "false" : "",
    );
    startTransition(async () => {
      const result = await setDestinationAllowExternalLinkingOverride(form);
      if (!result.ok) {
        setOverride(prev);
        setStatus("error");
        return;
      }
      setStatus("saved-override");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  function saveNextDestination(value: string) {
    const prev = nextId;
    setNextId(value);
    setStatus("idle");
    const form = new FormData();
    form.set("id", destinationId);
    form.set("lang", lang);
    form.set("nextDestinationId", value);
    startTransition(async () => {
      const result = await setDestinationNextDestination(form);
      if (!result.ok) {
        setNextId(prev);
        setStatus("error");
        return;
      }
      setStatus("saved-next");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  return (
    <section
      aria-labelledby="external-linking-heading"
      className="rounded-lg border border-black/10 p-6 dark:border-white/15"
    >
      <h2 id="external-linking-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      <p className="mt-3 rounded-md border border-black/10 bg-black/5 px-3 py-2 text-xs text-zinc-700 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300">
        {dict.accountDefaultLabel}:{" "}
        <span className={accountDefaultOn ? "font-semibold text-emerald-700 dark:text-emerald-300" : "font-semibold"}>
          {accountDefaultOn ? dict.accountDefaultOn : dict.accountDefaultOff}
        </span>
      </p>

      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="text-sm font-medium">{dict.overrideHeading}</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { v: "inherit" as const, label: dict.overrideInherit },
              { v: "allow" as const, label: dict.overrideAllow },
              { v: "block" as const, label: dict.overrideBlock },
            ]
          ).map((opt) => (
            <label
              key={opt.v}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                override === opt.v
                  ? "border-foreground bg-foreground/5"
                  : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name="override"
                value={opt.v}
                checked={override === opt.v}
                onChange={() => saveOverride(opt.v)}
                disabled={pending}
                className="sr-only"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        {status === "saved-override" ? (
          <p role="status" aria-live="polite" className="text-xs text-emerald-700 dark:text-emerald-300">
            ✓ {dict.overrideSavedLabel}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor="next-destination" className="text-sm font-medium">
          {dict.nextTourHeading}
        </label>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{dict.nextTourIntro}</p>
        {linkableOptions.length === 0 ? (
          <p className="rounded-md border border-dashed border-black/15 p-3 text-xs text-zinc-600 dark:border-white/20 dark:text-zinc-400">
            {dict.nextTourEmptyState}
          </p>
        ) : (
          <select
            id="next-destination"
            value={nextId}
            onChange={(e) => saveNextDestination(e.target.value)}
            disabled={pending}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20"
          >
            <option value="">{dict.nextTourNoneOption}</option>
            {linkableOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        {status === "saved-next" ? (
          <p role="status" aria-live="polite" className="text-xs text-emerald-700 dark:text-emerald-300">
            ✓ {dict.nextTourSavedLabel}
          </p>
        ) : null}
      </div>

      {status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {dict.genericError}
        </p>
      ) : null}
    </section>
  );
}
