import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl } from "@/lib/site";
import { HELP_ARTICLES, helpArticleBySlug } from "@/lib/help-articles";
import { getDictionary } from "../../dictionaries";

// Deliberately NOT `force-static`. These pages render the shared AppHeader, which
// calls getSession(). Under force-static, headers() is empty at build time, so the
// signed-out header (with a "Sign in" button and no account link) was baked into the
// prerendered HTML and served to signed-in users. The page body is static, but the
// chrome is not, and Next has no way to split them here without PPR.

export async function generateStaticParams() {
  const out: { lang: string; slug: string }[] = [];
  for (const lang of locales) {
    for (const article of HELP_ARTICLES) {
      out.push({ lang, slug: article.slug });
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/help/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const article = helpArticleBySlug(slug);
  if (!article) return {};
  return {
    title: `${article.shortTitle} — ${article.title}`,
    description: article.summary,
    alternates: { canonical: absoluteUrl(`/${lang}/help/${slug}`) },
    robots: { index: false, follow: false },
  };
}

export default async function HelpArticlePage({
  params,
}: PageProps<"/[lang]/help/[slug]">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const article = helpArticleBySlug(slug);
  if (!article) notFound();
  const dict = await getDictionary(lang);
  const englishOnly = lang !== "en";

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
    >
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/help`}
          className="inline-flex min-h-11 items-center text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.help.backToIndex}
        </Link>
      </nav>

      {englishOnly ? (
        <div
          role="note"
          className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:text-amber-200"
        >
          {dict.docs.englishOnlyNotice}
        </div>
      ) : null}

      <article aria-label={article.title}>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {article.shortTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-lg font-medium text-zinc-700 dark:text-zinc-200">
          {article.title}
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          {article.summary}
        </p>

        {/* Video first, steps second. On a phone the 8-step list pushed the
            walkthrough below the fold, so nobody learned a video existed. */}
        <h2 className="mt-10 text-2xl font-semibold tracking-tight">
          {dict.help.videoHeading}
        </h2>
        {article.youtubeId ? (
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${article.youtubeId}`}
              title={dict.help.videoIframeTitle.replace("{title}", article.title)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : (
          <div
            role="note"
            className="mt-4 flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-black/20 bg-black/5 p-6 text-center text-base text-zinc-600 dark:border-white/25 dark:bg-white/5 dark:text-zinc-400"
          >
            {dict.help.videoComingSoon}
          </div>
        )}

        {/* The narration doubles as the video's transcript once youtubeId is
            set (WCAG 2.1 AA wants one), and before that it is the script BAM
            reads while screen-recording. Closed by default either way. */}
        <details className="group mt-4 rounded-lg border border-black/10 dark:border-white/15">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-lg px-4 py-2 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/5">
            {dict.help.scriptHeading}
          </summary>
          <div className="border-t border-black/10 px-4 py-3 dark:border-white/15">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {article.youtubeId ? dict.help.scriptNoteRecorded : dict.help.scriptNotePending}
            </p>
            <p className="mt-3 text-base leading-7 text-zinc-700 dark:text-zinc-200">
              {article.videoScript}
            </p>
          </div>
        </details>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">
          {dict.help.stepsHeading}
        </h2>
        <ol className="mt-4 flex list-decimal flex-col gap-3 pl-6 text-base leading-7 text-zinc-700 marker:font-semibold dark:text-zinc-200">
          {article.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </article>
    </main>
  );
}
