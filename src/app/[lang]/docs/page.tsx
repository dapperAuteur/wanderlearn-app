import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "../dictionaries";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/docs">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const path = `/${lang}/docs`;
  return {
    title: dict.docs.indexTitle,
    description: dict.docs.indexSubtitle,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates("/docs", locales),
    },
    openGraph: {
      type: "website",
      siteName,
      title: dict.docs.indexTitle,
      description: dict.docs.indexSubtitle,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
  };
}

export default async function DocsIndexPage({
  params,
}: PageProps<"/[lang]/docs">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const guides = [
    {
      id: "creator" as const,
      title: dict.docs.creatorTitle,
      blurb: dict.docs.creatorBlurb,
    },
    {
      id: "admin" as const,
      title: dict.docs.adminTitle,
      blurb: dict.docs.adminBlurb,
    },
    {
      id: "embed-tours" as const,
      title: dict.docs.embedToursTitle,
      blurb: dict.docs.embedToursBlurb,
    },
  ];

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
        {dict.docs.eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        {dict.docs.indexTitle}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-200">
        {dict.docs.indexSubtitle}
      </p>

      <ul className="mt-10 flex flex-col gap-4">
        {guides.map((g) => (
          <li key={g.id}>
            <Link
              href={`/${lang}/docs/${g.id}`}
              className="flex flex-col gap-2 rounded-lg border border-black/10 p-5 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:bg-white/5"
            >
              <span className="text-lg font-semibold">{g.title} →</span>
              <span className="text-base leading-7 text-zinc-700 dark:text-zinc-200">
                {g.blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
        {dict.docs.disclaimer}
      </p>
    </main>
  );
}
