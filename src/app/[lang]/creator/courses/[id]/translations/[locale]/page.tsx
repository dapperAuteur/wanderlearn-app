import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseById } from "@/db/queries/courses";
import { listLessonsForCourse } from "@/db/queries/lessons";
import { listBlocksForLesson } from "@/db/queries/content-blocks";
import {
  getCourseTranslation,
  listContentBlockTranslationsByIds,
  listLessonTranslationsByIds,
} from "@/db/queries/translations";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import {
  upsertCourseTranslation,
  upsertLessonTranslation,
  upsertTextBlockTranslation,
} from "@/lib/actions/translations";
import type { TextBlockData } from "@/lib/actions/content-blocks";
import {
  CourseTranslationForm,
  LessonTranslationForm,
  NotTranslatableNotice,
  TextBlockTranslationForm,
} from "./translation-editor";
import { getDictionary } from "../../../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/translations/[locale]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.translations.pageTitle,
    robots: { index: false, follow: false },
  };
}

export default async function CourseTranslationsPage({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/translations/[locale]">) {
  const { lang, id, locale } = await params;
  if (!hasLocale(lang)) notFound();
  if (!hasLocale(locale)) notFound();

  const user = await requireCreator(lang);
  const course = await getCourseById(id);
  if (!course || course.creatorId !== user.id) notFound();
  if (course.defaultLocale === locale) {
    // No translation needed — the source IS this locale.
    notFound();
  }

  const [dict, lessons] = await Promise.all([
    getDictionary(lang),
    listLessonsForCourse(course.id),
  ]);

  const lessonIds = lessons.map((l) => l.id);
  const blocksByLesson = await Promise.all(
    lessonIds.map((lid) => listBlocksForLesson(lid)),
  );
  const allBlocks = blocksByLesson.flat();
  const blockIds = allBlocks.map((b) => b.id);

  const [courseTranslation, lessonTranslations, blockTranslations] = await Promise.all([
    getCourseTranslation(course.id, locale),
    listLessonTranslationsByIds(lessonIds, locale),
    listContentBlockTranslationsByIds(blockIds, locale),
  ]);

  const localeLabel =
    locale === "es"
      ? dict.creator.translations.localeEs
      : dict.creator.translations.localeEn;
  const sourceLocaleLabel =
    course.defaultLocale === "es"
      ? dict.creator.translations.localeEs
      : dict.creator.translations.localeEn;

  const formDict = {
    sourceLabel: dict.creator.translations.sourceLabel.replace("{locale}", sourceLocaleLabel),
    translationLabel: dict.creator.translations.translationLabel.replace(
      "{locale}",
      localeLabel,
    ),
    saveCta: dict.creator.translations.saveCta,
    savingLabel: dict.creator.translations.savingLabel,
    savedLabel: dict.creator.translations.savedLabel,
    genericError: dict.creator.translations.genericError,
    noSource: dict.creator.translations.noSource,
    notTranslatable: dict.creator.translations.notTranslatable,
    notTranslatableHint: dict.creator.translations.notTranslatableHint,
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
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

      <header className="mb-8 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {dict.creator.translations.eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {dict.creator.translations.headingTemplate
            .replace("{course}", course.title)
            .replace("{locale}", localeLabel)}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {dict.creator.translations.intro}
        </p>
      </header>

      <section
        aria-labelledby="course-section"
        className="rounded-lg border border-black/10 p-5 dark:border-white/15"
      >
        <h2 id="course-section" className="text-lg font-semibold">
          {dict.creator.translations.courseHeading}
        </h2>
        <div className="mt-4">
          <CourseTranslationForm
            lang={lang}
            courseId={course.id}
            locale={locale}
            source={{
              title: course.title,
              subtitle: course.subtitle,
              description: course.description,
            }}
            initial={
              courseTranslation
                ? {
                    title: courseTranslation.title,
                    subtitle: courseTranslation.subtitle,
                    description: courseTranslation.description,
                  }
                : null
            }
            dict={formDict}
            action={upsertCourseTranslation}
            labels={{
              title: dict.creator.translations.courseTitleLabel,
              subtitle: dict.creator.translations.courseSubtitleLabel,
              description: dict.creator.translations.courseDescriptionLabel,
            }}
          />
        </div>
      </section>

      <section aria-labelledby="lessons-section" className="mt-10 flex flex-col gap-6">
        <h2 id="lessons-section" className="text-lg font-semibold">
          {dict.creator.translations.lessonsHeading}
        </h2>
        {lessons.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.creator.translations.lessonsEmpty}
          </p>
        ) : (
          lessons.map((lesson, lessonIndex) => {
            const lessonTranslation = lessonTranslations.get(lesson.id);
            const blocks = blocksByLesson[lessonIndex] ?? [];
            return (
              <article
                key={lesson.id}
                className="rounded-lg border border-black/10 p-5 dark:border-white/15"
              >
                <h3 className="text-base font-semibold">
                  {String(lesson.orderIndex).padStart(2, "0")} · {lesson.title}
                </h3>
                <div className="mt-4">
                  <LessonTranslationForm
                    lang={lang}
                    lessonId={lesson.id}
                    locale={locale}
                    source={{ title: lesson.title, summary: lesson.summary }}
                    initial={
                      lessonTranslation
                        ? {
                            title: lessonTranslation.title,
                            summary: lessonTranslation.summary,
                          }
                        : null
                    }
                    dict={formDict}
                    action={upsertLessonTranslation}
                    labels={{
                      title: dict.creator.translations.lessonTitleLabel,
                      summary: dict.creator.translations.lessonSummaryLabel,
                    }}
                  />
                </div>

                {blocks.length > 0 ? (
                  <div className="mt-6 flex flex-col gap-4">
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      {dict.creator.translations.blocksHeading}
                    </h4>
                    {blocks.map((block, blockIndex) => {
                      const blockLabel = `${String(blockIndex + 1).padStart(2, "0")} · ${
                        dict.creator.blocks.types[block.type] ?? block.type
                      }`;
                      if (block.type !== "text") {
                        return (
                          <div key={block.id}>
                            <NotTranslatableNotice dict={formDict} label={blockLabel} />
                          </div>
                        );
                      }
                      const sourceMarkdown = (block.data as TextBlockData).markdown;
                      const translation = blockTranslations.get(block.id);
                      const initialMarkdown = translation
                        ? ((translation.data as TextBlockData).markdown ?? null)
                        : null;
                      return (
                        <div
                          key={block.id}
                          className="rounded-md border border-black/10 p-4 dark:border-white/15"
                        >
                          <p className="mb-3 font-mono text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            {blockLabel}
                          </p>
                          <TextBlockTranslationForm
                            lang={lang}
                            blockId={block.id}
                            locale={locale}
                            sourceMarkdown={sourceMarkdown}
                            initialMarkdown={initialMarkdown}
                            dict={formDict}
                            action={upsertTextBlockTranslation}
                            labels={{ markdown: dict.creator.translations.blockMarkdownLabel }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
