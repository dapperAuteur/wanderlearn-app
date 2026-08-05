"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { createHunt } from "@/lib/actions/hunts";

export function NewHuntForm({
  destinationId,
  lang,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  dict: { newHeading: string; titleLabel: string; introLabel: string; createCta: string };
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const form = new FormData();
    form.set("destinationId", destinationId);
    form.set("title", title);
    form.set("intro", intro);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await createHunt(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setIntro("");
      router.push(`/${lang}/creator/destinations/${destinationId}/hunts/${result.data.id}`);
    });
  }

  return (
    <section aria-labelledby="new-hunt" className="mt-10">
      <h2 id="new-hunt" className="text-lg font-semibold">
        {dict.newHeading}
      </h2>
      <form onSubmit={onSubmit} className="mt-3 space-y-4">
        <div>
          <label htmlFor="hunt-title" className="block text-sm font-medium">
            {dict.titleLabel}
          </label>
          <input
            id="hunt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            className="mt-1 min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="hunt-intro" className="block text-sm font-medium">
            {dict.introLabel}
          </label>
          <textarea
            id="hunt-intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || title.trim() === ""}
          className="min-h-11 rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {dict.createCta}
        </button>
      </form>
    </section>
  );
}
