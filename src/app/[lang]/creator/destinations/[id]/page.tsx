import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { deleteDestination, updateDestination } from "@/lib/actions/destinations";
import { getDictionary } from "../../../dictionaries";
import { DestinationForm } from "../destination-form";
import { DeleteDestinationButton } from "./delete-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!hasLocale(lang)) return {};
  const destination = await getDestinationById(id);
  if (!destination) return { title: "Destination not found" };
  return {
    title: destination.name,
    description: destination.description ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function EditDestinationPage({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  await requireCreator(lang);
  const destination = await getDestinationById(id);
  if (!destination) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/creator/destinations`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.creator.destinations.title}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">{destination.name}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.destinations.editSubtitle}
      </p>
      <DestinationForm
        dict={dict.creator.destinations.form}
        lang={lang}
        initial={{
          id: destination.id,
          name: destination.name,
          slug: destination.slug,
          country: destination.country,
          city: destination.city,
          lat: destination.lat,
          lng: destination.lng,
          description: destination.description,
        }}
        action={updateDestination}
      />

      <section
        aria-labelledby="danger-zone"
        className="mt-12 rounded-lg border border-red-500/30 p-6 dark:border-red-500/40"
      >
        <h2 id="danger-zone" className="text-lg font-semibold text-red-700 dark:text-red-400">
          {dict.creator.destinations.dangerZone}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.creator.destinations.deleteWarning}
        </p>
        <DeleteDestinationButton
          id={destination.id}
          name={destination.name}
          lang={lang}
          dict={dict.creator.destinations.deleteButton}
          action={deleteDestination}
        />
      </section>
    </main>
  );
}
