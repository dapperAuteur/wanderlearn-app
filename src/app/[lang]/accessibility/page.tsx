import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "../dictionaries";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/accessibility">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const path = `/${lang}/accessibility`;
  return {
    title: dict.accessibility.metaTitle,
    description: dict.accessibility.metaDescription,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates("/accessibility", locales),
    },
    openGraph: {
      type: "article",
      siteName,
      title: dict.accessibility.metaTitle,
      description: dict.accessibility.metaDescription,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
  };
}

export default async function AccessibilityPage({
  params,
}: PageProps<"/[lang]/accessibility">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
    >
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
        {dict.accessibility.eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        {dict.accessibility.headline}
      </h1>
      <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-200">
        {dict.accessibility.intro}
      </p>

      <section aria-labelledby="commitments" className="mt-12">
        <h2 id="commitments" className="text-2xl font-semibold tracking-tight">
          {dict.accessibility.commitmentsHeading}
        </h2>
        <ul className="mt-6 flex flex-col gap-6">
          {dict.accessibility.commitments.map((c, i) => (
            <li key={i}>
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-base leading-7 text-zinc-700 dark:text-zinc-200">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="known-gaps"
        className="mt-12 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 dark:border-amber-400/30"
      >
        <h2 id="known-gaps" className="text-lg font-semibold">
          {dict.accessibility.gapsHeading}
        </h2>
        <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">
          {dict.accessibility.gapsBody}
        </p>
      </section>

      <section aria-labelledby="report" className="mt-12">
        <h2 id="report" className="text-2xl font-semibold tracking-tight">
          {dict.accessibility.reportHeading}
        </h2>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.accessibility.reportBody}
        </p>
        <Link
          href={`/${lang}/support/new`}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.accessibility.reportCta}
        </Link>
      </section>

      <p className="mt-12 text-sm text-zinc-500 dark:text-zinc-400">
        {dict.accessibility.lastUpdated}
      </p>
    </main>
  );
}
