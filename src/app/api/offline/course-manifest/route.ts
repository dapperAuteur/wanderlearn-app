import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getSession } from "@/lib/rbac";
import { hasLocale } from "@/lib/locales";
import {
  imageUrl,
  video360PanoramaUrl,
  videoPosterUrl,
} from "@/lib/cloudinary-urls";
import type {
  Photo360BlockData,
  Video360BlockData,
  VideoBlockData,
} from "@/lib/actions/content-blocks";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  courseId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

// The SW fetches this endpoint when the learner toggles "Save for offline."
// Returns every URL the course needs so the SW can cache.put() each one.
//
// Included:
// - Course detail page in the given locale
// - Every published lesson's player URL in that locale
// - Cloudinary image URLs for each photo_360 (flat JPG), video_360 poster
//   still, standard-video poster, and course cover
//
// Explicitly NOT included:
// - HLS manifests or MP4 video bodies (opt-in aggressive would still blow
//   through storage for 360° video; current v1 caches posters only)
// - Creator/admin surfaces
// - API URLs

export async function GET(request: Request) {
  const session = await getSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    courseId: url.searchParams.get("courseId"),
    lang: url.searchParams.get("lang"),
  });
  if (!parsed.success || !hasLocale(parsed.data.lang)) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }

  const [enrollment] = await db
    .select({
      id: schema.enrollments.id,
      revokedAt: schema.enrollments.revokedAt,
    })
    .from(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.userId, user.id),
        eq(schema.enrollments.courseId, parsed.data.courseId),
      ),
    )
    .limit(1);
  if (!enrollment || enrollment.revokedAt !== null) {
    return NextResponse.json(
      { ok: false, error: "not_enrolled" },
      { status: 403 });
  }

  const [course] = await db
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      coverMediaId: schema.courses.coverMediaId,
      status: schema.courses.status,
    })
    .from(schema.courses)
    .where(eq(schema.courses.id, parsed.data.courseId))
    .limit(1);
  if (!course || course.status !== "published") {
    return NextResponse.json(
      { ok: false, error: "not_available" },
      { status: 404 },
    );
  }

  const lessons = await db
    .select({ id: schema.lessons.id, slug: schema.lessons.slug })
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.courseId, course.id),
        eq(schema.lessons.status, "published"),
      ),
    );

  const lessonIds = lessons.map((l) => l.id);
  const blocks = lessonIds.length
    ? await db
        .select({
          type: schema.contentBlocks.type,
          data: schema.contentBlocks.data,
        })
        .from(schema.contentBlocks)
        .where(inArray(schema.contentBlocks.lessonId, lessonIds))
    : [];

  const mediaIds = Array.from(
    new Set(
      [
        course.coverMediaId,
        ...blocks
          .map((b) => {
            if (b.type === "photo_360") return (b.data as Photo360BlockData).mediaId;
            if (b.type === "video_360") return (b.data as Video360BlockData).mediaId;
            if (b.type === "video") return (b.data as VideoBlockData).mediaId;
            return null;
          })
          .filter((id): id is string => id !== null),
      ].filter((id): id is string => id !== null),
    ),
  );

  const mediaRows = mediaIds.length
    ? await db
        .select({
          id: schema.mediaAssets.id,
          kind: schema.mediaAssets.kind,
          publicId: schema.mediaAssets.cloudinaryPublicId,
        })
        .from(schema.mediaAssets)
        .where(inArray(schema.mediaAssets.id, mediaIds))
    : [];

  const assetUrls = new Set<string>();
  // Course detail page + every published lesson page, in the requested
  // locale only. Cross-locale caching is out of scope for v1.
  assetUrls.add(`/${parsed.data.lang}/courses/${course.slug}`);
  for (const l of lessons) {
    assetUrls.add(`/${parsed.data.lang}/learn/${course.slug}/${l.slug}`);
  }
  // Cloudinary images per media asset. Matches what the learner player
  // renders as 2D fallback + what the runtime cache would see during a
  // normal browse.
  for (const m of mediaRows) {
    if (!m.publicId) continue;
    if (m.kind === "photo_360") {
      assetUrls.add(
        imageUrl(m.publicId, { format: "jpg", quality: "auto", width: 1600 }),
      );
    } else if (m.kind === "video_360") {
      assetUrls.add(videoPosterUrl(m.publicId, 1600));
      // The MP4 panorama for video_360. Opt-in because it's large, but the
      // whole point of "Save for offline" is that the user opted in.
      assetUrls.add(video360PanoramaUrl(m.publicId));
    } else if (m.kind === "standard_video" || m.kind === "drone_video") {
      assetUrls.add(videoPosterUrl(m.publicId, 1200));
    } else if (m.kind === "image") {
      assetUrls.add(imageUrl(m.publicId, { width: 1600 }));
    }
  }

  return NextResponse.json({
    ok: true,
    courseId: course.id,
    courseSlug: course.slug,
    urls: Array.from(assetUrls),
  });
}
