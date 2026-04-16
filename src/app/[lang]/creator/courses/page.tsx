import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listCoursesForCreator } from "@/db/queries/courses";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.courses.title,
    description: dict.creator.courses.subtitle,
    robots: { index: false, follow: false },
  };
}

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return "Free";
  const dollars = (cents / 100).toFixed(2);
  return `${currency} ${dollars}`;
}

export default async function CoursesPage({
  params,
}: PageProps<"/[lang]/creator/courses">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const dict = await getDictionary(lang);
  const rows = await listCoursesForCreator(user.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {dict.creator.courses.title}
          </h1>
          <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
            {dict.creator.courses.subtitle}
          </p>
        </div>
        <Link
          href={`/${lang}/creator/courses/new`}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.creator.courses.newCta}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
          {dict.creator.courses.emptyState}
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15"
            >
              <Link
                href={`/${lang}/creator/courses/${row.id}`}
                className="text-lg font-semibold tracking-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {row.title}
              </Link>
              {row.subtitle ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{row.subtitle}</p>
              ) : null}
              <div className="mt-auto flex items-center gap-2 pt-2 text-xs">
                <span className="rounded-full bg-black/5 px-2 py-0.5 font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                  {dict.creator.courses.statuses[row.status]}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {formatPrice(row.priceCents, row.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
