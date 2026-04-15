import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { createDestination } from "@/lib/actions/destinations";
import { getDictionary } from "../../../dictionaries";
import { DestinationForm } from "../destination-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.destinations.newTitle,
    description: dict.creator.destinations.newSubtitle,
    robots: { index: false, follow: false },
  };
}

export default async function NewDestinationPage({
  params,
}: PageProps<"/[lang]/creator/destinations/new">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireCreator(lang);
  const dict = await getDictionary(lang);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {dict.creator.destinations.newTitle}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.destinations.newSubtitle}
      </p>
      <DestinationForm dict={dict.creator.destinations.form} lang={lang} action={createDestination} />
    </main>
  );
}
