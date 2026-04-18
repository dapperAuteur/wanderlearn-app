import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "../dictionaries";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const path = `/${lang}/terms`;
  return {
    title: dict.terms.metaTitle,
    description: dict.terms.metaDescription,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates("/terms", locales),
    },
    openGraph: {
      type: "article",
      siteName,
      title: dict.terms.metaTitle,
      description: dict.terms.metaDescription,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
  };
}

export default async function TermsPage({
  params,
}: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
        {dict.terms.eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        {dict.terms.headline}
      </h1>

      <div
        role="note"
        className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:text-amber-200"
      >
        <p className="font-semibold">{dict.terms.draftBannerTitle}</p>
        <p className="mt-1">{dict.terms.draftBannerBody}</p>
      </div>

      <p className="mt-8 text-base leading-7 text-zinc-700 dark:text-zinc-200">
        {dict.terms.intro}
      </p>

      <section aria-labelledby="use-heading" className="mt-10">
        <h2 id="use-heading" className="text-2xl font-semibold tracking-tight">
          {dict.terms.useHeading}
        </h2>
        <ul className="mt-4 flex flex-col gap-3 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.terms.useItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="accounts-heading" className="mt-10">
        <h2 id="accounts-heading" className="text-2xl font-semibold tracking-tight">
          {dict.terms.accountsHeading}
        </h2>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.terms.accountsBody}
        </p>
      </section>

      <section aria-labelledby="content-heading" className="mt-10">
        <h2 id="content-heading" className="text-2xl font-semibold tracking-tight">
          {dict.terms.contentHeading}
        </h2>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.terms.contentBody}
        </p>
      </section>

      <section aria-labelledby="payments-heading" className="mt-10">
        <h2 id="payments-heading" className="text-2xl font-semibold tracking-tight">
          {dict.terms.paymentsHeading}
        </h2>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.terms.paymentsBody}
        </p>
      </section>

      <section aria-labelledby="changes-heading" className="mt-10">
        <h2 id="changes-heading" className="text-2xl font-semibold tracking-tight">
          {dict.terms.changesHeading}
        </h2>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.terms.changesBody}
        </p>
        <Link
          href={`/${lang}/support/new`}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.terms.contactCta}
        </Link>
      </section>

      <p className="mt-12 text-sm text-zinc-500 dark:text-zinc-400">
        {dict.terms.lastUpdated}
      </p>
    </main>
  );
}
