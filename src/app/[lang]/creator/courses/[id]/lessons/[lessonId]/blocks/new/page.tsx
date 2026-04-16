import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseById } from "@/db/queries/courses";
import { getLessonById } from "@/db/queries/lessons";
import { listPhoto360ForOwner } from "@/db/queries/scenes";
import {
  listStandardVideosForOwner,
  listVideo360ForOwner,
} from "@/db/queries/media";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import {
  createPhoto360Block,
  createTextBlock,
  createVideo360Block,
  createVideoBlock,
} from "@/lib/actions/content-blocks";
import { posterUrlFor, videoPosterUrl } from "@/lib/cloudinary";
import { TextBlockForm } from "../text-block-form";
import {
  Photo360BlockForm,
  type Photo360Option,
} from "../photo-360-block-form";
import { VideoBlockForm, type VideoOption } from "../video-block-form";
import { getDictionary } from "../../../../../../../dictionaries";

export const dynamic = "force-dynamic";

type BlockType = "text" | "photo_360" | "video" | "video_360";

function readBlockType(raw: unknown): BlockType {
  if (raw === "photo_360") return "photo_360";
  if (raw === "video") return "video";
  if (raw === "video_360") return "video_360";
  return "text";
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[lang]/creator/courses/[id]/lessons/[lessonId]/blocks/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const query = await searchParams;
  const blockType = readBlockType(query?.type);
  if (blockType === "photo_360") {
    return {
      title: dict.creator.blocks.newPhoto360Title,
      description: dict.creator.blocks.newPhoto360Subtitle,
      robots: { index: false, follow: false },
    };
  }
  if (blockType === "video") {
    return {
      title: dict.creator.blocks.newVideoTitle,
      description: dict.creator.blocks.newVideoSubtitle,
      robots: { index: false, follow: false },
    };
  }
  if (blockType === "video_360") {
    return {
      title: dict.creator.blocks.newVideo360Title,
      description: dict.creator.blocks.newVideo360Subtitle,
      robots: { index: false, follow: false },
    };
  }
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
  const blockType = readBlockType(query?.type);
  const dict = await getDictionary(lang);

  const breadcrumb = (
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
  );

  if (blockType === "photo_360") {
    const rows = await listPhoto360ForOwner(user.id);
    const options: Photo360Option[] = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      thumbnailUrl: row.cloudinaryPublicId
        ? posterUrlFor("photo_360", row.cloudinaryPublicId, 480)
        : row.cloudinarySecureUrl,
    }));

    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {breadcrumb}
        <h1 className="text-3xl font-semibold tracking-tight">
          {dict.creator.blocks.newPhoto360Title}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          {dict.creator.blocks.newPhoto360Subtitle}
        </p>
        <Photo360BlockForm
          lang={lang}
          courseId={course.id}
          lessonId={lesson.id}
          options={options}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.blocks.photo360Form}
          action={createPhoto360Block}
          mode="new"
        />
      </main>
    );
  }

  if (blockType === "video_360") {
    const rows = await listVideo360ForOwner(user.id);
    const options: Photo360Option[] = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      thumbnailUrl: row.cloudinaryPublicId
        ? videoPosterUrl(row.cloudinaryPublicId, 480)
        : row.cloudinarySecureUrl,
    }));

    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {breadcrumb}
        <h1 className="text-3xl font-semibold tracking-tight">
          {dict.creator.blocks.newVideo360Title}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          {dict.creator.blocks.newVideo360Subtitle}
        </p>
        <Photo360BlockForm
          lang={lang}
          courseId={course.id}
          lessonId={lesson.id}
          options={options}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.blocks.video360Form}
          action={createVideo360Block}
          mode="new"
        />
      </main>
    );
  }

  if (blockType === "video") {
    const rows = await listStandardVideosForOwner(user.id);
    const options: VideoOption[] = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      thumbnailUrl: row.cloudinaryPublicId
        ? videoPosterUrl(row.cloudinaryPublicId, 480)
        : row.cloudinarySecureUrl,
      hasTranscript: row.transcriptMediaId !== null,
      durationSeconds: row.durationSeconds,
    }));

    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {breadcrumb}
        <h1 className="text-3xl font-semibold tracking-tight">
          {dict.creator.blocks.newVideoTitle}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          {dict.creator.blocks.newVideoSubtitle}
        </p>
        <VideoBlockForm
          lang={lang}
          courseId={course.id}
          lessonId={lesson.id}
          options={options}
          mediaLibraryHref={`/${lang}/creator/media`}
          dict={dict.creator.blocks.videoForm}
          action={createVideoBlock}
          mode="new"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {breadcrumb}
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
