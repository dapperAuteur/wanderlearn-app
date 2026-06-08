"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type Dict = {
  urlLabel: string;
  urlHelp: string;
  captionLabel: string;
  captionHelp: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
  invalidUrlError: string;
};

type ActionResult =
  | { ok: true; data: { id: string; lessonId: string; courseId: string } }
  | { ok: false; error: string; code: string };

export function YoutubeBlockForm({
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
  initial?: { id?: string; url: string; caption?: string };
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
        window.alert(
          result.code === "invalid_youtube_url" ? dict.invalidUrlError : dict.genericError,
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="url" className="text-sm font-medium">
          {dict.urlLabel}
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          maxLength={500}
          defaultValue={initial?.url ?? ""}
          aria-describedby="url-help"
          placeholder="https://www.youtube.com/watch?v=…"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="url-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.urlHelp}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="caption" className="text-sm font-medium">
          {dict.captionLabel}
        </label>
        <input
          id="caption"
          name="caption"
          type="text"
          maxLength={500}
          defaultValue={initial?.caption ?? ""}
          aria-describedby="caption-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="caption-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.captionHelp}
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
