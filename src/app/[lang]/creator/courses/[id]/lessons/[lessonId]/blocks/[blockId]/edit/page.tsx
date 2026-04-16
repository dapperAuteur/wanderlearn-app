import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCourseById } from "@/db/queries/courses";
import { getLessonById } from "@/db/queries/lessons";
import { getBlockById } from "@/db/queries/content-blocks";
import { listPhoto360ForOwner } from "@/db/queries/scenes";
import {
  listStandardVideosForOwner,
  listVideo360ForOwner,
} from "@/db/queries/media";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import {
  updatePhoto360Block,
  updateTextBlock,
  updateVideo360Block,
  updateVideoBlock,
  updateVirtualTourBlock,
  type Photo360BlockData,
  type TextBlockData,
  type Video360BlockData,
  type VideoBlockData,
  type VirtualTourBlockData,
} from "@/lib/actions/content-blocks";
import { posterUrlFor, videoPosterUrl } from "@/lib/cloudinary";
import { TextBlockForm } from "../../text-block-form";
import {
  Photo360BlockForm,
  type Photo360Option,
} from "../../photo-360-block-form";
import { VideoBlockForm, type VideoOption } from "../../video-block-form";
import {
  VirtualTourBlockForm,
  type DestinationOption,
  type SceneOption,
} from "../../virtual-tour-block-form";
import { getDictionary } from "../../../../../../../../dictionaries";

async function loadOwnerDestinationsAndScenes(userId: string): Promise<{
  destinations: DestinationOption[];
  scenes: SceneOption[];
}> {
  const rows = await db
    .select({
      destinationId: schema.destinations.id,
      destinationName: schema.destinations.name,
      sceneId: schema.scenes.id,
      sceneName: schema.scenes.name,
    })
    .from(schema.scenes)
    .innerJoin(
      schema.destinations,
      eq(schema.destinations.id, schema.scenes.destinationId),
    )
    .where(eq(schema.scenes.ownerId, userId))
    .orderBy(asc(schema.destinations.name), asc(schema.scenes.createdAt));
  const destMap = new Map<string, DestinationOption>();
  const scenes: SceneOption[] = [];
  for (const r of rows) {
    scenes.push({ id: r.sceneId, destinationId: r.destinationId, name: r.sceneName });
    const existing = destMap.get(r.destinationId);
    if (existing) existing.sceneCount += 1;
    else
      destMap.set(r.destinationId, {
        id: r.destinationId,
        name: r.destinationName,
        sceneCount: 1,
      });
  }
  return { destinations: Array.from(destMap.values()), scenes };
}

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
  if (
    block.type !== "text" &&
    block.type !== "photo_360" &&
    block.type !== "video" &&
    block.type !== "video_360" &&
    block.type !== "virtual_tour"
  ) {
    notFound();
  }

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

  if (block.type === "virtual_tour") {
    const data = block.data as VirtualTourBlockData;
    const { destinations, scenes } = await loadOwnerDestinationsAndScenes(user.id);

    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {breadcrumb}
        <h1 className="text-3xl font-semibold tracking-tight">
          {dict.creator.blocks.editVirtualTourTitle}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          {dict.creator.blocks.editVirtualTourSubtitle}
        </p>
        <VirtualTourBlockForm
          lang={lang}
          courseId={course.id}
          lessonId={lesson.id}
          destinations={destinations}
          scenes={scenes}
          destinationsHref={`/${lang}/creator/destinations`}
          initial={{
            id: block.id,
            destinationId: data.destinationId,
            startSceneId: data.startSceneId,
            caption: data.caption,
          }}
          dict={dict.creator.blocks.virtualTourForm}
          action={updateVirtualTourBlock}
          mode="edit"
        />
      </main>
    );
  }

  if (block.type === "video_360") {
    const data = block.data as Video360BlockData;
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
          {dict.creator.blocks.editVideo360Title}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          {dict.creator.blocks.editVideo360Subtitle}
        </p>
        <Photo360BlockForm
          lang={lang}
          courseId={course.id}
          lessonId={lesson.id}
          options={options}
          mediaLibraryHref={`/${lang}/creator/media`}
          initial={{ id: block.id, mediaId: data.mediaId, caption: data.caption }}
          dict={dict.creator.blocks.video360Form}
          action={updateVideo360Block}
          mode="edit"
        />
      </main>
    );
  }

  if (block.type === "video") {
    const data = block.data as VideoBlockData;
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
          {dict.creator.blocks.editVideoTitle}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          {dict.creator.blocks.editVideoSubtitle}
        </p>
        <VideoBlockForm
          lang={lang}
          courseId={course.id}
          lessonId={lesson.id}
          options={options}
          mediaLibraryHref={`/${lang}/creator/media`}
          initial={{ id: block.id, mediaId: data.mediaId, caption: data.caption }}
          dict={dict.creator.blocks.videoForm}
          action={updateVideoBlock}
          mode="edit"
        />
      </main>
    );
  }

  if (block.type === "photo_360") {
    const data = block.data as Photo360BlockData;
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
          {dict.creator.blocks.editPhoto360Title}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          {dict.creator.blocks.editPhoto360Subtitle}
        </p>
        <Photo360BlockForm
          lang={lang}
          courseId={course.id}
          lessonId={lesson.id}
          options={options}
          mediaLibraryHref={`/${lang}/creator/media`}
          initial={{ id: block.id, mediaId: data.mediaId, caption: data.caption }}
          dict={dict.creator.blocks.photo360Form}
          action={updatePhoto360Block}
          mode="edit"
        />
      </main>
    );
  }

  const data = block.data as TextBlockData;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {breadcrumb}
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
