import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import {
  getHuntById,
  listHotspotKeysForDestination,
  listStopsForHunt,
  toStopInputs,
} from "@/db/queries/hunts";
import { listScenesForDestination } from "@/db/queries/scenes";
import { analyzeHunt } from "@/lib/hunts";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../../../../dictionaries";
import { HuntEditor } from "./hunt-editor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/hunts/[huntId]">): Promise<Metadata> {
  const { lang, huntId } = await params;
  if (!hasLocale(lang)) return {};
  const hunt = await getHuntById(huntId);
  return { title: hunt?.title ?? "Hunt", robots: { index: false, follow: false } };
}

export default async function HuntEditorPage({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/hunts/[huntId]">) {
  const { lang, id, huntId } = await params;
  if (!hasLocale(lang)) notFound();
  await requireCreator(lang);

  const [destination, hunt] = await Promise.all([getDestinationById(id), getHuntById(huntId)]);
  if (!destination || !hunt) notFound();
  // A hunt id from another destination must not render here, even for its own owner: the scene
  // picker and every action below assume the two agree.
  if (hunt.destinationId !== destination.id) notFound();

  const [dict, stops, scenes, hotspotKeys] = await Promise.all([
    getDictionary(lang),
    listStopsForHunt(hunt.id),
    listScenesForDestination(destination.id),
    listHotspotKeysForDestination(destination.id),
  ]);
  const t = dict.creator.destinations.hunts;

  const problems = analyzeHunt({
    allowRemoteFallback: hunt.allowRemoteFallback,
    stops: toStopInputs(stops),
    hotspotKeys,
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href={`/${lang}/creator/destinations/${destination.id}/hunts`}
        className="text-sm underline underline-offset-2"
      >
        {t.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{hunt.title}</h1>

      <HuntEditor
        lang={lang}
        destinationId={destination.id}
        hunt={{
          id: hunt.id,
          title: hunt.title,
          intro: hunt.intro,
          status: hunt.status,
          mode: hunt.mode,
          allowRemoteFallback: hunt.allowRemoteFallback,
        }}
        stops={stops.map((s) => ({
          id: s.id,
          sceneId: s.sceneId,
          sceneName: s.sceneName,
          sortOrder: s.sortOrder,
          title: s.title,
          clue: s.clue,
          reveal: s.reveal,
          unlockKind: s.unlockKind,
          answers: s.answers ?? [],
          requiredKeys: s.requiredKeys ?? [],
          grantsKey: s.grantsKey,
          unlockRadiusM: s.unlockRadiusM,
          hasGeo: s.sceneGeoLat != null && s.sceneGeoLng != null,
        }))}
        scenes={scenes.map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.geoLat,
          lng: s.geoLng,
        }))}
        problems={problems}
        dict={t}
      />
    </main>
  );
}
