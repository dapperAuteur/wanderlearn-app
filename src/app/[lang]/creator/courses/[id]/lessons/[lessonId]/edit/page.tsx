import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseById } from "@/db/queries/courses";
import { getLessonById } from "@/db/queries/lessons";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { deleteLesson, updateLesson } from "@/lib/actions/lessons";
import { LessonForm } from "../../lesson-form";
import { DeleteLessonButton } from "../delete-button";
import { getDictionary } from "../../../../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]/edit">): Promise<Metadata> {
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

export default async function EditLessonPage({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]/edit">) {
  const { lang, id, lessonId } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const [course, lesson] = await Promise.all([
    getCourseById(id),
    getLessonById(lessonId),
  ]);
  if (!course || course.creatorId !== user.id) notFound();
  if (!lesson || lesson.courseId !== course.id) notFound();
  const dict = await getDictionary(lang);

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
        <Link
          href={`/${lang}/creator/courses/${course.id}/lessons/${lesson.id}`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {lesson.title}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">
        {dict.creator.lessons.editHeading}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.lessons.editSubtitle}
      </p>

      <LessonForm
        courseId={course.id}
        lang={lang}
        dict={dict.creator.lessons.form}
        initial={{
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          summary: lesson.summary,
          status: lesson.status,
          isFreePreview: lesson.isFreePreview,
          estimatedMinutes: lesson.estimatedMinutes,
          orderIndex: lesson.orderIndex,
        }}
        action={updateLesson}
      />

      <section
        aria-labelledby="danger-zone"
        className="mt-12 rounded-lg border border-red-500/30 p-6 dark:border-red-500/40"
      >
        <h2 id="danger-zone" className="text-lg font-semibold text-red-700 dark:text-red-400">
          {dict.creator.lessons.dangerZone}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.creator.lessons.deleteWarning}
        </p>
        <DeleteLessonButton
          id={lesson.id}
          courseId={course.id}
          name={lesson.title}
          lang={lang}
          dict={dict.creator.lessons.deleteButton}
          action={deleteLesson}
        />
      </section>
    </main>
  );
}
