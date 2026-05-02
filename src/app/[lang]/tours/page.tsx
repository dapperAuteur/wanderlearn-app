import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { listPublicDestinations } from "@/db/queries/destinations";
import { posterUrlFor, type UploadKind } from "@/lib/cloudinary-urls";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/tours">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const path = `/${lang}/tours`;
  return {
    title: dict.learner.toursCatalog.title,
    description: dict.learner.toursCatalog.subtitle,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates("/tours", locales),
    },
    openGraph: {
      type: "website",
      siteName,
      title: dict.learner.toursCatalog.title,
      description: dict.learner.toursCatalog.subtitle,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
  };
}

export default async function ToursCatalogPage({
  params,
}: PageProps<"/[lang]/tours">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const destinations = await listPublicDestinations();
  const heroIds = destinations
    .map((d) => d.heroMediaId)
    .filter((id): id is string => Boolean(id));
  const heroRows = heroIds.length
    ? await db
        .select({
          id: schema.mediaAssets.id,
          kind: schema.mediaAssets.kind,
          cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
        })
        .from(schema.mediaAssets)
        .where(inArray(schema.mediaAssets.id, heroIds))
    : [];
  const heroById = new Map(heroRows.map((r) => [r.id, r]));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {dict.learner.toursCatalog.title}
      </h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
        {dict.learner.toursCatalog.subtitle}
      </p>

      {destinations.length === 0 ? (
        <p className="mt-12 text-base text-zinc-600 dark:text-zinc-300">
          {dict.learner.toursCatalog.emptyState}
        </p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((d) => {
            const hero = d.heroMediaId ? heroById.get(d.heroMediaId) : null;
            const thumb =
              hero?.cloudinaryPublicId
                ? posterUrlFor(hero.kind as UploadKind, hero.cloudinaryPublicId, 720)
                : null;
            return (
              <li key={d.id}>
                <Link
                  href={`/${lang}/tours/${d.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-lg border border-black/10 p-3 transition hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:border-white/30"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black/5 dark:bg-white/5">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition group-hover:scale-[1.02]"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight">{d.name}</h2>
                  {d.description ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      {d.description}
                    </p>
                  ) : null}
                  <span className="mt-auto inline-flex text-sm font-medium underline-offset-4 group-hover:underline">
                    {dict.learner.toursCatalog.openCta}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
