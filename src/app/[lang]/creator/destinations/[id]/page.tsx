import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import {
  creatorHasSceneAtDestination,
  getMediaAssetById,
  listAssignableMediaForDestination,
  listMediaForDestination,
} from "@/db/queries/media";
import {
  getDestinationSceneKindSummary,
  listScenesForDestination,
  listSceneVideosMissingTranscript,
  listAudioForOwnerScoped,
} from "@/db/queries/scenes";
import { MissingTranscriptNotice } from "@/components/media/missing-transcript-notice";
import { BulkSceneCreator } from "./bulk-scene-creator";
import { posterUrlFor, type UploadKind } from "@/lib/cloudinary-urls";
import { hasLocale } from "@/lib/locales";
import { requireCreatorWithAuthz } from "@/lib/rbac";
import { siteUrl } from "@/lib/site";
import { getDictionary } from "../../../dictionaries";
import { DefaultStartSceneControls } from "./default-start-scene-controls";
import {
  TransitionAudioPicker,
  type TransitionAudioOption,
} from "@/components/media/transition-audio-picker";
import { PeakSceneControls } from "./peak-scene-controls";
import { DestinationMediaLibrary } from "./destination-media-library";
import { DestinationTransferPanel } from "./destination-transfer-panel";
import { PublicShareControls } from "./public-share-controls";
import { PrivateShareControls } from "./private-share-controls";
import { EmbedSnippetGenerator } from "./embed-snippet-generator";
import { DescriptionProse } from "@/components/description-prose";

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

function formatCoordinate(value: string | null): string | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `${num.toFixed(6)}°`;
}

