"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type ActionResult = { ok: true; data: unknown } | { ok: false; error: string; code: string };

type Dict = {
  sourceLabel: string;
  translationLabel: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  genericError: string;
  noSource: string;
  notTranslatable: string;
  notTranslatableHint: string;
};

export function CourseTranslationForm({
  lang,
  courseId,
  locale,
  source,
  initial,
  dict,
  action,
  labels,
}: {
  lang: Locale;
  courseId: string;
  locale: string;
  source: { title: string; subtitle: string | null; description: string | null };
  initial: { title: string; subtitle: string | null; description: string | null } | null;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
  labels: { title: string; subtitle: string; description: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState<string>(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState<string>(initial?.subtitle ?? "");
  const [description, setDescription] = useState<string>(initial?.description ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("locale", locale);
    formData.set("lang", lang);
    formData.set("title", title);
    formData.set("subtitle", subtitle);
    formData.set("description", description);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldPair
        id={`course-title-${courseId}`}
        label={labels.title}
        sourceLabel={dict.sourceLabel}
        translationLabel={dict.translationLabel}
        sourceValue={source.title}
        value={title}
        onChange={setTitle}
        required
        maxLength={200}
      />
      <FieldPair
        id={`course-subtitle-${courseId}`}
        label={labels.subtitle}
        sourceLabel={dict.sourceLabel}
        translationLabel={dict.translationLabel}
        sourceValue={source.subtitle ?? dict.noSource}
        value={subtitle}
        onChange={setSubtitle}
        maxLength={500}
      />
      <FieldPair
        id={`course-description-${courseId}`}
        label={labels.description}
        sourceLabel={dict.sourceLabel}
        translationLabel={dict.translationLabel}
        sourceValue={source.description ?? dict.noSource}
        value={description}
        onChange={setDescription}
        maxLength={20_000}
        multiline
      />
      <SaveRow pending={pending} status={status} dict={dict} />
    </form>
  );
}

export function LessonTranslationForm({
  lang,
  lessonId,
  locale,
  source,
  initial,
  dict,
  action,
  labels,
}: {
  lang: Locale;
  lessonId: string;
  locale: string;
  source: { title: string; summary: string | null };
  initial: { title: string; summary: string | null } | null;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
  labels: { title: string; summary: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState<string>(initial?.title ?? "");
  const [summary, setSummary] = useState<string>(initial?.summary ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("lessonId", lessonId);
    formData.set("locale", locale);
    formData.set("lang", lang);
    formData.set("title", title);
    formData.set("summary", summary);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldPair
        id={`lesson-title-${lessonId}`}
        label={labels.title}
        sourceLabel={dict.sourceLabel}
        translationLabel={dict.translationLabel}
        sourceValue={source.title}
        value={title}
        onChange={setTitle}
        required
        maxLength={200}
      />
      <FieldPair
        id={`lesson-summary-${lessonId}`}
        label={labels.summary}
        sourceLabel={dict.sourceLabel}
        translationLabel={dict.translationLabel}
        sourceValue={source.summary ?? dict.noSource}
        value={summary}
        onChange={setSummary}
        maxLength={2000}
        multiline
      />
      <SaveRow pending={pending} status={status} dict={dict} />
    </form>
  );
}

export function TextBlockTranslationForm({
  lang,
  blockId,
  locale,
  sourceMarkdown,
  initialMarkdown,
  dict,
  action,
  labels,
}: {
  lang: Locale;
  blockId: string;
  locale: string;
  sourceMarkdown: string;
  initialMarkdown: string | null;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
  labels: { markdown: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [markdown, setMarkdown] = useState<string>(initialMarkdown ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("blockId", blockId);
    formData.set("locale", locale);
    formData.set("lang", lang);
    formData.set("markdown", markdown);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldPair
        id={`block-md-${blockId}`}
        label={labels.markdown}
        sourceLabel={dict.sourceLabel}
        translationLabel={dict.translationLabel}
        sourceValue={sourceMarkdown}
        value={markdown}
        onChange={setMarkdown}
        maxLength={20_000}
        multiline
        required
      />
      <SaveRow pending={pending} status={status} dict={dict} />
    </form>
  );
}

function FieldPair({
  id,
  label,
  sourceLabel,
  translationLabel,
  sourceValue,
  value,
  onChange,
  maxLength,
  required,
  multiline,
}: {
  id: string;
  label: string;
  sourceLabel: string;
  translationLabel: string;
  sourceValue: string;
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  required?: boolean;
  multiline?: boolean;
}) {
  const inputCommon =
    "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20";
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {sourceLabel}
          </span>
          <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-dashed border-black/10 bg-black/5 px-3 py-2 text-sm text-zinc-700 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300">
            {sourceValue}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {translationLabel}
          </span>
          {multiline ? (
            <textarea
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={maxLength}
              required={required}
              rows={8}
              className={`${inputCommon} min-h-40`}
            />
          ) : (
            <input
              id={id}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={maxLength}
              required={required}
              className={`${inputCommon} min-h-11`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SaveRow({
  pending,
  status,
  dict,
}: {
  pending: boolean;
  status: "idle" | "saved" | "error";
  dict: Dict;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
      >
        {pending ? dict.savingLabel : dict.saveCta}
      </button>
      {status === "saved" ? (
        <span
          role="status"
          aria-live="polite"
          className="text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          {dict.savedLabel}
        </span>
      ) : null}
      {status === "error" ? (
        <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
          {dict.genericError}
        </span>
      ) : null}
    </div>
  );
}

export function NotTranslatableNotice({ dict, label }: { dict: Dict; label: string }) {
  return (
    <div className="rounded-md border border-dashed border-black/15 bg-black/5 px-4 py-3 text-sm dark:border-white/15 dark:bg-white/5">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{dict.notTranslatable}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{dict.notTranslatableHint}</p>
    </div>
  );
}
