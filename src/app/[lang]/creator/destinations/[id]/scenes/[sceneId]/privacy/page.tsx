import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getDestinationById } from "@/db/queries/destinations";
import { getSceneById } from "@/db/queries/scenes";
import { imageUrl, video360PanoramaUrl } from "@/lib/cloudinary";
import { hasLocale } from "@/lib/locales";
import { isAiEdited } from "@/lib/assemble-tour";
import { parseStoredRecipe } from "@/lib/privacy-edit";
import { requireCreator } from "@/lib/rbac";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { getDictionary } from "../../../../../../dictionaries";
import { PrivacyWorkspace } from "./privacy-workspace";
import type { ImageEditSetup } from "./privacy-types";

export const dynamic = "force-dynamic";
// Preview and save wait on Cloudinary to render a full panorama (and, for generative
// edits, to answer 423 until it is done). The actions budget about 40 seconds of that.
export const maxDuration = 60;

type PrivacyMeta = { filename?: string; privacyEdit?: { sourceMediaId?: string; recipe?: unknown } };

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/scenes/[sceneId]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.scenes.privacy.heading,
    robots: { index: false, follow: false },
  };
}

export default async function ScenePrivacyPage({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/scenes/[sceneId]/privacy">) {
  const { lang, id, sceneId } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const [destination, scene, dict] = await Promise.all([
    getDestinationById(id),
    getSceneById(sceneId),
    getDictionary(lang),
  ]);
  if (!destination || !scene || scene.destinationId !== destination.id) notFound();

  const [panorama] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      publicId: schema.mediaAssets.cloudinaryPublicId,
      secureUrl: schema.mediaAssets.cloudinarySecureUrl,
      metadata: schema.mediaAssets.metadata,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, scene.panoramaMediaId))
    .limit(1);

  const isVideo = panorama?.kind === "video_360";
  // Same delivery choices as the scene editor: the stored MP4 for video (the f_mp4
  // transform 400s on edited exports), f_auto/q_auto for photos.
  const panoramaUrl = isVideo
    ? panorama?.secureUrl ??
      (panorama?.publicId ? video360PanoramaUrl(panorama.publicId) : null)
    : panorama?.publicId
      ? imageUrl(panorama.publicId, { format: "auto", quality: "auto" })
      : panorama?.secureUrl ?? null;

  // Hotspots and links are left out deliberately: this page is about the photograph,
  // and a click on a pin would land on the pin instead of the person being hidden.
  // Horizon roll and start view ARE kept, so the creator sees what visitors see.
  const tour: VirtualTourType | null = panoramaUrl
    ? {
        slug: scene.id,
        title: scene.name,
        startSceneId: scene.id,
        scenes: [
          {
            id: scene.id,
            name: scene.name,
            panorama: panoramaUrl,
            type: isVideo ? "video" : "photo",
            rollOffsetDeg: scene.rollOffsetDeg ?? undefined,
            minPitchDeg: scene.minPitchDeg ?? undefined,
            // Show the creator the label visitors will see.
            aiEdited: isAiEdited(panorama?.metadata) || undefined,
            startPosition:
              scene.startYaw !== null && scene.startPitch !== null
                ? { yaw: scene.startYaw, pitch: scene.startPitch }
                : undefined,
          },
        ],
      }
    : null;

  // Photo edits: images only (Cloudinary's face and region effects do not apply to video).
  let edit: ImageEditSetup | null = null;
  if (panorama && panorama.kind === "photo_360" && panorama.publicId) {
    const meta = (panorama.metadata ?? {}) as PrivacyMeta;
    const sourceId = meta.privacyEdit?.sourceMediaId;
    let basis: ImageEditSetup["basis"] = "original";
    let initialRecipe: ImageEditSetup["initialRecipe"] = null;
    if (sourceId) {
      const [source] = await db
        .select({ id: schema.mediaAssets.id })
        .from(schema.mediaAssets)
        .where(
          and(
            eq(schema.mediaAssets.id, sourceId),
            eq(schema.mediaAssets.status, "ready"),
            isNull(schema.mediaAssets.deletedAt),
          ),
        )
        .limit(1);
      basis = source ? "fromOriginal" : "onCopy";
      // Rebuilding from the original means starting from the edit that made this copy.
      initialRecipe = source ? parseStoredRecipe(meta.privacyEdit?.recipe) : null;
    }
    const logoRows = await db
      .select({
        id: schema.mediaAssets.id,
        displayName: schema.mediaAssets.displayName,
        publicId: schema.mediaAssets.cloudinaryPublicId,
        metadata: schema.mediaAssets.metadata,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.ownerId, user.id),
          eq(schema.mediaAssets.kind, "image"),
          eq(schema.mediaAssets.status, "ready"),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .orderBy(desc(schema.mediaAssets.createdAt))
      .limit(200);
    edit = {
      currentMediaId: panorama.id,
      basis,
      initialRecipe,
      logoOptions: logoRows
        .filter((r): r is typeof r & { publicId: string } => Boolean(r.publicId))
        .map((r) => ({
          id: r.id,
          name:
            r.displayName ??
            ((r.metadata ?? {}) as PrivacyMeta).filename ??
            dict.creator.scenes.privacy.edit.patchLogo,
          // PNG keeps a transparent background transparent for the canvas.
          url: imageUrl(r.publicId, { width: 512, crop: "limit", format: "png" }),
        })),
    };
  }

  const t = dict.creator.scenes.privacy;
  const sceneHref = `/${lang}/creator/destinations/${destination.id}/scenes/${scene.id}`;

  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-col gap-1 text-sm">
        <Link
          href={`/${lang}/creator/destinations/${destination.id}`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {destination.name}
        </Link>
        <Link
          href={sceneHref}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {scene.name}
        </Link>
      </nav>

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.heading}</h1>
      <p className="mt-2 max-w-3xl text-base text-zinc-600 dark:text-zinc-300">{t.intro}</p>
      <p className="mt-2 text-sm">
        <Link
          href={`/${lang}/docs/hiding-people`}
          className="inline-flex min-h-11 items-center underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {t.guideLink}
        </Link>
      </p>

      {tour ? (
        <PrivacyWorkspace
          tour={tour}
          sceneId={scene.id}
          destinationId={destination.id}
          lang={lang}
          initialMinPitchDeg={scene.minPitchDeg}
          viewLimitDict={t.viewLimit}
          edit={edit}
          editDict={t.edit}
        />
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-6 text-sm text-amber-800 dark:text-amber-300">
          {dict.creator.scenes.panoramaMissing}
        </div>
      )}
    </main>
  );
}
