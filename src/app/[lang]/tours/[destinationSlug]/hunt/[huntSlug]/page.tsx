import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationBySlug } from "@/db/queries/destinations";
import {
  getHuntBySlug,
  listHotspotKeysHeld,
  listProgress,
  listStopsForHunt,
  toStopInputs,
} from "@/db/queries/hunts";
import { assembleTour } from "@/lib/assemble-tour";
import { hasLocale } from "@/lib/locales";
import { absoluteUrl, siteName } from "@/lib/site";
import { getDictionary } from "../../../../dictionaries";
import { HuntRunner } from "./hunt-runner";

export const dynamic = "force-dynamic";

async function load(destinationSlug: string, huntSlug: string) {
  const destination = await getDestinationBySlug(destinationSlug);
  // A hunt only exists publicly if its destination does. Private destinations do not expose hunts
  // even via a share token: a hunt is a published artifact, and the share-token path is for
  // previewing a tour, not for handing out a game.
  if (!destination || !destination.isPublic) return null;
  const hunt = await getHuntBySlug(destination.id, huntSlug);
  if (!hunt || hunt.status !== "published") return null;
  return { destination, hunt };
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/tours/[destinationSlug]/hunt/[huntSlug]">): Promise<Metadata> {
  const { lang, destinationSlug, huntSlug } = await params;
  if (!hasLocale(lang)) return {};
  const found = await load(destinationSlug, huntSlug);
  if (!found) return {};
  const description =
    found.hunt.intro?.slice(0, 160) ??
    `A guided hunt through ${found.destination.name}.`;
  return {
    title: `${found.hunt.title} — ${found.destination.name}`,
    description,
    alternates: { canonical: absoluteUrl(`/${lang}/tours/${destinationSlug}/hunt/${huntSlug}`) },
    openGraph: {
      title: found.hunt.title,
      description,
      siteName,
      url: absoluteUrl(`/${lang}/tours/${destinationSlug}/hunt/${huntSlug}`),
    },
  };
}

export default async function HuntPage({
  params,
  searchParams,
}: PageProps<"/[lang]/tours/[destinationSlug]/hunt/[huntSlug]">) {
  const { lang, destinationSlug, huntSlug } = await params;
  if (!hasLocale(lang)) notFound();
  const found = await load(destinationSlug, huntSlug);
  if (!found) notFound();
  const { destination, hunt } = found;

  const dict = await getDictionary(lang);
  // Split the nested map dictionary out from the flat string dictionary the runner takes, so neither
  // prop needs a widened type or a cast.
  const { map: mapDict, ...huntDict } = dict.tours.hunt;
  const stops = await listStopsForHunt(hunt.id);
  const inputs = toStopInputs(stops);

  // Progress is keyed on an opaque browser token. The server cannot know it before the client says
  // so, so the first render is unauthenticated-empty and the client reconciles. `?v=` lets a visitor
  // resume from a shared link without any of it touching an account.
  const query = await searchParams;
  const visitorKey = typeof query?.v === "string" ? query.v : null;
  const hasVisitor = Boolean(visitorKey && visitorKey.length >= 8);
  const initialUnlocked = hasVisitor ? await listProgress(hunt.id, visitorKey!) : [];
  const initialHotspotKeys = hasVisitor ? await listHotspotKeysHeld(hunt.id, visitorKey!) : [];

  // The destination's tour, embedded in the hunt so hotspot keys and stop progress share one key
  // state. Assembled with creatorId null, matching the public share route: a hunt shows the whole
  // tour, not one creator's slice of it.
  const assembled = await assembleTour({
    destinationId: destination.id,
    creatorId: null,
    startSceneId: destination.defaultStartSceneId,
    title: destination.name,
    description: destination.description,
    mapMediaId: destination.mapMediaId,
    transitionAudioMediaId: destination.transitionAudioMediaId,
    mapTemplate: destination.mapTemplate,
    sceneLinkIconSize: destination.sceneLinkIconSize,
    sceneLinkIconOpacity: destination.sceneLinkIconOpacity,
    hotspotIconOpacity: destination.hotspotIconOpacity,
    showSceneLabels: destination.showSceneLabels,
    hotspotIconSize: destination.hotspotIconSize,
    arrowColor: destination.tourArrowColor,
    pinColor: destination.tourPinColor,
    pinIconMediaId: destination.pinIconMediaId,
    tourArrowMediaId: destination.tourArrowMediaId,
    nextDestinationId: destination.nextDestinationId,
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href={`/${lang}/tours/${destination.slug}`} className="text-sm underline underline-offset-2">
        {destination.name}
      </Link>
      <div className="mt-4">
        <HuntRunner
          huntId={hunt.id}
          title={hunt.title}
          intro={hunt.intro}
          allowRemoteFallback={hunt.allowRemoteFallback}
          initialUnlocked={initialUnlocked}
          initialHotspotKeys={initialHotspotKeys}
          tour={assembled.ok ? assembled.tour : null}
          lang={lang}
          crossTourDict={dict.tours.crossTourPreview}
          stops={inputs.map((s) => {
            const row = stops.find((x) => x.id === s.id)!;
            return { ...s, clue: row.clue, reveal: row.reveal, sceneName: row.sceneName };
          })}
          dict={huntDict}
          mapDict={mapDict}
        />
      </div>
    </main>
  );
}
