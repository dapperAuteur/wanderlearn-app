import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import { getSceneById } from "@/db/queries/scenes";
import { assembleTour } from "@/lib/assemble-tour";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { siteUrl } from "@/lib/site";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";
import { PublicShareControls } from "../../public-share-controls";
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
  const user = await requireCreator(lang);
  const [destination, scene] = await Promise.all([
    getDestinationById(id),
    getSceneById(sceneId),
  ]);
  if (!destination || !scene || scene.destinationId !== destination.id) notFound();
  const dict = await getDictionary(lang);
  const query = await searchParams;
  const savedFlag = typeof query?.saved === "string" ? query.saved : null;

  // Build a full multi-scene preview via assembleTour. If we rendered just
  // this one scene with its outgoing links, PSV's VirtualTourPlugin would
  // crash with "Target node <id> does not exist" — it validates that every
  // link target is present in the nodes list. Including all sibling scenes
  // satisfies that AND gives the creator a real tour preview to click
  // through.
  const assembled = await assembleTour({
    destinationId: destination.id,
    creatorId: user.id,
    startSceneId: scene.id,
    title: scene.name,
    description: scene.caption,
  });
  const tour = assembled.ok ? assembled.tour : null;

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

      <div className="mt-8">
        <PublicShareControls
          destinationId={destination.id}
          destinationSlug={destination.slug}
          lang={lang}
          initialIsPublic={destination.isPublic}
          sceneId={scene.id}
          origin={siteUrl}
          dict={dict.creator.destinations.publicShare}
        />
      </div>
    </main>
  );
}
