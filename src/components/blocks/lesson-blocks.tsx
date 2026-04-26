import { inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type {
  Photo360BlockData,
  QuizBlockData,
  TextBlockData,
  Video360BlockData,
  VideoBlockData,
  VirtualTourBlockData,
} from "@/lib/actions/content-blocks";
import {
  imageUrl,
  video360PanoramaUrl,
  videoHlsUrl,
  videoPosterUrl,
} from "@/lib/cloudinary";
import { renderMarkdown } from "@/lib/markdown";
import { assembleTour } from "@/lib/assemble-tour";
import { getDestinationById } from "@/db/queries/destinations";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { QuizPlayer, type QuizPlayerDict } from "@/components/blocks/quiz-player";

export type LessonBlockRow = typeof schema.contentBlocks.$inferSelect;

export type RendererDict = {
  photo360Missing: string;
  video360Missing: string;
  videoMissing: string;
  videoNoTranscriptPreview: string;
  rendererComingSoon: string;
  virtualTourMissing: string;
  flatViewLabel: string;
  flatViewHint: string;
  types: Record<string, string>;
  quiz: QuizPlayerDict;
};

export type RenderedBlock =
  | { block: LessonBlockRow; kind: "text"; html: string }
  | {
      block: LessonBlockRow;
      kind: "photo_360";
      tour: VirtualTourType | null;
      caption: string | null;
      posterUrl: string | null;
    }
  | {
      block: LessonBlockRow;
      kind: "video_360";
      tour: VirtualTourType | null;
      caption: string | null;
      hasTranscript: boolean;
      posterUrl: string | null;
    }
  | {
      block: LessonBlockRow;
      kind: "video";
      hlsUrl: string | null;
      fallbackUrl: string | null;
      posterUrl: string | null;
      caption: string | null;
      hasTranscript: boolean;
    }
  | {
      block: LessonBlockRow;
      kind: "virtual_tour";
      tour: VirtualTourType | null;
      caption: string | null;
    }
  | { block: LessonBlockRow; kind: "quiz"; data: QuizBlockData }
  | { block: LessonBlockRow; kind: "unknown" };

function blockMediaId(block: LessonBlockRow): string | null {
  if (block.type === "photo_360") return (block.data as Photo360BlockData).mediaId;
  if (block.type === "video") return (block.data as VideoBlockData).mediaId;
  if (block.type === "video_360") return (block.data as Video360BlockData).mediaId;
  return null;
}

export async function resolveLessonBlocks(
  blocks: LessonBlockRow[],
  opts?: { courseCreatorId?: string },
): Promise<RenderedBlock[]> {
  const mediaIds = Array.from(
    new Set(blocks.map(blockMediaId).filter((id): id is string => id !== null)),
  );

  const mediaMap = new Map<
    string,
    { publicId: string | null; secureUrl: string | null; transcriptMediaId: string | null }
  >();
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

  return Promise.all(
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
        // Flat 2D poster derived at delivery time. For photo_360 the panorama
        // itself is a valid flat image — we just ask Cloudinary to render it
        // as a bounded JPG at a reasonable width for the fallback link.
        const posterUrl = media?.publicId
          ? imageUrl(media.publicId, { format: "jpg", quality: "auto", width: 1600 })
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
        return { block, kind: "photo_360", tour, caption: data.caption ?? null, posterUrl };
      }
      if (block.type === "video_360") {
        const data = block.data as Video360BlockData;
        const media = mediaMap.get(data.mediaId);
        const panoramaUrl = media?.publicId
          ? video360PanoramaUrl(media.publicId)
          : media?.secureUrl ?? null;
        // Flat 2D poster derived from the first frame via Cloudinary's so_0
        // transform. That's the learner-facing fallback when WebGL isn't
        // available or the learner just wants to see a still image.
        const posterUrl = media?.publicId
          ? videoPosterUrl(media.publicId, 1600)
          : null;
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
          posterUrl,
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
      if (block.type === "quiz") {
        return { block, kind: "quiz", data: block.data as QuizBlockData };
      }
      if (block.type === "virtual_tour") {
        const data = block.data as VirtualTourBlockData;
        if (!opts?.courseCreatorId) {
          return { block, kind: "virtual_tour", tour: null, caption: data.caption ?? null };
        }
        const destination = await getDestinationById(data.destinationId);
        const assembled = await assembleTour({
          destinationId: data.destinationId,
          creatorId: opts.courseCreatorId,
          startSceneId: data.startSceneId ?? null,
          title: data.caption ?? "",
          arrowColor: destination?.tourArrowColor,
          pinColor: destination?.tourPinColor,
        });
        return {
          block,
          kind: "virtual_tour",
          tour: assembled.ok ? assembled.tour : null,
          caption: data.caption ?? null,
        };
      }
      return { block, kind: "unknown" };
    }),
  );
}

