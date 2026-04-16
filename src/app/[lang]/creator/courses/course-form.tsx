"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";
import { estimateStripeFee } from "@/lib/stripe-fees";

type Dict = {
  titleLabel: string;
  slugLabel: string;
  slugHelp: string;
  subtitleLabel: string;
  descriptionLabel: string;
  destinationLabel: string;
  destinationNone: string;
  destinationHelp: string;
  priceLabel: string;
  priceHelp: string;
  defaultLocaleLabel: string;
  localeEn: string;
  localeEs: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
  slugTakenError: string;
  feesHeading: string;
  feesFree: string;
  feesFormula: string;
  feesGrossLabel: string;
  feesStripeLabel: string;
  feesNetLabel: string;
  feesDisclaimer: string;
};

type Initial = {
  id?: string;
  title?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  destinationId?: string | null;
  priceCents?: number;
  defaultLocale?: string;
};

type DestinationOption = { id: string; name: string };

type ActionResult = { ok: true; data: { id: string } } | { ok: false; error: string; code: string };

export function CourseForm({
  dict,
  lang,
  initial,
  destinations,
  action,
}: {
  dict: Dict;
  lang: Locale;
  initial?: Initial;
  destinations: DestinationOption[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(initial?.id);

  const initialPriceDollars =
    typeof initial?.priceCents === "number" ? initial.priceCents / 100 : 0;
  const [priceDollars, setPriceDollars] = useState<number>(initialPriceDollars);
  const priceCentsLive = Math.max(0, Math.round(priceDollars * 100));
  const fees = estimateStripeFee(priceCentsLive);
  const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("lang", lang);
    if (initial?.id) formData.set("id", initial.id);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        const savedFlag = isEdit ? "1" : "created";
        router.push(`/${lang}/creator/courses/${result.data.id}?saved=${savedFlag}`);
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
        <label htmlFor="subtitle" className="text-sm font-medium">
          {dict.subtitleLabel}
        </label>
        <input
          id="subtitle"
          name="subtitle"
          type="text"
          maxLength={300}
          defaultValue={initial?.subtitle ?? ""}
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="destinationId" className="text-sm font-medium">
          {dict.destinationLabel}
        </label>
        <select
          id="destinationId"
          name="destinationId"
          defaultValue={initial?.destinationId ?? ""}
          aria-describedby="destination-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        >
          <option value="">{dict.destinationNone}</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <p id="destination-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.destinationHelp}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="priceCents" className="text-sm font-medium">
            {dict.priceLabel}
          </label>
          <input
            id="priceCents"
            name="priceCents"
            type="number"
            min={0}
            max={9999}
            step="0.01"
            inputMode="decimal"
            value={Number.isFinite(priceDollars) ? priceDollars.toString() : "0"}
            onChange={(e) => {
              const next = Number(e.target.value);
              setPriceDollars(Number.isFinite(next) ? next : 0);
            }}
            aria-describedby="price-help"
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
          <p id="price-help" className="text-xs text-zinc-600 dark:text-zinc-400">
            {dict.priceHelp}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="defaultLocale" className="text-sm font-medium">
            {dict.defaultLocaleLabel}
          </label>
          <select
            id="defaultLocale"
            name="defaultLocale"
            defaultValue={initial?.defaultLocale ?? lang}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          >
            <option value="en">{dict.localeEn}</option>
            <option value="es">{dict.localeEs}</option>
          </select>
        </div>
      </div>

      <aside
        aria-live="polite"
        className="rounded-lg border border-black/10 bg-black/5 p-4 text-sm dark:border-white/15 dark:bg-white/5"
      >
        <p className="font-semibold">{dict.feesHeading}</p>
        {priceCentsLive === 0 ? (
          <p className="mt-1 text-zinc-600 dark:text-zinc-300">{dict.feesFree}</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {dict.feesFormula
                .replace("{percent}", (fees.feePercent * 100).toFixed(1))
                .replace("{fixed}", formatUsd(fees.fixedCents))}
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
              <dt className="text-zinc-500 dark:text-zinc-400">
                {dict.feesGrossLabel}
              </dt>
              <dd>{formatUsd(fees.gross)}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">
                {dict.feesStripeLabel}
              </dt>
              <dd className="text-red-700 dark:text-red-300">
                −{formatUsd(fees.feeCents)}
              </dd>
              <dt className="font-semibold text-emerald-800 dark:text-emerald-300">
                {dict.feesNetLabel}
              </dt>
              <dd className="font-semibold text-emerald-800 dark:text-emerald-300">
                {formatUsd(fees.netCents)}
              </dd>
            </dl>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {dict.feesDisclaimer}
            </p>
          </>
        )}
      </aside>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-sm font-medium">
          {dict.descriptionLabel}
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          maxLength={4000}
          defaultValue={initial?.description ?? ""}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
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
          href={`/${lang}/creator/courses`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
