"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type Dict = {
  nameLabel: string;
  captionLabel: string;
  captionHelp: string;
  panoramaLabel: string;
  panoramaEmptyState: string;
  panoramaUploadCta: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
};

type PanoramaOption = {
  id: string;
  label: string;
  thumbnailUrl: string | null;
};

type ActionResult =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string; code: string };

export function NewSceneForm({
  dict,
  lang,
  destinationId,
  panoramas,
  action,
}: {
  dict: Dict;
  lang: Locale;
  destinationId: string;
  panoramas: PanoramaOption[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedPanoramaId, setSelectedPanoramaId] = useState<string>(
    panoramas[0]?.id ?? "",
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPanoramaId) return;
    const formData = new FormData(event.currentTarget);
    formData.set("lang", lang);
    formData.set("destinationId", destinationId);
    formData.set("panoramaMediaId", selectedPanoramaId);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.push(
          `/${lang}/creator/destinations/${destinationId}/scenes/${result.data.id}?saved=created`,
        );
        router.refresh();
      } else {
        window.alert(dict.genericError);
      }
    });
  }

  if (panoramas.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-black/15 p-6 text-center dark:border-white/20">
        <p className="text-base text-zinc-700 dark:text-zinc-200">{dict.panoramaEmptyState}</p>
        <Link
          href={`/${lang}/creator/media`}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.panoramaUploadCta}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium">
          {dict.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={200}
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
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
          aria-describedby="caption-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="caption-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.captionHelp}
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">{dict.panoramaLabel}</legend>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {panoramas.map((p) => (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-2 ${
                  selectedPanoramaId === p.id
                    ? "border-foreground ring-2 ring-foreground/40"
                    : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
                }`}
              >
                <input
                  type="radio"
                  name="panoramaOptionRadio"
                  value={p.id}
                  checked={selectedPanoramaId === p.id}
                  onChange={() => setSelectedPanoramaId(p.id)}
                  className="sr-only"
                />
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbnailUrl}
                    alt=""
                    className="aspect-video w-full rounded-md object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="aspect-video w-full rounded-md bg-black/5 dark:bg-white/5"
                  />
                )}
                <span className="truncate text-sm">{p.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending || !selectedPanoramaId}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.savingLabel : dict.saveCta}
        </button>
        <Link
          href={`/${lang}/creator/destinations/${destinationId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
