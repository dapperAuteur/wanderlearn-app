"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { updateProfile } from "@/lib/actions/account";

export type ProfileFormDict = {
  heading: string;
  intro: string;
  nameLabel: string;
  emailLabel: string;
  emailReadOnlyHint: string;
  localeLabel: string;
  localeOptions: Record<"en" | "es", string>;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  genericError: string;
};

export function ProfileForm({
  lang,
  initialName,
  email,
  initialLocale,
  dict,
}: {
  lang: Locale;
  initialName: string;
  email: string;
  initialLocale: "en" | "es";
  dict: ProfileFormDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("lang", lang);
    setError(null);
    setStatus("idle");
    startTransition(async () => {
      const result = await updateProfile(form);
      if (!result.ok) {
        setStatus("error");
        setError(dict.genericError);
        return;
      }
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  return (
    <section
      aria-labelledby="profile-heading"
      className="rounded-lg border border-black/10 p-6 dark:border-white/15"
    >
      <h2 id="profile-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{dict.nameLabel}</span>
          <input
            type="text"
            name="name"
            required
            minLength={1}
            maxLength={120}
            defaultValue={initialName}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{dict.emailLabel}</span>
          <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 font-mono text-sm dark:border-white/15 dark:bg-white/5">
            {email}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{dict.emailReadOnlyHint}</p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{dict.localeLabel}</span>
          <select
            name="locale"
            defaultValue={initialLocale}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          >
            <option value="en">{dict.localeOptions.en}</option>
            <option value="es">{dict.localeOptions.es}</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pending ? dict.savingLabel : dict.saveCta}
          </button>
          {status === "saved" ? (
            <span role="status" aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              ✓ {dict.savedLabel}
            </span>
          ) : null}
          {error ? (
            <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
              {error}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