export default async function ViewDestinationPage({
  params,
  searchParams,
}: PageProps<"/[lang]/creator/destinations/[id]">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreatorWithAuthz(lang);
  const isAdmin = user.role === "admin";
  const destination = await getDestinationById(id);
  if (!destination) notFound();
  const [
    dict,
    scenes,
    heroMedia,
    sceneKinds,
    libraryRows,
    assignableRows,
    hasSceneAtDestination,
    sceneVideosMissingTranscript,
    transitionAudioRows,
  ] = await Promise.all([
    getDictionary(lang),
    listScenesForDestination(destination.id),
    destination.heroMediaId ? getMediaAssetById(destination.heroMediaId) : Promise.resolve(null),
    getDestinationSceneKindSummary(destination.id),
    listMediaForDestination(destination.id, user.id, { callerIsAdmin: isAdmin }),
    listAssignableMediaForDestination(destination.id, user.id),
    creatorHasSceneAtDestination(destination.id, user.id),
    listSceneVideosMissingTranscript(destination.id),
    listAudioForOwnerScoped(user.id, destination.id),
  ]);
  // Candidates for bulk scene creation: panoramas already assigned to this tour that
  // do not already back a scene here. Excluding used ones keeps a repeat visit from
  // tempting the creator into duplicating rooms.
  // Scene options carry the CURRENT filename as well as the scene name.
  //
  // A scene's name is copied from its media file when the scene is created and
  // is independent from then on, so renaming the file never renames the scene.
  // That is defensible — a creator who deliberately renamed a scene should not
  // have it overwritten — but it is invisible, and it made these pickers
  // unusable: BAM renamed his files, came here to mark a peak scene, and could
  // not find them because the list still showed the names from upload day.
  //
  // Showing both means the picker can be searched by whichever name the
  // creator remembers. It does not change any stored value.
  const mediaNameById = new Map(
    libraryRows.map((r) => [r.id, r.displayName?.trim() || null] as const),
  );
  const sceneOptions = scenes.map((s) => {
    const fileName = s.panoramaMediaId ? (mediaNameById.get(s.panoramaMediaId) ?? null) : null;
    return {
      id: s.id,
      name: s.name,
      // Only when it actually differs — repeating the same string twice on
      // every row would be noise that teaches people to stop reading it.
      fileName: fileName && fileName !== s.name ? fileName : null,
    };
  });

  const transitionAudioOptions: TransitionAudioOption[] = transitionAudioRows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    url: row.cloudinarySecureUrl,
    // Surfaced on every option: the decision that matters here is length, not
    // which file has the nicer name.
    durationSeconds: row.durationSeconds,
  }));

  const usedPanoramaIds = new Set(scenes.map((s) => s.panoramaMediaId));
  const bulkSceneCandidates = libraryRows
    .filter(
      (r) =>
        // listMediaForDestination already filters to ready media, and
        // bulkCreateScenes re-checks status server-side and skips anything that
        // is not, so a race here degrades to a skipped count rather than a bad row.
        (r.kind === "photo_360" || r.kind === "video_360") && !usedPanoramaIds.has(r.id),
    )
    .map((r) => ({
      id: r.id,
      kind: r.kind as "photo_360" | "video_360",
      label: r.displayName ?? r.id.slice(0, 8),
      thumbnailUrl: r.cloudinaryPublicId
        ? posterUrlFor(r.kind as "photo_360" | "video_360", r.cloudinaryPublicId, 320)
        : null,
    }));

  const explicitMedia = libraryRows.filter((r) => r.source === "explicit");
  const autoIncludedMedia = libraryRows.filter((r) => r.source === "auto-scene");
  const isMixed = sceneKinds.hasPhoto && sceneKinds.hasVideo;

  const heroUrl =
    heroMedia && heroMedia.status === "ready" && heroMedia.cloudinaryPublicId
      ? posterUrlFor(heroMedia.kind as UploadKind, heroMedia.cloudinaryPublicId, 1600)
      : heroMedia?.cloudinarySecureUrl ?? null;
  const query = await searchParams;
  const savedFlag = typeof query?.saved === "string" ? query.saved : null;

  const latFormatted = formatCoordinate(destination.lat);
  const lngFormatted = formatCoordinate(destination.lng);
  const mapUrl =
    destination.lat && destination.lng
      ? `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`
      : null;

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/creator/destinations`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.creator.destinations.title}
        </Link>
      </nav>

      {savedFlag === "1" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.destinations.savedBanner}
        </p>
      ) : savedFlag === "created" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.destinations.createdBanner}
        </p>
      ) : null}

      {isMixed ? (
        <div
          role="status"
          className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <p className="font-semibold">
            {dict.creator.destinations.mixedTourWarning.title}
          </p>
          <p className="mt-1">
            {dict.creator.destinations.mixedTourWarning.body}
          </p>
        </div>
      ) : null}

      {heroUrl ? (
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg border border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/5">
          <Image
            src={heroUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 900px, 100vw"
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{destination.name}</h1>
          {destination.city || destination.country ? (
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
              {[destination.city, destination.country].filter(Boolean).join(", ")}
            </p>
          ) : null}
        </div>
        <Link
          href={`/${lang}/creator/destinations/${destination.id}/edit`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.creator.destinations.editCta}
        </Link>
      </div>

      {destination.description ? (
        <DescriptionProse source={destination.description} className="mt-6" />
      ) : (
        <p className="mt-6 text-sm italic text-zinc-500 dark:text-zinc-400">
          {dict.creator.destinations.noDescription}
        </p>
      )}

      <section
        aria-labelledby="details-heading"
        className="mt-10 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h2 id="details-heading" className="text-lg font-semibold">
          {dict.creator.destinations.detailsHeading}
        </h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.destinations.slugLabel}
          </dt>
          <dd className="font-mono">{destination.slug}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.destinations.form.latLabel}
          </dt>
          <dd className="font-mono">{latFormatted ?? "—"}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.destinations.form.lngLabel}
          </dt>
          <dd className="font-mono">{lngFormatted ?? "—"}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.destinations.form.websiteLabel}
          </dt>
          <dd className="min-w-0 wrap-break-word">
            {destination.website ? (
              <a
                href={destination.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {destination.website.replace(/^https?:\/\//, "")}
                <span aria-hidden="true">↗</span>
                <span className="sr-only">{dict.creator.destinations.externalLink}</span>
              </a>
            ) : (
              "—"
            )}
          </dd>
        </dl>
        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.creator.destinations.openInMaps}
            <span aria-hidden="true">↗</span>
            <span className="sr-only">{dict.creator.destinations.externalLink}</span>
          </a>
        ) : null}
      </section>

      <div className="mt-10">
        <PublicShareControls
          destinationId={destination.id}
          destinationSlug={destination.slug}
          lang={lang}
          initialIsPublic={destination.isPublic}
          origin={siteUrl}
          dict={dict.creator.destinations.publicShare}
        />
        <PrivateShareControls
          destinationId={destination.id}
          destinationSlug={destination.slug}
          lang={lang}
          initialToken={destination.shareToken}
          origin={siteUrl}
          dict={dict.creator.destinations.privateShare}
        />
      </div>

      <div className="mt-10">
        <DefaultStartSceneControls
          destinationId={destination.id}
          lang={lang}
          initialDefaultStartSceneId={destination.defaultStartSceneId}
          scenes={sceneOptions}
          dict={dict.creator.destinations.defaultStartScene}
        />
      </div>

      {/* Sits directly under the start-scene picker on purpose: start, peak and
          end are three questions about the same tour, and a creator answering
          one should see the others. */}
      <div className="mt-6">
        <PeakSceneControls
          destinationId={destination.id}
          lang={lang}
          initialPeakSceneId={destination.peakSceneId}
          scenes={sceneOptions}
          dict={dict.creator.destinations.peakScene}
        />

        {/*
          The tour-wide default. The per-link override lives on the connections
          screen, where the link itself is edited — putting both here would mean
          choosing a doorway from a list of doorways, which the connections
          screen already does well.
        */}
        <TransitionAudioPicker
          destinationId={destination.id}
          lang={lang}
          currentMediaId={destination.transitionAudioMediaId}
          options={transitionAudioOptions}
          dict={dict.creator.destinations.transitionAudio}
        />
      </div>

      <div className="mt-10">
        <DestinationMediaLibrary
          lang={lang}
          destinationId={destination.id}
          hasSceneAtDestination={hasSceneAtDestination}
          explicit={explicitMedia}
          autoIncluded={autoIncludedMedia}
          assignable={assignableRows}
          dict={dict.creator.destinations.mediaLibrary}
          chromeDict={dict.creator.mediaPicker}
          uploaderDict={dict.creator.uploader}
          userRole={(user as { role?: string }).role ?? "creator"}
        />
      </div>

      <div className="mt-10">
        <DestinationTransferPanel
          lang={lang}
          destinationId={destination.id}
          ownsAnyScene={hasSceneAtDestination}
          dict={dict.creator.destinations.transfer}
        />
      </div>

      <div className="mt-10">
        <EmbedSnippetGenerator
          destinationName={destination.name}
          destinationSlug={destination.slug}
          origin={siteUrl}
          isPublic={destination.isPublic}
          lang={lang}
          dict={dict.creator.destinations.embed}
        />
      </div>

      {/* Tour-level transcript warning. The course publish gate only inspects lesson
          video blocks, so a tour published straight from this page — the museum-partner
          path — can go live with narrated 360° video and no alternative for anyone who
          cannot hear it. Named scenes rather than a bare count so the fix is obvious. */}
      {sceneVideosMissingTranscript.length > 0 ? (
        <MissingTranscriptNotice
          lang={lang}
          className="mt-10"
          dict={{
            heading: dict.creator.destinations.sceneVideoNoTranscript.heading.replace(
              "{count}",
              String(sceneVideosMissingTranscript.length),
            ),
            body: dict.creator.destinations.sceneVideoNoTranscript.body.replace(
              "{scenes}",
              sceneVideosMissingTranscript.map((s) => s.sceneName).join(", "),
            ),
            learnMore: dict.creator.destinations.sceneVideoNoTranscript.learnMore,
          }}
        />
      ) : null}

      <BulkSceneCreator
        destinationId={destination.id}
        lang={lang}
        candidates={bulkSceneCandidates}
        dict={dict.creator.destinations.bulkScenes}
      />

      <section aria-labelledby="scenes-heading" className="mt-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="scenes-heading" className="text-lg font-semibold">
              {dict.creator.destinations.scenesHeading}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {dict.creator.destinations.scenesIntro}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <Link
            href={`/${lang}/creator/destinations/${destination.id}/connections`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.creator.destinations.connections.connectionsCta}
          </Link>
          <Link
            href={`/${lang}/creator/destinations/${destination.id}/hunts`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.creator.destinations.hunts.title}
          </Link>
          <Link
            href={`/${lang}/creator/destinations/${destination.id}/scenes/new`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.creator.destinations.newSceneCta}
          </Link>
          </div>
        </div>
        {scenes.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.creator.destinations.scenesEmptyState}
          </p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {scenes.map((scene) => {
              const statusDict = dict.creator.scenes.publishControls.statuses;
              const tone =
                scene.status === "published"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300"
                  : scene.status === "unpublished"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:border-amber-400/40 dark:text-amber-200"
                    : "border-zinc-400/40 bg-zinc-400/10 text-zinc-700 dark:border-zinc-300/40 dark:text-zinc-200";
              return (
                <li
                  key={scene.id}
                  className="rounded-lg border border-black/10 p-4 dark:border-white/15"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/${lang}/creator/destinations/${destination.id}/scenes/${scene.id}`}
                      className="text-base font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    >
                      {scene.name}
                    </Link>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
                    >
                      {statusDict[scene.status]}
                    </span>
                  </div>
                  {scene.caption ? (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{scene.caption}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
