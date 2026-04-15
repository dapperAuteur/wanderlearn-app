import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listDestinations } from "@/db/queries/destinations";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.destinations.title,
    description: dict.creator.destinations.subtitle,
    robots: { index: false, follow: false },
  };
}

export default async function DestinationsPage({
  params,
}: PageProps<"/[lang]/creator/destinations">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireCreator(lang);
  const dict = await getDictionary(lang);
  const rows = await listDestinations();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {dict.creator.destinations.title}
          </h1>
          <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
            {dict.creator.destinations.subtitle}
          </p>
        </div>
        <Link
          href={`/${lang}/creator/destinations/new`}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.creator.destinations.newCta}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
          {dict.creator.destinations.emptyState}
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15"
            >
              <Link
                href={`/${lang}/creator/destinations/${row.id}`}
                className="text-lg font-semibold tracking-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {row.name}
              </Link>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {[row.city, row.country].filter(Boolean).join(", ") || "—"}
              </p>
              {row.description ? (
                <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">
                  {row.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
