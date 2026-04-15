import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import { listPhoto360ForOwner } from "@/db/queries/scenes";
import { imageUrl } from "@/lib/cloudinary";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { createScene } from "@/lib/actions/scenes";
import { getDictionary } from "../../../../../dictionaries";
import { NewSceneForm } from "./new-scene-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/scenes/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.scenes.newTitle,
    description: dict.creator.scenes.newSubtitle,
    robots: { index: false, follow: false },
  };
}

export default async function NewScenePage({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/scenes/new">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const destination = await getDestinationById(id);
  if (!destination) notFound();
  const dict = await getDictionary(lang);

  const photos = await listPhoto360ForOwner(user.id);
  const panoramas = photos.map((p) => ({
    id: p.id,
    label: p.cloudinaryPublicId?.split("/").pop() ?? p.id.slice(0, 8),
    thumbnailUrl: p.cloudinaryPublicId
      ? imageUrl(p.cloudinaryPublicId, { width: 480, crop: "fill" })
      : null,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
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
      <h1 className="text-3xl font-semibold tracking-tight">{dict.creator.scenes.newTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.scenes.newSubtitle}
      </p>

      <NewSceneForm
        dict={dict.creator.scenes.form}
        lang={lang}
        destinationId={destination.id}
        panoramas={panoramas}
        action={createScene}
      />
    </main>
  );
}
