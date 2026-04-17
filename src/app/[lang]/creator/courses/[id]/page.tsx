import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseById } from "@/db/queries/courses";
import { getDestinationById } from "@/db/queries/destinations";
import { listLessonsForCourse } from "@/db/queries/lessons";
import { hasLocale, locales } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { submitCourseForReview } from "@/lib/actions/courses";
import { checkCoursePublishReadiness } from "@/lib/publish-gates";
import { PublishSection } from "./publish-section";
import { getDictionary } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!hasLocale(lang)) return {};
  const course = await getCourseById(id);
  if (!course) return { title: "Course not found" };
  return {
    title: course.title,
    description: course.description ?? undefined,
    robots: { index: false, follow: false },
  };
}

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return "Free";
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export default async function ViewCoursePage({
  params,
  searchParams,
}: PageProps<"/[lang]/creator/courses/[id]">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const course = await getCourseById(id);
  if (!course || course.creatorId !== user.id) notFound();
  const [dict, destination, lessons, publishViolations] = await Promise.all([
    getDictionary(lang),
    course.destinationId ? getDestinationById(course.destinationId) : Promise.resolve(null),
    listLessonsForCourse(course.id),
    checkCoursePublishReadiness(course.id),
  ]);
  const query = await searchParams;
  const savedFlag = typeof query?.saved === "string" ? query.saved : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/creator/courses`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.creator.courses.title}
        </Link>
      </nav>

      {savedFlag === "1" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.courses.savedBanner}
        </p>
      ) : savedFlag === "created" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.courses.createdBanner}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{course.title}</h1>
          {course.subtitle ? (
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">{course.subtitle}</p>
          ) : null}
        </div>
        <Link
          href={`/${lang}/creator/courses/${course.id}/edit`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.creator.courses.editCta}
        </Link>
      </div>

      <PublishSection
        lang={lang}
        courseId={course.id}
        courseStatus={course.status}
        violations={publishViolations}
        action={submitCourseForReview}
        dict={dict.creator.publish}
      />

      <section
        aria-labelledby="translations-heading"
        className="mt-8 rounded-lg border border-black/10 p-5 dark:border-white/15"
      >
        <h2 id="translations-heading" className="text-base font-semibold">
          {dict.creator.translations.sectionHeading}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.creator.translations.sectionIntro.replace(
            "{locale}",
            course.defaultLocale === "es"
              ? dict.creator.translations.localeEs
              : dict.creator.translations.localeEn,
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {locales
            .filter((l) => l !== course.defaultLocale)
            .map((l) => (
              <Link
                key={l}
                href={`/${lang}/creator/courses/${course.id}/translations/${l}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
              >
                {dict.creator.translations.translateToCta.replace(
                  "{locale}",
                  l === "es"
                    ? dict.creator.translations.localeEs
                    : dict.creator.translations.localeEn,
                )}
              </Link>
            ))}
        </div>
      </section>

      {course.description ? (
        <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {course.description}
        </p>
      ) : (
        <p className="mt-6 text-sm italic text-zinc-500 dark:text-zinc-400">
          {dict.creator.courses.noDescription}
        </p>
      )}

      <section
        aria-labelledby="details-heading"
        className="mt-10 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h2 id="details-heading" className="text-lg font-semibold">
          {dict.creator.courses.detailsHeading}
        </h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">{dict.creator.courses.slugLabel}</dt>
          <dd className="font-mono">{course.slug}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.courses.statusLabel}
          </dt>
          <dd>{dict.creator.courses.statuses[course.status]}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">{dict.creator.courses.priceLabel}</dt>
          <dd>{formatPrice(course.priceCents, course.currency)}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.courses.defaultLocaleLabel}
          </dt>
          <dd>{course.defaultLocale === "es" ? dict.creator.courses.form.localeEs : dict.creator.courses.form.localeEn}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.courses.destinationLabel}
          </dt>
          <dd>
            {destination ? (
              <Link
                href={`/${lang}/creator/destinations/${destination.id}`}
                className="underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {destination.name}
              </Link>
            ) : (
              <span className="italic text-zinc-500 dark:text-zinc-400">
                {dict.creator.courses.form.destinationNone}
              </span>
            )}
          </dd>
        </dl>
      </section>

      <section aria-labelledby="lessons-heading" className="mt-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="lessons-heading" className="text-lg font-semibold">
              {dict.creator.courses.lessonsHeading}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {dict.creator.courses.lessonsIntro}
            </p>
          </div>
          <Link
            href={`/${lang}/creator/courses/${course.id}/lessons/new`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.creator.courses.newLessonCta}
          </Link>
        </div>
        {lessons.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.creator.courses.lessonsEmptyState}
          </p>
        ) : (
          <ol className="mt-6 flex flex-col gap-3">
            {lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/15"
              >
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {String(lesson.orderIndex).padStart(2, "0")}
                  </span>
                  <Link
                    href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}`}
                    className="truncate text-base font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    {lesson.title}
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-black/5 px-2 py-0.5 font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                    {dict.creator.lessons.statuses[lesson.status]}
                  </span>
                  {lesson.isFreePreview ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-800 dark:text-emerald-300">
                      {dict.creator.courses.freePreviewBadge}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
