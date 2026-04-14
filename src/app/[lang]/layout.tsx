import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, locales, type Locale } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "./dictionaries";
import { LangAttribute } from "./lang-attribute";

export const dynamicParams = false;

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const canonicalPath = `/${lang}`;
  return {
    title: {
      default: dict.meta.title,
      template: `%s · ${siteName}`,
    },
    description: dict.meta.description,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
      languages: localizedAlternates("", locales),
    },
    openGraph: {
      type: "website",
      siteName,
      title: dict.meta.title,
      description: dict.meta.description,
      url: absoluteUrl(canonicalPath),
      locale: lang === "es" ? "es_MX" : "en_US",
      alternateLocale: locales.filter((l) => l !== lang).map((l) => (l === "es" ? "es_MX" : "en_US")),
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
    },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <>
      <LangAttribute lang={lang as Locale} />
      {children}
    </>
  );
}
