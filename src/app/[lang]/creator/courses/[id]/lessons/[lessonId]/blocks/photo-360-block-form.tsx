"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

export type Photo360Option = {
  id: string;
  displayName: string | null;
  thumbnailUrl: string | null;
};

type Dict = {
  panoramaLabel: string;
  captionLabel: string;
  captionHelp: string;
  emptyState: string;
  emptyStateCta: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
  unnamedLabel: string;
};

type ActionResult =
  | { ok: true; data: { id: string; lessonId: string; courseId: string } }
  | { ok: false; error: string; code: string };

export function Photo360BlockForm({
  lang,
  courseId,
  lessonId,
  options,
  mediaLibraryHref,
  initial,
  dict,
  action,
  mode,
}: {
  lang: Locale;
  courseId: string;
  lessonId: string;
  options: Photo360Option[];
  mediaLibraryHref: string;
  initial?: { id?: string; mediaId?: string; caption?: string };
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
  mode: "new" | "edit";
}) {
  const router = useRouter();
  const fieldId = useId();
  const [selection, setSelection] = useState<string>(initial?.mediaId ?? options[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    const formData = new FormData(event.currentTarget);
    formData.set("lang", lang);
    formData.set("mediaId", selection);
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

  if (options.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-black/15 p-6 text-center dark:border-white/20">
        <p className="text-base text-zinc-700 dark:text-zinc-200">{dict.emptyState}</p>
        <Link
          href={mediaLibraryHref}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.emptyStateCta}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">{dict.panoramaLabel}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {options.map((option) => {
            const selected = selection === option.id;
            const label = option.displayName ?? dict.unnamedLabel;
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer flex-col items-stretch gap-2 rounded-lg border p-2 text-center text-xs ${
                  selected
                    ? "border-foreground bg-foreground/5"
                    : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                }`}
              >
                <input
                  type="radio"
                  name={`${fieldId}-panorama`}
                  value={option.id}
                  checked={selected}
                  onChange={() => setSelection(option.id)}
                  className="sr-only"
                />
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black/5 dark:bg-white/5">
                  {option.thumbnailUrl ? (
                    <Image
                      src={option.thumbnailUrl}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 20vw, 40vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-zinc-500">—</span>
                  )}
                </div>
                <span className="font-medium wrap-break-word">{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${fieldId}-caption`} className="text-sm font-medium">
          {dict.captionLabel}
        </label>
        <input
          id={`${fieldId}-caption`}
          name="caption"
          type="text"
          maxLength={500}
          defaultValue={initial?.caption ?? ""}
          aria-describedby={`${fieldId}-caption-help`}
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id={`${fieldId}-caption-help`} className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.captionHelp}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending || !selection}
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
