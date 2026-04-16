import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseById } from "@/db/queries/courses";
import { listDestinations } from "@/db/queries/destinations";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { deleteCourse, updateCourse } from "@/lib/actions/courses";
import { CourseForm } from "../../course-form";
import { DeleteCourseButton } from "../delete-button";
import { getDictionary } from "../../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/edit">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!hasLocale(lang)) return {};
  const course = await getCourseById(id);
  if (!course) return { title: "Course not found" };
  return {
    title: course.title,
    description: course.description ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function EditCoursePage({
  params,
}: PageProps<"/[lang]/creator/courses/[id]/edit">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const course = await getCourseById(id);
  if (!course || course.creatorId !== user.id) notFound();
  const [dict, destinations] = await Promise.all([
    getDictionary(lang),
    listDestinations(),
  ]);

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
      <h1 className="text-3xl font-semibold tracking-tight">
        {dict.creator.courses.editHeading}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.courses.editSubtitle}
      </p>

      <CourseForm
        dict={dict.creator.courses.form}
        lang={lang}
        destinations={destinations.map((d) => ({ id: d.id, name: d.name }))}
        initial={{
          id: course.id,
          title: course.title,
          slug: course.slug,
          subtitle: course.subtitle,
          description: course.description,
          destinationId: course.destinationId,
          priceCents: course.priceCents,
          defaultLocale: course.defaultLocale,
        }}
        action={updateCourse}
      />

      <section
        aria-labelledby="danger-zone"
        className="mt-12 rounded-lg border border-red-500/30 p-6 dark:border-red-500/40"
      >
        <h2 id="danger-zone" className="text-lg font-semibold text-red-700 dark:text-red-400">
          {dict.creator.courses.dangerZone}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.creator.courses.deleteWarning}
        </p>
        <DeleteCourseButton
          id={course.id}
          name={course.title}
          lang={lang}
          dict={dict.creator.courses.deleteButton}
          action={deleteCourse}
        />
      </section>
    </main>
  );
}
