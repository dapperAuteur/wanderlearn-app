import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { getDestinationById } from "@/db/queries/destinations";
import { getSceneById } from "@/db/queries/scenes";
import { listHotspotsForScene, listLinksFromScene } from "@/db/queries/hotspots";
import { imageUrl, videoHlsUrl } from "@/lib/cloudinary";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { getDictionary } from "../../../../../dictionaries";

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
  await requireCreator(lang);
  const [destination, scene] = await Promise.all([
    getDestinationById(id),
    getSceneById(sceneId),
  ]);
  if (!destination || !scene || scene.destinationId !== destination.id) notFound();
  const [dict, hotspotRows, linkRows] = await Promise.all([
    getDictionary(lang),
    listHotspotsForScene(scene.id),
    listLinksFromScene(scene.id),
  ]);
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

  const isVideo = panoramaRow?.kind === "video_360";
  const panoramaUrl = panoramaRow?.cloudinaryPublicId
    ? isVideo
      ? videoHlsUrl(panoramaRow.cloudinaryPublicId)
      : imageUrl(panoramaRow.cloudinaryPublicId, { format: "auto", quality: "auto" })
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
            type: isVideo ? "video" : "photo",
            hotspots: hotspotRows.map((h) => ({
              id: h.id,
              position: { yaw: h.yaw, pitch: h.pitch },
              title: h.title,
              content: h.contentHtml ?? undefined,
              externalUrl: h.externalUrl ?? undefined,
            })),
            links: linkRows.map((link) => ({
              nodeId: link.toSceneId,
              name: link.name ?? undefined,
              position:
                link.yaw !== null && link.pitch !== null
                  ? { yaw: link.yaw, pitch: link.pitch }
                  : undefined,
            })),
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
      ) : savedFlag === "1" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.scenes.savedBanner}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{scene.name}</h1>
          {scene.caption ? (
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">{scene.caption}</p>
          ) : null}
        </div>
        <Link
          href={`/${lang}/creator/destinations/${destination.id}/scenes/${scene.id}/edit`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.creator.scenes.editCta}
        </Link>
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
    </main>
  );
}
