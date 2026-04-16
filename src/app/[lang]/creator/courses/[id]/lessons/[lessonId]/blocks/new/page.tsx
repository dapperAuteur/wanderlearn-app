import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseById } from "@/db/queries/courses";
import { getLessonById } from "@/db/queries/lessons";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { createTextBlock } from "@/lib/actions/content-blocks";
import { TextBlockForm } from "../text-block-form";
import { getDictionary } from "../../../../../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]/blocks/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.blocks.newTextTitle,
    description: dict.creator.blocks.newTextSubtitle,
    robots: { index: false, follow: false },
  };
}

export default async function NewBlockPage({
  params,
  searchParams,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]/blocks/new">) {
  const { lang, id, lessonId } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const [course, lesson] = await Promise.all([
    getCourseById(id),
    getLessonById(lessonId),
  ]);
  if (!course || course.creatorId !== user.id) notFound();
  if (!lesson || lesson.courseId !== course.id) notFound();

  const query = await searchParams;
  const blockType = typeof query?.type === "string" ? query.type : "text";
  if (blockType !== "text") {
    // Non-text types arrive in feat/content-blocks-media. Return 404 for now.
    notFound();
  }

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
        {dict.creator.blocks.newTextTitle}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.blocks.newTextSubtitle}
      </p>
      <TextBlockForm
        lang={lang}
        courseId={course.id}
        lessonId={lesson.id}
        dict={dict.creator.blocks.textForm}
        action={createTextBlock}
        mode="new"
      />
    </main>
  );
}
