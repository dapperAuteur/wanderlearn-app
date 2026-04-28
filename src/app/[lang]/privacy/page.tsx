import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "../dictionaries";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const path = `/${lang}/privacy`;
  return {
    title: dict.privacy.metaTitle,
    description: dict.privacy.metaDescription,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates("/privacy", locales),
    },
    openGraph: {
      type: "article",
      siteName,
      title: dict.privacy.metaTitle,
      description: dict.privacy.metaDescription,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
  };
}

export default async function PrivacyPage({
  params,
}: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
        {dict.privacy.eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        {dict.privacy.headline}
      </h1>

      <div
        role="note"
        className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:text-amber-200"
      >
        <p className="font-semibold">{dict.privacy.draftBannerTitle}</p>
        <p className="mt-1">{dict.privacy.draftBannerBody}</p>
      </div>

      <p className="mt-8 text-base leading-7 text-zinc-700 dark:text-zinc-200">
        {dict.privacy.intro}
      </p>

      <section aria-labelledby="data-heading" className="mt-10">
        <h2 id="data-heading" className="text-2xl font-semibold tracking-tight">
          {dict.privacy.dataHeading}
        </h2>
        <ul className="mt-4 flex flex-col gap-4">
          {dict.privacy.dataItems.map((item, i) => (
            <li key={i}>
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-1 text-base leading-7 text-zinc-700 dark:text-zinc-200">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="vendors-heading" className="mt-10">
        <h2 id="vendors-heading" className="text-2xl font-semibold tracking-tight">
          {dict.privacy.vendorsHeading}
        </h2>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.privacy.vendorsIntro}
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.privacy.vendors.map((v, i) => (
            <li key={i}>
              <span className="font-semibold">{v.name}</span>: {v.role}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rights-heading" className="mt-10">
        <h2 id="rights-heading" className="text-2xl font-semibold tracking-tight">
          {dict.privacy.rightsHeading}
        </h2>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.privacy.rightsBody}
        </p>
        <Link
          href={`/${lang}/support/new`}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.privacy.contactCta}
        </Link>
      </section>

      <p className="mt-12 text-sm text-zinc-500 dark:text-zinc-400">
        {dict.privacy.lastUpdated}
      </p>
    </main>
  );
}
