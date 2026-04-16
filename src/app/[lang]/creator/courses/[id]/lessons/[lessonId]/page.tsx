import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseById } from "@/db/queries/courses";
import { getLessonById } from "@/db/queries/lessons";
import { listBlocksForLesson } from "@/db/queries/content-blocks";
import {
  LessonBlockMedia,
  resolveLessonBlocks,
} from "@/components/blocks/lesson-blocks";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { DeleteBlockButton } from "./blocks/delete-block-button";
import { getDictionary } from "../../../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]">): Promise<Metadata> {
  const { lang, lessonId } = await params;
  if (!hasLocale(lang)) return {};
  const lesson = await getLessonById(lessonId);
  if (!lesson) return { title: "Lesson not found" };
  return {
    title: lesson.title,
    description: lesson.summary ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function ViewLessonPage({
  params,
  searchParams,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]">) {
  const { lang, id, lessonId } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const [course, lesson] = await Promise.all([
    getCourseById(id),
    getLessonById(lessonId),
  ]);
  if (!course || course.creatorId !== user.id) notFound();
  if (!lesson || lesson.courseId !== course.id) notFound();
  const [dict, blocks] = await Promise.all([
    getDictionary(lang),
    listBlocksForLesson(lesson.id),
  ]);
  const query = await searchParams;
  const savedFlag = typeof query?.saved === "string" ? query.saved : null;

  const renderedBlocks = await resolveLessonBlocks(blocks, {
    courseCreatorId: course.creatorId,
  });

  const rendererDict = {
    photo360Missing: dict.creator.blocks.photo360Missing,
    video360Missing: dict.creator.blocks.video360Missing,
    videoMissing: dict.creator.blocks.videoMissing,
    virtualTourMissing: dict.creator.blocks.virtualTourMissing,
    videoNoTranscriptPreview: dict.creator.blocks.videoNoTranscriptPreview,
    rendererComingSoon: dict.creator.blocks.rendererComingSoon,
    types: dict.creator.blocks.types,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-col gap-1 text-sm">
        <Link
          href={`/${lang}/creator/courses`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.creator.courses.title}
        </Link>
        <Link
          href={`/${lang}/creator/courses/${course.id}`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {course.title}
        </Link>
      </nav>

      {savedFlag === "1" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.lessons.savedBanner}
        </p>
      ) : savedFlag === "created" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.lessons.createdBanner}
        </p>
      ) : savedFlag === "block-created" || savedFlag === "block-saved" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.lessons.blockSavedBanner}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{lesson.title}</h1>
          {lesson.summary ? (
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">{lesson.summary}</p>
          ) : null}
        </div>
        <Link
          href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}/edit`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.creator.lessons.editCta}
        </Link>
      </div>

      <section
        aria-labelledby="details-heading"
        className="mt-10 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h2 id="details-heading" className="text-lg font-semibold">
          {dict.creator.lessons.detailsHeading}
        </h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">{dict.creator.lessons.slugLabel}</dt>
          <dd className="font-mono">{lesson.slug}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">{dict.creator.lessons.orderLabel}</dt>
          <dd className="font-mono">{lesson.orderIndex}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">{dict.creator.lessons.statusLabel}</dt>
          <dd>{dict.creator.lessons.statuses[lesson.status]}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.lessons.freePreviewLabel}
          </dt>
          <dd>
            {lesson.isFreePreview
              ? dict.creator.lessons.freePreviewYes
              : dict.creator.lessons.freePreviewNo}
          </dd>

          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.lessons.estimatedMinutesLabel}
          </dt>
          <dd>
            {lesson.estimatedMinutes !== null
              ? dict.creator.lessons.minutesValue.replace(
                  "{n}",
                  String(lesson.estimatedMinutes),
                )
              : "—"}
          </dd>
        </dl>
      </section>

      <section aria-labelledby="blocks-heading" className="mt-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="blocks-heading" className="text-lg font-semibold">
              {dict.creator.lessons.blocksHeading}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {dict.creator.blocks.intro}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}/blocks/new?type=text`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.creator.blocks.addTextCta}
            </Link>
            <Link
              href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}/blocks/new?type=photo_360`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.creator.blocks.addPhoto360Cta}
            </Link>
            <Link
              href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}/blocks/new?type=video`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.creator.blocks.addVideoCta}
            </Link>
            <Link
              href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}/blocks/new?type=video_360`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.creator.blocks.addVideo360Cta}
            </Link>
            <Link
              href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}/blocks/new?type=virtual_tour`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.creator.blocks.addVirtualTourCta}
            </Link>
          </div>
        </div>

        {renderedBlocks.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.creator.blocks.emptyState}
          </p>
        ) : (
          <ol className="mt-6 flex flex-col gap-4">
            {renderedBlocks.map((rendered, index) => {
              const { block } = rendered;
              const isEditable =
                rendered.kind === "text" ||
                rendered.kind === "photo_360" ||
                rendered.kind === "video" ||
                rendered.kind === "video_360" ||
                rendered.kind === "virtual_tour";
              return (
                <li
                  key={block.id}
                  className="rounded-lg border border-black/10 p-4 dark:border-white/15"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-zinc-500 dark:text-zinc-400">
                      {String(index + 1).padStart(2, "0")} ·{" "}
                      {dict.creator.blocks.types[block.type] ?? block.type}
                    </span>
                    <div className="flex items-center gap-2">
                      {isEditable ? (
                        <Link
                          href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}/blocks/${block.id}/edit`}
                          className="inline-flex min-h-9 items-center justify-center rounded-md border border-black/15 px-3 text-xs font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
                        >
                          {dict.creator.blocks.editCta}
                        </Link>
                      ) : null}
                      <DeleteBlockButton
                        blockId={block.id}
                        blockLabel={dict.creator.blocks.types[block.type] ?? block.type}
                        lang={lang}
                        dict={dict.creator.blocks.deleteButton}
                      />
                    </div>
                  </div>

                  <LessonBlockMedia block={rendered} dict={rendererDict} height="40vh" />
                  {(rendered.kind === "video" || rendered.kind === "video_360") &&
                  !rendered.hasTranscript ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      {dict.creator.blocks.videoNoTranscriptPreview}
                    </p>
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
