import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseById } from "@/db/queries/courses";
import { getLessonById } from "@/db/queries/lessons";
import { getBlockById } from "@/db/queries/content-blocks";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { updateTextBlock, type TextBlockData } from "@/lib/actions/content-blocks";
import { TextBlockForm } from "../../text-block-form";
import { getDictionary } from "../../../../../../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]/blocks/[blockId]/edit">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.blocks.editTextTitle,
    robots: { index: false, follow: false },
  };
}

export default async function EditBlockPage({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]/blocks/[blockId]/edit">) {
  const { lang, id, lessonId, blockId } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const [course, lesson, block] = await Promise.all([
    getCourseById(id),
    getLessonById(lessonId),
    getBlockById(blockId),
  ]);
  if (!course || course.creatorId !== user.id) notFound();
  if (!lesson || lesson.courseId !== course.id) notFound();
  if (!block || block.lessonId !== lesson.id) notFound();
  if (block.type !== "text") notFound();

  const dict = await getDictionary(lang);
  const data = block.data as TextBlockData;

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
        {dict.creator.blocks.editTextTitle}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.blocks.editTextSubtitle}
      </p>
      <TextBlockForm
        lang={lang}
        courseId={course.id}
        lessonId={lesson.id}
        initial={{ id: block.id, markdown: data.markdown }}
        dict={dict.creator.blocks.textForm}
        action={updateTextBlock}
        mode="edit"
      />
    </main>
  );
}
