import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublishedCourseBySlug } from "@/db/queries/courses";
import { listPublishedLessonsForCourse } from "@/db/queries/lessons";
import { getMediaAssetById } from "@/db/queries/media";
import { getEnrollment } from "@/db/queries/enrollments";
import {
  getLatestInProgressLesson,
  listProgressForEnrollment,
} from "@/db/queries/lesson-progress";
import { getSession } from "@/lib/rbac";
import { posterUrlFor, type UploadKind } from "@/lib/cloudinary-urls";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { hasStripe } from "@/lib/env";
import { getDictionary } from "../../dictionaries";
import { EnrollButton } from "./enroll-button";
import { BuyButton } from "./buy-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const course = await getPublishedCourseBySlug(slug);
  if (!course) return { title: "Course not found" };
  const path = `/${lang}/courses/${course.slug}`;
  return {
    title: course.title,
    description: course.description ?? course.subtitle ?? undefined,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates(`/courses/${course.slug}`, locales),
    },
    openGraph: {
      type: "article",
      siteName,
      title: course.title,
      description: course.description ?? course.subtitle ?? undefined,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
  };
}

function formatPrice(cents: number, currency: string, freeLabel: string): string {
  if (cents === 0) return freeLabel;
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export default async function CourseDetailPage({
  params,
}: PageProps<"/[lang]/courses/[slug]">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const course = await getPublishedCourseBySlug(slug);
  if (!course) notFound();

  const [lessons, cover, session] = await Promise.all([
    listPublishedLessonsForCourse(course.id),
    course.coverMediaId ? getMediaAssetById(course.coverMediaId) : Promise.resolve(null),
    getSession(),
  ]);

  const user = session?.user;
  const enrollment = user ? await getEnrollment(user.id, course.id) : null;
  const enrolled = enrollment !== null && enrollment.revokedAt === null;

  const [progressRows, latestInProgress] = enrolled && enrollment
    ? await Promise.all([
        listProgressForEnrollment(enrollment.id),
        getLatestInProgressLesson(enrollment.id),
      ])
    : [[], null];

  const progressByLessonId = new Map<string, "in_progress" | "completed">();
  for (const row of progressRows) {
    progressByLessonId.set(row.lessonId, row.status);
  }
  const completedCount = progressRows.filter((r) => r.status === "completed").length;

  const coverUrl = cover?.cloudinaryPublicId
    ? posterUrlFor(cover.kind as UploadKind, cover.cloudinaryPublicId, 1600)
    : cover?.cloudinarySecureUrl ?? null;

  const firstLessonSlug = lessons[0]?.slug ?? null;
  const resumeLessonSlug = latestInProgress
    ? (lessons.find((l) => l.id === latestInProgress.lessonId)?.slug ?? firstLessonSlug)
    : firstLessonSlug;
  const isPaid = course.priceCents > 0;

  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/courses`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.learner.catalog.title}
        </Link>
      </nav>

      {coverUrl ? (
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg border border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/5">
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 900px, 100vw"
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      ) : null}

      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{course.title}</h1>
      {course.subtitle ? (
        <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-200">{course.subtitle}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span className="text-base font-semibold">
          {formatPrice(course.priceCents, course.currency, dict.learner.catalog.freeLabel)}
        </span>
        {enrolled ? (
          resumeLessonSlug ? (
            <Link
              href={`/${lang}/learn/${course.slug}/${resumeLessonSlug}`}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {latestInProgress
                ? dict.learner.detail.resumeCta
                : dict.learner.detail.continueCta}
            </Link>
          ) : (
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              {dict.learner.detail.noLessonsYet}
            </span>
          )
        ) : isPaid ? (
          user ? (
            hasStripe ? (
              <BuyButton
                courseId={course.id}
                lang={lang}
                priceLabel={formatPrice(course.priceCents, course.currency, dict.learner.catalog.freeLabel)}
                dict={dict.learner.detail.buy}
              />
            ) : (
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:text-amber-300">
                {dict.learner.detail.paidNotAvailable}
              </span>
            )
          ) : (
            <Link
              href={`/${lang}/sign-in?from=${encodeURIComponent(`/${lang}/courses/${course.slug}`)}`}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {dict.learner.detail.signInToBuy}
            </Link>
          )
        ) : user ? (
          <EnrollButton
            courseId={course.id}
            courseSlug={course.slug}
            lang={lang}
            firstLessonSlug={firstLessonSlug}
            dict={dict.learner.detail.enroll}
          />
        ) : (
          <Link
            href={`/${lang}/sign-in?from=${encodeURIComponent(`/${lang}/courses/${course.slug}`)}`}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.learner.detail.signInToEnroll}
          </Link>
        )}
      </div>

      {course.description ? (
        <p className="mt-8 max-w-2xl whitespace-pre-wrap text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {course.description}
        </p>
      ) : null}

      <section aria-labelledby="lessons-heading" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="lessons-heading" className="text-2xl font-semibold tracking-tight">
            {dict.learner.detail.lessonsHeading}
          </h2>
          {enrolled && lessons.length > 0 ? (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {dict.learner.detail.progressSummary
                .replace("{done}", String(completedCount))
                .replace("{total}", String(lessons.length))}
            </span>
          ) : null}
        </div>
        {lessons.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.learner.detail.noLessonsYet}
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-2">
            {lessons.map((lesson, index) => {
              const canAccess = enrolled || lesson.isFreePreview;
              const lessonStatus = progressByLessonId.get(lesson.id);
              return (
                <li
                  key={lesson.id}
                  className="flex items-center gap-3 rounded-md border border-black/10 p-3 dark:border-white/15"
                >
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    {canAccess ? (
                      <Link
                        href={`/${lang}/learn/${course.slug}/${lesson.slug}`}
                        className="truncate text-base font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                      >
                        {lesson.title}
                      </Link>
                    ) : (
                      <span className="truncate text-base font-semibold text-zinc-500 dark:text-zinc-400">
                        {lesson.title}
                      </span>
                    )}
                    {lesson.summary ? (
                      <p className="line-clamp-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {lesson.summary}
                      </p>
                    ) : null}
                  </div>
                  {lessonStatus === "completed" ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      ✓ {dict.learner.detail.completedBadge}
                    </span>
                  ) : lessonStatus === "in_progress" ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                      {dict.learner.detail.inProgressBadge}
                    </span>
                  ) : lesson.isFreePreview ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      {dict.learner.detail.freePreviewBadge}
                    </span>
                  ) : !enrolled ? (
                    <span aria-hidden="true" className="text-xs text-zinc-400">
                      🔒
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