export function LessonBlockMedia({
  block,
  dict,
  height = "60vh",
}: {
  block: RenderedBlock;
  dict: RendererDict;
  height?: string;
}) {
  if (block.kind === "text") {
    return (
      <div
        className="prose prose-zinc dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    );
  }
  if (block.kind === "photo_360") {
    if (!block.tour) {
      return (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:text-amber-300">
          {dict.photo360Missing}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
          <VirtualTour tour={block.tour} height={height} />
        </div>
        {block.caption ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{block.caption}</p>
        ) : null}
        <FlatView posterUrl={block.posterUrl} dict={dict} />
      </div>
    );
  }
  if (block.kind === "video_360") {
    if (!block.tour) {
      return (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:text-amber-300">
          {dict.video360Missing}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
          <VirtualTour tour={block.tour} height={height} />
        </div>
        {block.caption ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{block.caption}</p>
        ) : null}
        <FlatView posterUrl={block.posterUrl} dict={dict} />
      </div>
    );
  }
  if (block.kind === "video") {
    if (!block.hlsUrl && !block.fallbackUrl) {
      return (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:text-amber-300">
          {dict.videoMissing}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <video
          controls
          preload="metadata"
          poster={block.posterUrl ?? undefined}
          className="w-full rounded-lg border border-black/10 dark:border-white/15"
        >
          {block.hlsUrl ? (
            <source src={block.hlsUrl} type="application/vnd.apple.mpegurl" />
          ) : null}
          {block.fallbackUrl ? <source src={block.fallbackUrl} /> : null}
        </video>
        {block.caption ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{block.caption}</p>
        ) : null}
      </div>
    );
  }
  if (block.kind === "quiz") {
    return <QuizPlayer data={block.data} dict={dict.quiz} />;
  }
  if (block.kind === "virtual_tour") {
    if (!block.tour) {
      return (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:text-amber-300">
          {dict.virtualTourMissing}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
          <VirtualTour tour={block.tour} height={height} />
        </div>
        {block.caption ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{block.caption}</p>
        ) : null}
      </div>
    );
  }
  return (
    <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-xs italic text-zinc-500 dark:border-white/15 dark:bg-white/5 dark:text-zinc-400">
      {dict.rendererComingSoon}
    </p>
  );
}

function FlatView({
  posterUrl,
  dict,
}: {
  posterUrl: string | null;
  dict: RendererDict;
}) {
  if (!posterUrl) return null;
  return (
    <p className="text-xs text-zinc-500 dark:text-zinc-400">
      <a
        href={posterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {dict.flatViewLabel}
      </a>{" "}
      <span>· {dict.flatViewHint}</span>
    </p>
  );
}

export function LessonBlocksList({
  rendered,
  dict,
  variant = "player",
}: {
  rendered: RenderedBlock[];
  dict: RendererDict;
  variant?: "player" | "preview";
}) {
  const mediaHeight = variant === "player" ? "60vh" : "40vh";
  return (
    <ol className="flex flex-col gap-8">
      {rendered.map((block) => (
        <li key={block.block.id} className="flex flex-col gap-3">
          <LessonBlockMedia block={block} dict={dict} height={mediaHeight} />
        </li>
      ))}
    </ol>
  );
}

