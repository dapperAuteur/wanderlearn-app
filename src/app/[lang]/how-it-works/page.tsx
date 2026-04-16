import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "../dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/how-it-works">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const path = `/${lang}/how-it-works`;
  return {
    title: dict.howItWorks.metaTitle,
    description: dict.howItWorks.metaDescription,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates("/how-it-works", locales),
    },
    openGraph: {
      type: "website",
      siteName,
      title: dict.howItWorks.metaTitle,
      description: dict.howItWorks.metaDescription,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: dict.howItWorks.metaTitle,
      description: dict.howItWorks.metaDescription,
    },
  };
}

export default async function HowItWorksPage({ params }: PageProps<"/[lang]/how-it-works">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main id="main" className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-mono uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {dict.howItWorks.eyebrow}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {dict.howItWorks.headline}
        </h1>
        <p className="max-w-2xl text-lg text-zinc-700 dark:text-zinc-200">
          {dict.howItWorks.subhead}
        </p>
      </header>

      <section aria-labelledby="for-learners" className="mt-14">
        <h2 id="for-learners" className="text-2xl font-semibold tracking-tight">
          {dict.howItWorks.learnersHeading}
        </h2>
        <ol className="mt-6 flex flex-col gap-4">
          {dict.howItWorks.learnerSteps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-lg border border-black/10 p-5 dark:border-white/15"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
              </div>
              <p className="mt-2 text-base leading-7 text-zinc-700 dark:text-zinc-200">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="for-creators" className="mt-14">
        <h2 id="for-creators" className="text-2xl font-semibold tracking-tight">
          {dict.howItWorks.creatorsHeading}
        </h2>
        <ol className="mt-6 flex flex-col gap-4">
          {dict.howItWorks.creatorSteps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-lg border border-black/10 p-5 dark:border-white/15"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
              </div>
              <p className="mt-2 text-base leading-7 text-zinc-700 dark:text-zinc-200">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="commitments" className="mt-14">
        <h2 id="commitments" className="text-2xl font-semibold tracking-tight">
          {dict.howItWorks.commitmentsHeading}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {dict.howItWorks.commitments.map((item) => (
            <li
              key={item.title}
              className="rounded-lg border border-black/10 p-5 dark:border-white/15"
            >
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="partners" className="mt-14">
        <h2 id="partners" className="text-2xl font-semibold tracking-tight">
          {dict.howItWorks.partnersHeading}
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {dict.howItWorks.partnersBody}
        </p>
      </section>

      <section className="mt-16 flex flex-col gap-4 rounded-lg border border-black/10 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-white/15">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{dict.howItWorks.ctaHeading}</h2>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
            {dict.howItWorks.ctaBody}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${lang}/courses`}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.howItWorks.browseCoursesCta}
          </Link>
          <Link
            href={`/${lang}/sign-up`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.howItWorks.signUpCta}
          </Link>
        </div>
      </section>
    </main>
  );
}
