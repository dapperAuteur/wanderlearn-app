import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { getDestinationById } from "@/db/queries/destinations";
import { getSceneById, listPhoto360ForOwner } from "@/db/queries/scenes";
import { imageUrl, posterUrlFor } from "@/lib/cloudinary";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { deleteScene } from "@/lib/actions/scenes";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { PanoramaPicker, type PanoramaOption } from "@/components/media/panorama-picker";
import { getDictionary } from "../../../../../dictionaries";
import { DeleteSceneButton } from "./delete-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/scenes/[sceneId]">): Promise<Metadata> {
  const { lang, sceneId } = await params;
  if (!hasLocale(lang)) return {};
  const scene = await getSceneById(sceneId);
  if (!scene) return { title: "Scene not found" };
  return {
    title: scene.name,
    description: scene.caption ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function ViewScenePage({
  params,
  searchParams,
}: PageProps<"/[lang]/creator/destinations/[id]/scenes/[sceneId]">) {
  const { lang, id, sceneId } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const [destination, scene] = await Promise.all([
    getDestinationById(id),
    getSceneById(sceneId),
  ]);
  if (!destination || !scene || scene.destinationId !== destination.id) notFound();
  const [dict, panoramaOptionRows] = await Promise.all([
    getDictionary(lang),
    listPhoto360ForOwner(user.id),
  ]);

  const panoramaOptions: PanoramaOption[] = panoramaOptionRows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    thumbnailUrl: row.cloudinaryPublicId
      ? posterUrlFor("photo_360", row.cloudinaryPublicId, 480)
      : row.cloudinarySecureUrl,
  }));
  const query = await searchParams;
  const savedFlag = typeof query?.saved === "string" ? query.saved : null;

  const [panoramaRow] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, scene.panoramaMediaId))
    .limit(1);

  const panoramaUrl = panoramaRow?.cloudinaryPublicId
    ? imageUrl(panoramaRow.cloudinaryPublicId, { format: "auto", quality: "auto" })
    : panoramaRow?.cloudinarySecureUrl ?? null;

  const tour: VirtualTourType | null = panoramaUrl
    ? {
        slug: scene.id,
        title: scene.name,
        description: scene.caption ?? undefined,
        startSceneId: scene.id,
        scenes: [
          {
            id: scene.id,
            name: scene.name,
            caption: scene.caption ?? undefined,
            panorama: panoramaUrl,
            type: "photo",
          },
        ],
      }
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
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

      {savedFlag === "created" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.scenes.createdBanner}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{scene.name}</h1>
          {scene.caption ? (
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">{scene.caption}</p>
          ) : null}
        </div>
      </div>

      {tour ? (
        <div className="mt-8 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
          <VirtualTour tour={tour} height="60vh" />
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-6 text-sm text-amber-800 dark:text-amber-300">
          {dict.creator.scenes.panoramaMissing}
        </div>
      )}

      <div className="mt-12 rounded-lg border border-black/10 p-6 dark:border-white/15">
        <PanoramaPicker
          sceneId={scene.id}
          destinationId={destination.id}
          lang={lang}
          currentPanoramaId={scene.panoramaMediaId}
          options={panoramaOptions}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.scenes.panoramaPicker}
        />
      </div>

      <section
        aria-labelledby="danger-zone"
        className="mt-12 rounded-lg border border-red-500/30 p-6 dark:border-red-500/40"
      >
        <h2 id="danger-zone" className="text-lg font-semibold text-red-700 dark:text-red-400">
          {dict.creator.scenes.dangerZone}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.creator.scenes.deleteWarning}
        </p>
        <DeleteSceneButton
          id={scene.id}
          name={scene.name}
          destinationId={destination.id}
          lang={lang}
          dict={dict.creator.scenes.deleteButton}
          action={deleteScene}
        />
      </section>
    </main>
  );
}
