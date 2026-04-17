import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPublishedCourseBySlug } from "@/db/queries/courses";
import {
  getPublishedLessonByCourseAndSlug,
  listPublishedLessonsForCourse,
} from "@/db/queries/lessons";
import { listBlocksForLesson } from "@/db/queries/content-blocks";
import { getEnrollment } from "@/db/queries/enrollments";
import { getLessonProgress } from "@/db/queries/lesson-progress";
import { getSession } from "@/lib/rbac";
import { hasLocale } from "@/lib/locales";
import {
  resolveLessonBlocks,
  LessonBlocksList,
} from "@/components/blocks/lesson-blocks";
import { CompleteLessonButton } from "./complete-button";
import { RecordLessonVisit } from "./record-visit";
import { getDictionary } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/learn/[courseSlug]/[lessonSlug]">): Promise<Metadata> {
  const { lang, courseSlug, lessonSlug } = await params;
  if (!hasLocale(lang)) return {};
  const course = await getPublishedCourseBySlug(courseSlug);
  if (!course) return { title: "Lesson not found" };
  const lesson = await getPublishedLessonByCourseAndSlug(course.id, lessonSlug);
  if (!lesson) return { title: "Lesson not found" };
  return {
    title: `${lesson.title} · ${course.title}`,
    description: lesson.summary ?? course.subtitle ?? undefined,
    robots: { index: false, follow: true },
  };
}

export default async function LessonPlayerPage({
  params,
}: PageProps<"/[lang]/learn/[courseSlug]/[lessonSlug]">) {
  const { lang, courseSlug, lessonSlug } = await params;
  if (!hasLocale(lang)) notFound();

  const course = await getPublishedCourseBySlug(courseSlug);
  if (!course) notFound();

  const lesson = await getPublishedLessonByCourseAndSlug(course.id, lessonSlug);
  if (!lesson) notFound();

  const session = await getSession();
  const user = session?.user;

  const enrollment = user ? await getEnrollment(user.id, course.id) : null;
  const enrolled = enrollment !== null && enrollment.revokedAt === null;
  const isCreator = user?.id === course.creatorId;
  const canAccess = enrolled || lesson.isFreePreview || isCreator;

  if (!canAccess) {
    if (!user) {
      const from = `/${lang}/learn/${courseSlug}/${lessonSlug}`;
      redirect(`/${lang}/sign-in?from=${encodeURIComponent(from)}`);
    }
    redirect(`/${lang}/courses/${course.slug}`);
  }

  const [dict, siblings, blocks, progress] = await Promise.all([
    getDictionary(lang),
    listPublishedLessonsForCourse(course.id),
    listBlocksForLesson(lesson.id),
    enrollment ? getLessonProgress(enrollment.id, lesson.id) : Promise.resolve(null),
  ]);

  const alreadyCompleted = progress?.status === "completed";

  const current = siblings.findIndex((l) => l.id === lesson.id);
  const prev = current > 0 ? siblings[current - 1] : null;
  const next = current >= 0 && current < siblings.length - 1 ? siblings[current + 1] : null;

  const rendered = await resolveLessonBlocks(blocks, {
    courseCreatorId: course.creatorId,
  });

  const rendererDict = {
    photo360Missing: dict.learner.player.photo360Missing,
    video360Missing: dict.learner.player.video360Missing,
    videoMissing: dict.learner.player.videoMissing,
    virtualTourMissing: dict.learner.player.virtualTourMissing,
    videoNoTranscriptPreview: "",
    rendererComingSoon: dict.learner.player.rendererComingSoon,
    types: dict.creator.blocks.types,
    quiz: dict.learner.player.quizPlayer,
  };

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {enrollment ? (
        <RecordLessonVisit
          enrollmentId={enrollment.id}
          lessonId={lesson.id}
          courseSlug={course.slug}
          lang={lang}
        />
      ) : null}
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-col gap-1 text-sm">
        <Link
          href={`/${lang}/courses`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.learner.catalog.title}
        </Link>
        <Link
          href={`/${lang}/courses/${course.slug}`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {course.title}
        </Link>
      </nav>

      <header className="mb-8 flex flex-col gap-3">
        <p className="text-xs font-mono uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {dict.learner.player.lessonLabel.replace(
            "{n}",
            String(current >= 0 ? current + 1 : 1),
          )} · {dict.learner.player.ofTotal.replace("{total}", String(siblings.length))}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{lesson.title}</h1>
        {lesson.summary ? (
          <p className="text-base text-zinc-600 dark:text-zinc-300">{lesson.summary}</p>
        ) : null}
        {!enrolled && lesson.isFreePreview ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300">
            {dict.learner.player.freePreviewBanner}
          </p>
        ) : null}
      </header>

      {rendered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
          {dict.learner.player.emptyLesson}
        </p>
      ) : (
        <LessonBlocksList rendered={rendered} dict={rendererDict} variant="player" />
      )}

      {enrollment ? (
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <CompleteLessonButton
            enrollmentId={enrollment.id}
            lessonId={lesson.id}
            courseSlug={course.slug}
            lang={lang}
            alreadyCompleted={alreadyCompleted}
            nextLessonSlug={next?.slug ?? null}
            dict={dict.learner.player.complete}
          />
          {alreadyCompleted ? (
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              {dict.learner.player.complete.completedHint}
            </span>
          ) : null}
        </div>
      ) : null}

      <nav
        aria-label={dict.learner.player.navLabel}
        className="mt-12 flex flex-col gap-3 border-t border-black/10 pt-6 sm:flex-row sm:justify-between dark:border-white/10"
      >
        {prev ? (
          <Link
            href={`/${lang}/learn/${course.slug}/${prev.slug}`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-5 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/${lang}/learn/${course.slug}/${next.slug}`}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-5 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {next.title} →
          </Link>
        ) : (
          <Link
            href={`/${lang}/courses/${course.slug}`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-5 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.learner.player.backToCourse}
          </Link>
        )}
      </nav>
    </main>
  );
}
