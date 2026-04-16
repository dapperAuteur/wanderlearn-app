"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type Dict = {
  markdownLabel: string;
  markdownHelp: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
};

type ActionResult =
  | { ok: true; data: { id: string; lessonId: string; courseId: string } }
  | { ok: false; error: string; code: string };

export function TextBlockForm({
  lang,
  courseId,
  lessonId,
  initial,
  dict,
  action,
  mode,
}: {
  lang: Locale;
  courseId: string;
  lessonId: string;
  initial?: { id?: string; markdown: string };
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
  mode: "new" | "edit";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("lang", lang);
    if (mode === "new") {
      formData.set("lessonId", lessonId);
    } else if (initial?.id) {
      formData.set("id", initial.id);
    }
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        const flag = mode === "new" ? "block-created" : "block-saved";
        router.push(`/${lang}/creator/courses/${courseId}/lessons/${lessonId}?saved=${flag}`);
        router.refresh();
      } else {
        window.alert(dict.genericError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="markdown" className="text-sm font-medium">
          {dict.markdownLabel}
        </label>
        <textarea
          id="markdown"
          name="markdown"
          required
          minLength={1}
          maxLength={20000}
          rows={16}
          defaultValue={initial?.markdown ?? ""}
          aria-describedby="markdown-help"
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="markdown-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.markdownHelp}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.savingLabel : dict.saveCta}
        </button>
        <Link
          href={`/${lang}/creator/courses/${courseId}/lessons/${lessonId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
