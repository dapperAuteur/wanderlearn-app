"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type ActionResult =
  | { ok: true; data: { threadId: string } }
  | { ok: false; error: string; code: string };

type Dict = {
  subjectLabel: string;
  subjectPlaceholder: string;
  categoryLabel: string;
  categories: Record<string, string>;
  bodyLabel: string;
  bodyPlaceholder: string;
  submitCta: string;
  submittingLabel: string;
  cancelCta: string;
  genericError: string;
};

const CATEGORIES = ["bug", "ui_ux", "feature_request", "question", "content", "other"] as const;

export function NewThreadForm({
  lang,
  dict,
  action,
}: {
  lang: Locale;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("bug");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("lang", lang);
    formData.set("subject", subject);
    formData.set("category", category);
    formData.set("body", body);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.push(`/${lang}/support/${result.data.threadId}`);
        router.refresh();
      } else {
        setError(dict.genericError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="support-subject" className="text-sm font-medium">
          {dict.subjectLabel}
        </label>
        <input
          id="support-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={dict.subjectPlaceholder}
          minLength={3}
          maxLength={200}
          required
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="support-category" className="text-sm font-medium">
          {dict.categoryLabel}
        </label>
        <select
          id="support-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {dict.categories[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="support-body" className="text-sm font-medium">
          {dict.bodyLabel}
        </label>
        <textarea
          id="support-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={dict.bodyPlaceholder}
          minLength={1}
          maxLength={10_000}
          required
          rows={8}
          className="min-h-48 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:border-red-400/30 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.submittingLabel : dict.submitCta}
        </button>
        <Link
          href={`/${lang}/support`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
