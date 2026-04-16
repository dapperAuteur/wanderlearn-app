"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";
import { updateScene } from "@/lib/actions/scenes";

type Dict = {
  nameLabel: string;
  captionLabel: string;
  captionHelp: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
};

export function SceneEditForm({
  sceneId,
  destinationId,
  lang,
  initial,
  dict,
}: {
  sceneId: string;
  destinationId: string;
  lang: Locale;
  initial: { name: string; caption: string | null };
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("sceneId", sceneId);
    formData.set("destinationId", destinationId);
    formData.set("lang", lang);
    startTransition(async () => {
      const result = await updateScene(formData);
      if (result.ok) {
        router.push(
          `/${lang}/creator/destinations/${destinationId}/scenes/${sceneId}?saved=1`,
        );
        router.refresh();
      } else {
        window.alert(dict.genericError);
      }
    });
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
          defaultValue={initial.name}
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
          defaultValue={initial.caption ?? ""}
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
          href={`/${lang}/creator/destinations/${destinationId}/scenes/${sceneId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
