import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import { listHeroMediaForOwner } from "@/db/queries/scenes";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { deleteDestination, updateDestination } from "@/lib/actions/destinations";
import { posterUrlFor } from "@/lib/cloudinary";
import { getDictionary } from "../../../../dictionaries";
import { DestinationForm } from "../../destination-form";
import { DeleteDestinationButton } from "../delete-button";
import { HeroMediaPicker, type HeroOption } from "@/components/media/hero-media-picker";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/edit">): Promise<Metadata> {
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
}: PageProps<"/[lang]/creator/destinations/[id]/edit">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const destination = await getDestinationById(id);
  if (!destination) notFound();
  const [dict, heroMedia] = await Promise.all([
    getDictionary(lang),
    listHeroMediaForOwner(user.id),
  ]);

  const heroOptions: HeroOption[] = heroMedia.map((row) => ({
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    thumbnailUrl: row.cloudinaryPublicId
      ? posterUrlFor(row.kind, row.cloudinaryPublicId, 480)
      : row.cloudinarySecureUrl,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-col gap-1 text-sm">
        <Link
          href={`/${lang}/creator/destinations`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.creator.destinations.title}
        </Link>
        <Link
          href={`/${lang}/creator/destinations/${destination.id}`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {destination.name}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">
        {dict.creator.destinations.editHeading}
      </h1>
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
          website: destination.website,
          tourArrowColor: destination.tourArrowColor,
          tourPinColor: destination.tourPinColor,
        }}
        action={updateDestination}
      />

      <div className="mt-12 rounded-lg border border-black/10 p-6 dark:border-white/15">
        <HeroMediaPicker
          destinationId={destination.id}
          lang={lang}
          currentHeroId={destination.heroMediaId}
          options={heroOptions}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.destinations.heroPicker}
        />
      </div>

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
