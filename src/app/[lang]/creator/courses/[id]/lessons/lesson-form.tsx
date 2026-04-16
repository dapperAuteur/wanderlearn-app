"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type Dict = {
  titleLabel: string;
  slugLabel: string;
  slugHelp: string;
  summaryLabel: string;
  statusLabel: string;
  statusDraft: string;
  statusPublished: string;
  freePreviewLabel: string;
  freePreviewHelp: string;
  estimatedMinutesLabel: string;
  estimatedMinutesHelp: string;
  orderIndexLabel: string;
  orderIndexHelp: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
  slugTakenError: string;
};

type Initial = {
  id?: string;
  title?: string;
  slug?: string;
  summary?: string | null;
  status?: "draft" | "published";
  isFreePreview?: boolean;
  estimatedMinutes?: number | null;
  orderIndex?: number;
};

type ActionResult = { ok: true; data: { id: string } } | { ok: false; error: string; code: string };

export function LessonForm({
  courseId,
  lang,
  initial,
  dict,
  action,
}: {
  courseId: string;
  lang: Locale;
  initial?: Initial;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(initial?.id);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("courseId", courseId);
    formData.set("lang", lang);
    if (initial?.id) formData.set("id", initial.id);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        const savedFlag = isEdit ? "1" : "created";
        router.push(
          `/${lang}/creator/courses/${courseId}/lessons/${result.data.id}?saved=${savedFlag}`,
        );
        router.refresh();
      } else {
        window.alert(result.code === "slug_taken" ? dict.slugTakenError : dict.genericError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          {dict.titleLabel}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={2}
          maxLength={200}
          defaultValue={initial?.title ?? ""}
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="slug" className="text-sm font-medium">
          {dict.slugLabel}
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          pattern="[a-z0-9\-]+"
          maxLength={120}
          defaultValue={initial?.slug ?? ""}
          aria-describedby="slug-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="slug-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.slugHelp}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="summary" className="text-sm font-medium">
          {dict.summaryLabel}
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={3}
          maxLength={1000}
          defaultValue={initial?.summary ?? ""}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="status" className="text-sm font-medium">
            {dict.statusLabel}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "draft"}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          >
            <option value="draft">{dict.statusDraft}</option>
            <option value="published">{dict.statusPublished}</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="estimatedMinutes" className="text-sm font-medium">
            {dict.estimatedMinutesLabel}
          </label>
          <input
            id="estimatedMinutes"
            name="estimatedMinutes"
            type="number"
            min={0}
            max={600}
            step={1}
            defaultValue={initial?.estimatedMinutes ?? ""}
            aria-describedby="minutes-help"
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
          <p id="minutes-help" className="text-xs text-zinc-600 dark:text-zinc-400">
            {dict.estimatedMinutesHelp}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="orderIndex" className="text-sm font-medium">
          {dict.orderIndexLabel}
        </label>
        <input
          id="orderIndex"
          name="orderIndex"
          type="number"
          min={0}
          max={999}
          step={1}
          defaultValue={initial?.orderIndex ?? ""}
          aria-describedby="order-help"
          className="min-h-11 w-32 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="order-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.orderIndexHelp}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-black/10 p-3 dark:border-white/15">
        <input
          id="isFreePreview"
          name="isFreePreview"
          type="checkbox"
          defaultChecked={initial?.isFreePreview ?? false}
          className="mt-1 h-5 w-5"
        />
        <label htmlFor="isFreePreview" className="flex flex-col text-sm">
          <span className="font-medium">{dict.freePreviewLabel}</span>
          <span className="text-zinc-600 dark:text-zinc-400">{dict.freePreviewHelp}</span>
        </label>
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
          href={`/${lang}/creator/courses/${courseId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
