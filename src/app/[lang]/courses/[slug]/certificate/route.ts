import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getPublishedCourseBySlug } from "@/db/queries/courses";
import { listPublishedLessonsForCourse } from "@/db/queries/lessons";
import {
  getCourseTranslation,
} from "@/db/queries/translations";
import { getEnrollment } from "@/db/queries/enrollments";
import { listProgressForEnrollment } from "@/db/queries/lesson-progress";
import { getSession } from "@/lib/rbac";
import { hasLocale } from "@/lib/locales";
import { applyCourseTranslation, shouldTranslate } from "@/lib/translate";
import { absoluteUrl } from "@/lib/site";
import { renderCourseCertificatePdf } from "@/lib/certificate";
import { getDictionary } from "@/app/[lang]/dictionaries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const session = await getSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/${lang}/sign-in?from=${encodeURIComponent(`/${lang}/courses/${slug}/certificate`)}`,
        absoluteUrl("/"),
      ),
    );
  }

  const baseCourse = await getPublishedCourseBySlug(slug);
  if (!baseCourse) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const enrollment = await getEnrollment(user.id, baseCourse.id);
  if (!enrollment || enrollment.revokedAt !== null) {
    return NextResponse.json({ ok: false, error: "not_enrolled" }, { status: 403 });
  }

  const lessons = await listPublishedLessonsForCourse(baseCourse.id);
  if (lessons.length === 0) {
    return NextResponse.json({ ok: false, error: "no_lessons" }, { status: 400 });
  }

  const progress = await listProgressForEnrollment(enrollment.id);
  const completedLessonIds = new Set(
    progress.filter((p) => p.status === "completed").map((p) => p.lessonId),
  );
  const allCompleted = lessons.every((l) => completedLessonIds.has(l.id));
  if (!allCompleted) {
    return NextResponse.json({ ok: false, error: "not_complete" }, { status: 403 });
  }

  const latestCompletedAt = progress.reduce<Date | null>((acc, p) => {
    if (p.status !== "completed") return acc;
    const t = p.completedAt ?? p.updatedAt;
    if (!t) return acc;
    if (!acc || t > acc) return t;
    return acc;
  }, null);
  const completedAt = latestCompletedAt ?? new Date();

  const translation = shouldTranslate(lang, baseCourse.defaultLocale)
    ? await getCourseTranslation(baseCourse.id, lang)
    : null;
  const course = applyCourseTranslation(baseCourse, translation);

  const [dbUser] = await db
    .select({ name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  const learnerName = dbUser?.name?.trim() || dbUser?.email || user.email || "Learner";

  const dict = await getDictionary(lang);
  const verifyUrl = absoluteUrl(`/${lang}/courses/${baseCourse.slug}`);

  const pdf = await renderCourseCertificatePdf({
    courseTitle: course.title,
    learnerName,
    completedAt,
    verifyUrl,
    dict: dict.certificate,
  });

  const filename = `wanderlearn-${baseCourse.slug}-certificate.pdf`;
  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
