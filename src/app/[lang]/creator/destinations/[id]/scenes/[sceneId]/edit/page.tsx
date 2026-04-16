import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import { getSceneById, listPanoramasForOwner } from "@/db/queries/scenes";
import { posterUrlFor } from "@/lib/cloudinary";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { PanoramaPicker, type PanoramaOption } from "@/components/media/panorama-picker";
import { deleteScene } from "@/lib/actions/scenes";
import { getDictionary } from "../../../../../../dictionaries";
import { DeleteSceneButton } from "../delete-button";
import { SceneEditForm } from "./scene-edit-form";

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
  const [dict, panoramaRows] = await Promise.all([
    getDictionary(lang),
    listPanoramasForOwner(user.id),
  ]);

  const panoramaOptions: PanoramaOption[] = panoramaRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    thumbnailUrl: row.cloudinaryPublicId
      ? posterUrlFor(row.kind, row.cloudinaryPublicId, 480)
      : row.cloudinarySecureUrl,
  }));

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
