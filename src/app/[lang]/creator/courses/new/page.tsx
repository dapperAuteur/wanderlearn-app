import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listDestinations } from "@/db/queries/destinations";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { createCourse } from "@/lib/actions/courses";
import { CourseForm } from "../course-form";
import { getDictionary } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/courses/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.courses.newTitle,
    description: dict.creator.courses.newSubtitle,
    robots: { index: false, follow: false },
  };
}

export default async function NewCoursePage({
  params,
}: PageProps<"/[lang]/creator/courses/new">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireCreator(lang);
  const dict = await getDictionary(lang);
  const destinations = await listDestinations();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/creator/courses`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.creator.courses.title}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">
        {dict.creator.courses.newTitle}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.courses.newSubtitle}
      </p>
      <CourseForm
        dict={dict.creator.courses.form}
        lang={lang}
        destinations={destinations.map((d) => ({ id: d.id, name: d.name }))}
        action={createCourse}
      />
    </main>
  );
}
