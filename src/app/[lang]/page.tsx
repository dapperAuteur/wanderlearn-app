import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "./dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const canonicalPath = `/${lang}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: absoluteUrl(canonicalPath),
    description: dict.meta.description,
    logo: absoluteUrl("/opengraph-image"),
    sameAs: [] as string[],
  };
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
      languages: localizedAlternates("", locales),
    },
    openGraph: {
      type: "website",
      siteName,
      title: dict.meta.title,
      description: dict.landing.subhead,
      url: absoluteUrl(canonicalPath),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.landing.subhead,
    },
    other: {
      "application/ld+json": JSON.stringify(structuredData),
    },
  };
}

export default async function LandingPage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      <section aria-labelledby="hero-heading" className="pt-12 pb-20 sm:pt-16 sm:pb-28">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
          {dict.landing.eyebrow}
        </p>
        <h1
          id="hero-heading"
          className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
        >
          {dict.landing.headline}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          {dict.landing.subhead}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${lang}/courses`}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.landing.primaryCta}
          </Link>
          <Link
            href={`/${lang}/how-it-works`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.landing.secondaryCta}
          </Link>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="border-t border-black/5 pt-16 dark:border-white/10">
        <h2 id="features-heading" className="sr-only">
          {dict.landing.eyebrow}
        </h2>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <h3 className="text-lg font-semibold">{dict.landing.featureImmersiveTitle}</h3>
            <p className="mt-2 text-base leading-7 text-zinc-600 dark:text-zinc-300">
              {dict.landing.featureImmersiveBody}
            </p>
          </li>
          <li>
            <h3 className="text-lg font-semibold">{dict.landing.featureCreatorTitle}</h3>
            <p className="mt-2 text-base leading-7 text-zinc-600 dark:text-zinc-300">
              {dict.landing.featureCreatorBody}
            </p>
          </li>
          <li>
            <h3 className="text-lg font-semibold">{dict.landing.featureLearnerTitle}</h3>
            <p className="mt-2 text-base leading-7 text-zinc-600 dark:text-zinc-300">
              {dict.landing.featureLearnerBody}
            </p>
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="flagship-heading"
        className="mt-20 rounded-2xl border border-black/5 bg-black/2 p-6 sm:p-10 dark:border-white/10 dark:bg-white/2"
      >
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
          {dict.landing.flagshipTitle}
        </p>
        <h2 id="flagship-heading" className="mt-3 text-2xl font-semibold sm:text-3xl">
          {dict.landing.flagshipName}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
          {dict.landing.flagshipDescription}
        </p>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {dict.landing.flagshipLocation}
        </p>
      </section>
    </main>
  );
}
