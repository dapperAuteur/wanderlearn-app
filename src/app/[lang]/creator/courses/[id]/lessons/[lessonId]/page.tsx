import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCourseById } from "@/db/queries/courses";
import { getLessonById } from "@/db/queries/lessons";
import { listBlocksForLesson } from "@/db/queries/content-blocks";
import type {
  Photo360BlockData,
  TextBlockData,
  Video360BlockData,
  VideoBlockData,
} from "@/lib/actions/content-blocks";
import { renderMarkdown } from "@/lib/markdown";
import { imageUrl, videoHlsUrl, videoPosterUrl } from "@/lib/cloudinary";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
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

  const mediaIds = Array.from(
    new Set(
      blocks.flatMap((b) => {
        if (b.type === "photo_360") return [(b.data as Photo360BlockData).mediaId];
        if (b.type === "video") return [(b.data as VideoBlockData).mediaId];
        if (b.type === "video_360") return [(b.data as Video360BlockData).mediaId];
        return [];
      }),
    ),
  );

  type MediaMeta = {
    publicId: string | null;
    secureUrl: string | null;
    transcriptMediaId: string | null;
  };
  const mediaMap = new Map<string, MediaMeta>();
  if (mediaIds.length > 0) {
    const rows = await db
      .select({
        id: schema.mediaAssets.id,
        publicId: schema.mediaAssets.cloudinaryPublicId,
        secureUrl: schema.mediaAssets.cloudinarySecureUrl,
        transcriptMediaId: schema.mediaAssets.transcriptMediaId,
      })
      .from(schema.mediaAssets)
      .where(inArray(schema.mediaAssets.id, mediaIds));
    for (const r of rows) {
      mediaMap.set(r.id, {
        publicId: r.publicId,
        secureUrl: r.secureUrl,
        transcriptMediaId: r.transcriptMediaId,
      });
    }
  }

  type RenderedBlock =
    | { block: typeof blocks[number]; kind: "text"; html: string }
    | {
        block: typeof blocks[number];
        kind: "photo_360";
        tour: VirtualTourType | null;
        caption: string | null;
      }
    | {
        block: typeof blocks[number];
        kind: "video_360";
        tour: VirtualTourType | null;
        caption: string | null;
        hasTranscript: boolean;
      }
    | {
        block: typeof blocks[number];
        kind: "video";
        hlsUrl: string | null;
        fallbackUrl: string | null;
        posterUrl: string | null;
        caption: string | null;
        hasTranscript: boolean;
      }
    | { block: typeof blocks[number]; kind: "unknown" };

  const renderedBlocks: RenderedBlock[] = await Promise.all(
    blocks.map(async (block): Promise<RenderedBlock> => {
      if (block.type === "text") {
        const data = block.data as TextBlockData;
        return { block, kind: "text", html: await renderMarkdown(data.markdown) };
      }
      if (block.type === "photo_360") {
        const data = block.data as Photo360BlockData;
        const media = mediaMap.get(data.mediaId);
        const panoramaUrl = media?.publicId
          ? imageUrl(media.publicId, { format: "auto", quality: "auto" })
          : media?.secureUrl ?? null;
        const tour: VirtualTourType | null = panoramaUrl
          ? {
              slug: block.id,
              title: data.caption ?? "",
              startSceneId: block.id,
              scenes: [
                {
                  id: block.id,
                  name: data.caption ?? "",
                  caption: data.caption ?? undefined,
                  panorama: panoramaUrl,
                  type: "photo",
                },
              ],
            }
          : null;
        return { block, kind: "photo_360", tour, caption: data.caption ?? null };
      }
      if (block.type === "video_360") {
        const data = block.data as Video360BlockData;
        const media = mediaMap.get(data.mediaId);
        const panoramaUrl = media?.publicId
          ? videoHlsUrl(media.publicId)
          : media?.secureUrl ?? null;
        const tour: VirtualTourType | null = panoramaUrl
          ? {
              slug: block.id,
              title: data.caption ?? "",
              startSceneId: block.id,
              scenes: [
                {
                  id: block.id,
                  name: data.caption ?? "",
                  caption: data.caption ?? undefined,
                  panorama: panoramaUrl,
                  type: "video",
                },
              ],
            }
          : null;
        return {
          block,
          kind: "video_360",
          tour,
          caption: data.caption ?? null,
          hasTranscript: (media?.transcriptMediaId ?? null) !== null,
        };
      }
      if (block.type === "video") {
        const data = block.data as VideoBlockData;
        const media = mediaMap.get(data.mediaId);
        return {
          block,
          kind: "video",
          hlsUrl: media?.publicId ? videoHlsUrl(media.publicId) : null,
          fallbackUrl: media?.secureUrl ?? null,
          posterUrl: media?.publicId ? videoPosterUrl(media.publicId, 1200) : null,
          caption: data.caption ?? null,
          hasTranscript: (media?.transcriptMediaId ?? null) !== null,
        };
      }
      return { block, kind: "unknown" };
    }),
  );

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
                rendered.kind === "video_360";
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

                  {rendered.kind === "text" ? (
                    <div
                      className="prose prose-zinc dark:prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: rendered.html }}
                    />
                  ) : rendered.kind === "photo_360" ? (
                    rendered.tour ? (
                      <div className="flex flex-col gap-2">
                        <div className="overflow-hidden rounded-md border border-black/10 dark:border-white/15">
                          <VirtualTour tour={rendered.tour} height="40vh" />
                        </div>
                        {rendered.caption ? (
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {rendered.caption}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs italic text-amber-700 dark:text-amber-400">
                        {dict.creator.blocks.photo360Missing}
                      </p>
                    )
                  ) : rendered.kind === "video_360" ? (
                    rendered.tour ? (
                      <div className="flex flex-col gap-2">
                        <div className="overflow-hidden rounded-md border border-black/10 dark:border-white/15">
                          <VirtualTour tour={rendered.tour} height="40vh" />
                        </div>
                        {rendered.caption ? (
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {rendered.caption}
                          </p>
                        ) : null}
                        {!rendered.hasTranscript ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {dict.creator.blocks.videoNoTranscriptPreview}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs italic text-amber-700 dark:text-amber-400">
                        {dict.creator.blocks.video360Missing}
                      </p>
                    )
                  ) : rendered.kind === "video" ? (
                    rendered.hlsUrl || rendered.fallbackUrl ? (
                      <div className="flex flex-col gap-2">
                        <video
                          controls
                          preload="metadata"
                          poster={rendered.posterUrl ?? undefined}
                          className="w-full rounded-md border border-black/10 dark:border-white/15"
                        >
                          {rendered.hlsUrl ? (
                            <source src={rendered.hlsUrl} type="application/vnd.apple.mpegurl" />
                          ) : null}
                          {rendered.fallbackUrl ? (
                            <source src={rendered.fallbackUrl} />
                          ) : null}
                        </video>
                        {rendered.caption ? (
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {rendered.caption}
                          </p>
                        ) : null}
                        {!rendered.hasTranscript ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {dict.creator.blocks.videoNoTranscriptPreview}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs italic text-amber-700 dark:text-amber-400">
                        {dict.creator.blocks.videoMissing}
                      </p>
                    )
                  ) : (
                    <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                      {dict.creator.blocks.rendererComingSoon}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
