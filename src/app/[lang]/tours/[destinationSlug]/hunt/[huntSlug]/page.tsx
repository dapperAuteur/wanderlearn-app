import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationBySlug } from "@/db/queries/destinations";
import { getHuntBySlug, listProgress, listStopsForHunt, toStopInputs } from "@/db/queries/hunts";
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
  const stops = await listStopsForHunt(hunt.id);
  const inputs = toStopInputs(stops);

  // Progress is keyed on an opaque browser token. The server cannot know it before the client says
  // so, so the first render is unauthenticated-empty and the client reconciles. `?v=` lets a visitor
  // resume from a shared link without any of it touching an account.
  const query = await searchParams;
  const visitorKey = typeof query?.v === "string" ? query.v : null;
  const initialUnlocked =
    visitorKey && visitorKey.length >= 8 ? await listProgress(hunt.id, visitorKey) : [];

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
          stops={inputs.map((s) => {
            const row = stops.find((x) => x.id === s.id)!;
            return { ...s, clue: row.clue, reveal: row.reveal, sceneName: row.sceneName };
          })}
          dict={dict.tours.hunt}
        />
      </div>
    </main>
  );
}
