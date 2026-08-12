import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import {
  getDestinationById,
  listLinkableDestinationsForCreator,
} from "@/db/queries/destinations";
import { listHeroMediaForOwner, listIconCandidatesForOwner } from "@/db/queries/scenes";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import {
  deleteDestination,
  replaceDestinationProfileMedia,
  updateDestination,
} from "@/lib/actions/destinations";
import { imageUrl, posterUrlFor } from "@/lib/cloudinary";
import { tourTypeOptions } from "@/lib/tour-types";
import { getDictionary } from "../../../../dictionaries";
import { DestinationForm } from "../../destination-form";
import { DeleteDestinationButton } from "../delete-button";
import { ExternalLinkingControls } from "../external-linking-controls";
import { HeroMediaPicker, type HeroOption } from "@/components/media/hero-media-picker";
import { PinIconPicker, type PinIconOption } from "@/components/media/pin-icon-picker";
import {
  ProfileMediaPicker,
  type ProfileMediaOption,
} from "@/components/media/profile-media-picker";
import { TourArrowPicker, type TourArrowOption } from "@/components/media/tour-arrow-picker";

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
  const [dict, heroMedia, iconMedia, linkableDestinations, userRow] = await Promise.all([
    getDictionary(lang),
    listHeroMediaForOwner(user.id),
    listIconCandidatesForOwner(user.id),
    listLinkableDestinationsForCreator({
      creatorId: user.id,
      excludeDestinationId: destination.id,
    }),
    db
      .select({ allowExternalLinkingDefault: schema.users.allowExternalLinkingDefault })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const heroOptions: HeroOption[] = heroMedia.map((row) => ({
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    thumbnailUrl: row.cloudinaryPublicId
      ? posterUrlFor(row.kind, row.cloudinaryPublicId, 480)
      : row.cloudinarySecureUrl,
  }));

  const pinIconOptions: PinIconOption[] = iconMedia.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    thumbnailUrl: row.cloudinaryPublicId
      ? imageUrl(row.cloudinaryPublicId, { width: 128 })
      : row.cloudinarySecureUrl,
  }));

  // Profile (narrow-card thumbnail) candidate set: same eligibility as
  // hero — creator-owned image / photo_360 in ready state.
  const profileOptions: ProfileMediaOption[] = heroMedia.map((row) => ({
    id: row.id,
    kind: row.kind as "image" | "photo_360",
    displayName: row.displayName,
    thumbnailUrl: row.cloudinaryPublicId
      ? posterUrlFor(row.kind, row.cloudinaryPublicId, 320)
      : row.cloudinarySecureUrl,
  }));

  // Same eligibility set as the pin-icon picker: creator-owned, ready,
  // not-deleted flat images. A drone arrow PNG and a pin icon often
  // come from the same library; no reason to filter them apart here.
  const tourArrowOptions: TourArrowOption[] = iconMedia.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    thumbnailUrl: row.cloudinaryPublicId
      ? imageUrl(row.cloudinaryPublicId, { width: 128 })
      : row.cloudinarySecureUrl,
  }));

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
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
          youtubeUrl: destination.youtubeUrl,
          tourArrowColor: destination.tourArrowColor,
          tourPinColor: destination.tourPinColor,
          tourType: destination.tourType,
          sceneLinkIconSize: destination.sceneLinkIconSize,
          hotspotIconSize: destination.hotspotIconSize,
        }}
        action={updateDestination}
        tourTypeOptions={tourTypeOptions(dict.tourTypes)}
      />

      <div className="mt-12 rounded-lg border border-black/10 p-6 dark:border-white/15">
        <HeroMediaPicker
          destinationId={destination.id}
          lang={lang}
          currentHeroId={destination.heroMediaId}
          options={heroOptions}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.destinations.heroPicker}
          chromeDict={dict.creator.mediaPicker}
        />
      </div>

      <div className="mt-6 rounded-lg border border-black/10 p-6 dark:border-white/15">
        <ProfileMediaPicker
          parentId={destination.id}
          lang={lang}
          currentProfileMediaId={destination.profileMediaId}
          options={profileOptions}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.destinations.profilePicker}
          chromeDict={dict.creator.mediaPicker}
          action={replaceDestinationProfileMedia}
        />
      </div>

      <div className="mt-6 rounded-lg border border-black/10 p-6 dark:border-white/15">
        <PinIconPicker
          destinationId={destination.id}
          lang={lang}
          currentPinIconId={destination.pinIconMediaId}
          options={pinIconOptions}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.destinations.pinIconPicker}
          chromeDict={dict.creator.mediaPicker}
        />
      </div>

      <div className="mt-6 rounded-lg border border-black/10 p-6 dark:border-white/15">
        <TourArrowPicker
          destinationId={destination.id}
          lang={lang}
          currentTourArrowId={destination.tourArrowMediaId}
          options={tourArrowOptions}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.destinations.tourArrowPicker}
          chromeDict={dict.creator.mediaPicker}
        />
      </div>

      <div className="mt-6">
        <ExternalLinkingControls
          destinationId={destination.id}
          lang={lang}
          accountDefaultOn={userRow?.allowExternalLinkingDefault ?? false}
          initialOverride={destination.allowExternalLinkingOverride}
          initialNextDestinationId={destination.nextDestinationId}
          linkableOptions={linkableDestinations}
          dict={dict.creator.destinations.externalLinkingControls}
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
