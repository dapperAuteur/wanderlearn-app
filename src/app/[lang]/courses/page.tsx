import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { listPublishedCourses } from "@/db/queries/courses";
import { posterUrlFor, type UploadKind } from "@/lib/cloudinary-urls";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { getDictionary } from "../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const path = `/${lang}/courses`;
  return {
    title: dict.learner.catalog.title,
    description: dict.learner.catalog.subtitle,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates("/courses", locales),
    },
    openGraph: {
      type: "website",
      siteName,
      title: dict.learner.catalog.title,
      description: dict.learner.catalog.subtitle,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
  };
}

function formatPrice(cents: number, currency: string, freeLabel: string): string {
  if (cents === 0) return freeLabel;
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export default async function CoursesCatalogPage({
  params,
}: PageProps<"/[lang]/courses">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const courses = await listPublishedCourses();

  const coverMediaIds = courses
    .map((c) => c.coverMediaId)
    .filter((id): id is string => id !== null);

  const coverMap = new Map<string, { publicId: string | null; secureUrl: string | null; kind: string }>();
  if (coverMediaIds.length > 0) {
    const rows = await db
      .select({
        id: schema.mediaAssets.id,
        publicId: schema.mediaAssets.cloudinaryPublicId,
        secureUrl: schema.mediaAssets.cloudinarySecureUrl,
        kind: schema.mediaAssets.kind,
      })
      .from(schema.mediaAssets)
      .where(inArray(schema.mediaAssets.id, coverMediaIds));
    for (const r of rows) {
      coverMap.set(r.id, { publicId: r.publicId, secureUrl: r.secureUrl, kind: r.kind });
    }
  }

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {dict.learner.catalog.title}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
          {dict.learner.catalog.subtitle}
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
          {dict.learner.catalog.emptyState}
        </p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const cover = course.coverMediaId ? coverMap.get(course.coverMediaId) : null;
            const coverUrl = cover?.publicId
              ? posterUrlFor(cover.kind as UploadKind, cover.publicId, 800)
              : cover?.secureUrl ?? null;
            return (
              <li
                key={course.id}
                className="flex flex-col overflow-hidden rounded-lg border border-black/10 dark:border-white/15"
              >
                <Link
                  href={`/${lang}/courses/${course.slug}`}
                  className="flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  <div className="relative aspect-video w-full bg-black/5 dark:bg-white/5">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 p-4">
                    <h2 className="text-lg font-semibold tracking-tight">{course.title}</h2>
                    {course.subtitle ? (
                      <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">
                        {course.subtitle}
                      </p>
                    ) : null}
                    <p className="mt-auto pt-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {formatPrice(course.priceCents, course.currency, dict.learner.catalog.freeLabel)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

