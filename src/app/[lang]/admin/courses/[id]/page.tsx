import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCourseById } from "@/db/queries/courses";
import { listLessonsForCourse } from "@/db/queries/lessons";
import { checkCoursePublishReadiness } from "@/lib/publish-gates";
import { approveCourse, unpublishCourse } from "@/lib/actions/courses";
import { hasLocale } from "@/lib/locales";
import { requireAdmin } from "@/lib/rbac";
import { AdminReviewControls } from "./review-controls";
import { getDictionary } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/courses/[id]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.adminCourses.reviewTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminCourseReviewDetailPage({
  params,
}: PageProps<"/[lang]/admin/courses/[id]">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdmin(lang);

  const course = await getCourseById(id);
  if (!course) notFound();

  const [dict, lessons, violations, creatorRow] = await Promise.all([
    getDictionary(lang),
    listLessonsForCourse(course.id),
    checkCoursePublishReadiness(course.id),
    db
      .select({ name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, course.creatorId))
      .limit(1),
  ]);
  const creator = creatorRow[0];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/admin/courses`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.adminCourses.inboxTitle}
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{course.title}</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {creator?.name ?? creator?.email ?? course.creatorId} ·{" "}
          {dict.creator.courses.statuses[course.status] ?? course.status}
        </p>
        {course.subtitle ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-200">{course.subtitle}</p>
        ) : null}
      </header>

      <section
        aria-labelledby="review-controls-heading"
        className="mt-6 rounded-lg border border-black/10 p-5 dark:border-white/15"
      >
        <h2 id="review-controls-heading" className="text-lg font-semibold">
          {dict.adminCourses.controlsHeading}
        </h2>
        <AdminReviewControls
          lang={lang}
          courseId={course.id}
          courseStatus={course.status}
          violations={violations}
          approveAction={approveCourse}
          unpublishAction={unpublishCourse}
          dict={dict.adminCourses.controls}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{dict.adminCourses.lessonsHeading}</h2>
        {lessons.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-black/15 p-5 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.adminCourses.lessonsEmpty}
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {lessons.map((l) => (
              <li
                key={l.id}
                className="rounded-md border border-black/10 p-3 dark:border-white/15"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{l.title}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {dict.creator.lessons.statuses[l.status] ?? l.status}
                  </span>
                </div>
                {l.summary ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {l.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
