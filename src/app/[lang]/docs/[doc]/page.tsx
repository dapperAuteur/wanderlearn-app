import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { renderDocHtml, type DocId } from "@/lib/docs-markdown";
import { getDictionary } from "../../dictionaries";

export const dynamic = "force-static";

const VALID: DocId[] = ["creator", "admin"];

function isValidDoc(value: string): value is DocId {
  return (VALID as string[]).includes(value);
}

export async function generateStaticParams() {
  const out: { lang: string; doc: DocId }[] = [];
  for (const lang of locales) {
    for (const doc of VALID) out.push({ lang, doc });
  }
  return out;
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/docs/[doc]">): Promise<Metadata> {
  const { lang, doc } = await params;
  if (!hasLocale(lang) || !isValidDoc(doc)) return {};
  const dict = await getDictionary(lang);
  const title = doc === "creator" ? dict.docs.creatorTitle : dict.docs.adminTitle;
  const description =
    doc === "creator" ? dict.docs.creatorBlurb : dict.docs.adminBlurb;
  const path = `/${lang}/docs/${doc}`;
  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates(`/docs/${doc}`, locales),
    },
    openGraph: {
      type: "article",
      siteName,
      title,
      description,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
  };
}

export default async function DocPage({
  params,
}: PageProps<"/[lang]/docs/[doc]">) {
  const { lang, doc } = await params;
  if (!hasLocale(lang) || !isValidDoc(doc)) notFound();
  const dict = await getDictionary(lang);
  const html = await renderDocHtml(doc, lang);
  const title = doc === "creator" ? dict.docs.creatorTitle : dict.docs.adminTitle;
  const englishOnly = lang !== "en";

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
    >
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/docs`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.docs.eyebrow}
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

      <article
        className="prose prose-zinc max-w-none dark:prose-invert prose-a:underline prose-table:text-sm"
        aria-label={title}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
