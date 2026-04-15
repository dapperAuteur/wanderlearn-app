"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type Dict = {
  nameLabel: string;
  slugLabel: string;
  slugHelp: string;
  countryLabel: string;
  cityLabel: string;
  latLabel: string;
  lngLabel: string;
  descriptionLabel: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
};

type Initial = {
  id?: string;
  name?: string;
  slug?: string;
  country?: string | null;
  city?: string | null;
  lat?: string | null;
  lng?: string | null;
  description?: string | null;
};

type ActionResult = { ok: true; data: { id: string } } | { ok: false; error: string; code: string };

export function DestinationForm({
  dict,
  lang,
  initial,
  action,
}: {
  dict: Dict;
  lang: Locale;
  initial?: Initial;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("lang", lang);
    if (initial?.id) formData.set("id", initial.id);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.push(`/${lang}/creator/destinations/${result.data.id}`);
        router.refresh();
      } else {
        window.alert(dict.genericError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
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
            defaultValue={initial?.name ?? ""}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
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
          <label htmlFor="country" className="text-sm font-medium">
            {dict.countryLabel}
          </label>
          <input
            id="country"
            name="country"
            type="text"
            maxLength={100}
            defaultValue={initial?.country ?? ""}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="city" className="text-sm font-medium">
            {dict.cityLabel}
          </label>
          <input
            id="city"
            name="city"
            type="text"
            maxLength={100}
            defaultValue={initial?.city ?? ""}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lat" className="text-sm font-medium">
            {dict.latLabel}
          </label>
          <input
            id="lat"
            name="lat"
            type="number"
            step="0.000001"
            min={-90}
            max={90}
            defaultValue={initial?.lat ?? ""}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lng" className="text-sm font-medium">
            {dict.lngLabel}
          </label>
          <input
            id="lng"
            name="lng"
            type="number"
            step="0.000001"
            min={-180}
            max={180}
            defaultValue={initial?.lng ?? ""}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="description" className="text-sm font-medium">
            {dict.descriptionLabel}
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={initial?.description ?? ""}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </div>
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
          href={`/${lang}/creator/destinations`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
