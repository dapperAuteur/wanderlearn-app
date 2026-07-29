import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import { listLinksForDestination } from "@/db/queries/hotspots";
import { listIconCandidatesForOwner, listScenesForDestination } from "@/db/queries/scenes";
import { getMediaAssetById } from "@/db/queries/media";
import { imageUrl, posterUrlFor } from "@/lib/cloudinary";
import { TourMapEditor } from "./tour-map-editor";
import { analyzeTourGraph } from "@/lib/tour-graph";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../../../dictionaries";
import { ConnectionsEditor } from "./connections-editor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/connections">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.destinations.connections.title,
    robots: { index: false, follow: false },
  };
}

export default async function ConnectionsPage({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/connections">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const destination = await getDestinationById(id);
  if (!destination) notFound();

  const [dict, scenes, links, imageCandidates, mapMedia] = await Promise.all([
    getDictionary(lang),
    listScenesForDestination(destination.id),
    listLinksForDestination(destination.id),
    listIconCandidatesForOwner(user.id),
    destination.mapMediaId
      ? getMediaAssetById(destination.mapMediaId)
      : Promise.resolve(null),
  ]);
  const t = dict.creator.destinations.connections;

  // Oldest scene first for stable numbering; listScenesForDestination returns
  // newest-first.
  const orderedScenes = [...scenes].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  // Same start-scene fallback chain as assemble-tour: explicit default, else oldest.
  const startSceneId =
    (destination.defaultStartSceneId &&
    orderedScenes.some((s) => s.id === destination.defaultStartSceneId)
      ? destination.defaultStartSceneId
      : orderedScenes[0]?.id) ?? null;

  const stats = analyzeTourGraph({
    sceneIds: orderedScenes.map((s) => s.id),
    links: links.map((l) => ({
      fromSceneId: l.fromSceneId,
      toSceneId: l.toSceneId,
      placed: l.yaw !== null && l.pitch !== null,
    })),
    startSceneId,
  });

  // Tour-map source + display URL. Template resolves to the bundled SVGs;
  // media resolves through the same Cloudinary helper the tour uses.
  const mapSource =
    destination.mapMediaId && mapMedia
      ? ({ kind: "media", id: destination.mapMediaId } as const)
      : destination.mapTemplate === "grid" || destination.mapTemplate === "blank"
        ? ({ kind: "template", template: destination.mapTemplate } as const)
        : ({ kind: "none" } as const);
  const mapDisplayUrl =
    mapSource.kind === "template"
      ? `/map-templates/${mapSource.template}.svg`
      : mapSource.kind === "media" && mapMedia?.cloudinaryPublicId
        ? imageUrl(mapMedia.cloudinaryPublicId, { format: "auto", quality: "auto" })
        : mapSource.kind === "media"
          ? mapMedia?.cloudinarySecureUrl ?? null
          : null;

  const orphanCount = [...stats.values()].filter((s) => s.isOrphan).length;
  const deadEndCount = [...stats.values()].filter((s) => s.isDeadEnd).length;
  const unreachableCount = [...stats.values()].filter((s) => s.isUnreachable).length;
  const summary = t.healthSummary
    .replace("{scenes}", String(orderedScenes.length))
    .replace("{links}", String(links.length))
    .replace("{orphans}", String(orphanCount))
    .replace("{deadEnds}", String(deadEndCount))
    .replace("{unreachable}", String(unreachableCount));

  return (
    <main id="main" className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
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

      <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
        {t.subtitle}
      </p>

      {orderedScenes.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-black/15 p-6 text-center text-base text-zinc-700 dark:border-white/20 dark:text-zinc-200">
          {t.emptyState}
        </p>
      ) : (
        <>
          <p
            role="status"
            className="mt-6 rounded-md border border-black/10 bg-black/5 px-4 py-3 text-sm font-medium dark:border-white/15 dark:bg-white/5"
          >
            {summary}
          </p>

          <ConnectionsEditor
            lang={lang}
            destinationId={destination.id}
            scenes={orderedScenes.map((s) => ({ id: s.id, name: s.name }))}
            links={links.map((l) => ({
              linkId: l.linkId,
              fromSceneId: l.fromSceneId,
              toSceneId: l.toSceneId,
              toSceneName: l.toSceneName,
              name: l.name,
              placed: l.yaw !== null && l.pitch !== null,
            }))}
            stats={orderedScenes.map((s) => {
              const st = stats.get(s.id)!;
              return {
                sceneId: s.id,
                incoming: st.incoming,
                outgoing: st.outgoing,
                isStart: st.isStart,
                isOrphan: st.isOrphan,
                isDeadEnd: st.isDeadEnd,
                isUnreachable: st.isUnreachable,
                duplicateTargets: st.duplicateTargets,
              };
            })}
            dict={t}
          />

          <TourMapEditor
            lang={lang}
            destinationId={destination.id}
            scenes={orderedScenes.map((s) => ({ id: s.id, name: s.name }))}
            positions={Object.fromEntries(
              orderedScenes.map((s) => [
                s.id,
                s.mapX !== null && s.mapY !== null ? { x: s.mapX, y: s.mapY } : undefined,
              ]),
            )}
            links={links.map((l) => ({
              fromSceneId: l.fromSceneId,
              toSceneId: l.toSceneId,
            }))}
            startSceneId={startSceneId}
            source={mapSource}
            displayUrl={mapDisplayUrl}
            imageOptions={imageCandidates.map((c) => ({
              id: c.id,
              label: c.displayName ?? c.id.slice(0, 8),
              thumbUrl: c.cloudinaryPublicId
                ? posterUrlFor("image", c.cloudinaryPublicId, 320)
                : null,
            }))}
            uploaderDict={dict.creator.uploader}
            userRole={(user as { role?: string }).role ?? "creator"}
            dict={dict.creator.destinations.tourMap}
          />
        </>
      )}
    </main>
  );
}
