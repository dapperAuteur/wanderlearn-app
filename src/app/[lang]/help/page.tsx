import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/locales";
import { absoluteUrl } from "@/lib/site";
import { HELP_ARTICLES, helpSearchText } from "@/lib/help-articles";
import { getDictionary } from "../dictionaries";
import { HelpSearch, type HelpSearchEntry } from "./help-search";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/help">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.help.title,
    description: dict.help.subtitle,
    alternates: { canonical: absoluteUrl(`/${lang}/help`) },
    robots: { index: false, follow: false },
  };
}

export default async function HelpIndexPage({
  params,
}: PageProps<"/[lang]/help">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const entries: HelpSearchEntry[] = HELP_ARTICLES.map((article) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    audience: article.audience,
    haystack: helpSearchText(article),
  }));

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
    >
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
        {dict.help.eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        {dict.help.title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-200">
        {dict.help.subtitle}
      </p>

      <div className="mt-10">
        <HelpSearch
          lang={lang}
          entries={entries}
          labels={{
            searchLabel: dict.help.searchLabel,
            searchPlaceholder: dict.help.searchPlaceholder,
            resultCountOne: dict.help.resultCountOne,
            resultCountMany: dict.help.resultCountMany,
            noResults: dict.help.noResults,
            audienceLabels: {
              creator: dict.help.audienceCreator,
              partner: dict.help.audiencePartner,
              learner: dict.help.audienceLearner,
            },
          }}
        />
      </div>
    </main>
  );
}
