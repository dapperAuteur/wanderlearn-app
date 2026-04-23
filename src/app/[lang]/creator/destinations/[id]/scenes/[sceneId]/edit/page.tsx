import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { and, eq, ne } from "drizzle-orm";
import { getDestinationById } from "@/db/queries/destinations";
import { getSceneById, listPanoramasForOwner } from "@/db/queries/scenes";
import { listHotspotsForScene, listLinksFromScene } from "@/db/queries/hotspots";
import { imageUrl, posterUrlFor, video360PanoramaUrl } from "@/lib/cloudinary";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { PanoramaPicker, type PanoramaOption } from "@/components/media/panorama-picker";
import { deleteScene } from "@/lib/actions/scenes";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { getDictionary } from "../../../../../../dictionaries";
import { DeleteSceneButton } from "../delete-button";
import { SceneEditForm } from "./scene-edit-form";
import {
  HotspotsEditor,
  type HotspotForEditor,
  type LinkTargetOption,
  type SceneLinkForEditor,
} from "./hotspots-editor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/scenes/[sceneId]/edit">): Promise<Metadata> {
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

export default async function EditScenePage({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/scenes/[sceneId]/edit">) {
  const { lang, id, sceneId } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const [destination, scene] = await Promise.all([
    getDestinationById(id),
    getSceneById(sceneId),
  ]);
  if (!destination || !scene || scene.destinationId !== destination.id) notFound();
  const [dict, panoramaRows, hotspotRows, linkRows, otherScenes, panoramaMedia] = await Promise.all([
    getDictionary(lang),
    listPanoramasForOwner(user.id),
    listHotspotsForScene(scene.id),
    listLinksFromScene(scene.id),
    db
      .select({
        id: schema.scenes.id,
        name: schema.scenes.name,
      })
      .from(schema.scenes)
      .where(
        and(
          eq(schema.scenes.destinationId, destination.id),
          ne(schema.scenes.id, scene.id),
        ),
      ),
    db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        publicId: schema.mediaAssets.cloudinaryPublicId,
        secureUrl: schema.mediaAssets.cloudinarySecureUrl,
      })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, scene.panoramaMediaId))
      .limit(1),
  ]);

  const panoramaOptions: PanoramaOption[] = panoramaRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    thumbnailUrl: row.cloudinaryPublicId
      ? posterUrlFor(row.kind, row.cloudinaryPublicId, 480)
      : row.cloudinarySecureUrl,
  }));

  const sceneNameById = new Map<string, string>();
  for (const s of otherScenes) sceneNameById.set(s.id, s.name);

  const hotspotsForEditor: HotspotForEditor[] = hotspotRows.map((h) => ({
    id: h.id,
    title: h.title,
    contentHtml: h.contentHtml,
    externalUrl: h.externalUrl,
    yaw: h.yaw,
    pitch: h.pitch,
  }));

  const linksForEditor: SceneLinkForEditor[] = linkRows.map((l) => ({
    id: l.id,
    toSceneId: l.toSceneId,
    toSceneName: sceneNameById.get(l.toSceneId) ?? l.toSceneId.slice(0, 8),
    name: l.name,
    yaw: l.yaw,
    pitch: l.pitch,
  }));

  const linkTargets: LinkTargetOption[] = otherScenes.map((s) => ({ id: s.id, name: s.name }));

  const panoramaRow = panoramaMedia[0] ?? null;
  const isVideo = panoramaRow?.kind === "video_360";
  // Video_360: prefer the stored secureUrl; Cloudinary's f_mp4 transform
  // 400s on edited/shortened exports. Browser plays the unmodified MP4
  // directly. Falls back to transform if secureUrl is absent.
  const panoramaUrl = isVideo
    ? panoramaRow?.secureUrl ??
      (panoramaRow?.publicId ? video360PanoramaUrl(panoramaRow.publicId) : null)
    : panoramaRow?.publicId
      ? imageUrl(panoramaRow.publicId, { format: "auto", quality: "auto" })
      : panoramaRow?.secureUrl ?? null;

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
          },
        ],
      }
    : null;

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
        <Link
          href={`/${lang}/creator/destinations/${destination.id}/scenes/${scene.id}`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {scene.name}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">
        {dict.creator.scenes.editHeading}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.scenes.editSubtitle}
      </p>

      <SceneEditForm
        sceneId={scene.id}
        destinationId={destination.id}
        lang={lang}
        initial={{ name: scene.name, caption: scene.caption }}
        dict={dict.creator.scenes.editForm}
      />

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
        aria-labelledby="hotspots-heading"
        className="mt-12 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h2 id="hotspots-heading" className="text-lg font-semibold">
          {dict.creator.scenes.hotspotsSectionHeading}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.creator.scenes.hotspotsSectionIntro}
        </p>
        <div className="mt-6">
          <HotspotsEditor
            sceneId={scene.id}
            destinationId={destination.id}
            lang={lang}
            tour={tour}
            hotspots={hotspotsForEditor}
            links={linksForEditor}
            linkTargets={linkTargets}
            initialStartYaw={scene.startYaw}
            initialStartPitch={scene.startPitch}
            dict={dict.creator.scenes.hotspotsEditor}
          />
        </div>
      </section>

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
