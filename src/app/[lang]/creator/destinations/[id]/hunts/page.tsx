import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import { listHuntsForDestination, listStopsForHunt } from "@/db/queries/hunts";
import { listScenesForDestination } from "@/db/queries/scenes";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../../../dictionaries";
import { NewHuntForm } from "./new-hunt-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/hunts">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.destinations.hunts.title,
    robots: { index: false, follow: false },
  };
}

export default async function HuntsPage({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]/hunts">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  await requireCreator(lang);
  const destination = await getDestinationById(id);
  if (!destination) notFound();

  const [dict, hunts, scenes] = await Promise.all([
    getDictionary(lang),
    listHuntsForDestination(destination.id),
    listScenesForDestination(destination.id),
  ]);
  const t = dict.creator.destinations.hunts;

  const counts = await Promise.all(
    hunts.map(async (h) => ({ id: h.id, n: (await listStopsForHunt(h.id)).length })),
  );
  const countById = new Map(counts.map((c) => [c.id, c.n]));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href={`/${lang}/creator/destinations/${destination.id}`}
        className="text-sm underline underline-offset-2"
      >
        {t.backToDestination}
      </Link>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{t.title}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t.subtitle}</p>

      {scenes.length === 0 ? (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t.noScenes}
        </p>
      ) : (
        <>
          <section aria-labelledby="hunt-list" className="mt-8">
            <h2 id="hunt-list" className="text-lg font-semibold">
              {t.title}
            </h2>
            {hunts.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t.emptyState}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {hunts.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`/${lang}/creator/destinations/${destination.id}/hunts/${h.id}`}
                        className="font-medium underline underline-offset-2"
                      >
                        {h.title}
                      </Link>
                      <span className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={
                            h.status === "published"
                              ? "rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                          }
                        >
                          {h.status === "published" ? t.published : t.draft}
                        </span>
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                          {h.mode === "onsite" ? t.onsite : t.virtual}
                        </span>
                        <span className="text-neutral-500">
                          {t.stopCount.replace("{n}", String(countById.get(h.id) ?? 0))}
                        </span>
                      </span>
                    </div>
                    {h.intro ? (
                      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{h.intro}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <NewHuntForm
            destinationId={destination.id}
            lang={lang}
            dict={{
              newHeading: t.newHeading,
              titleLabel: t.titleLabel,
              introLabel: t.introLabel,
              createCta: t.createCta,
            }}
          />
        </>
      )}
    </main>
  );
}
