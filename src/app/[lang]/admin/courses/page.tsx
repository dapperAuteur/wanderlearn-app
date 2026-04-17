import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { hasLocale } from "@/lib/locales";
import { requireAdmin } from "@/lib/rbac";
import { getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/courses">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.adminCourses.inboxTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminCourseReviewPage({
  params,
}: PageProps<"/[lang]/admin/courses">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdmin(lang);
  const dict = await getDictionary(lang);

  const courses = await db
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      title: schema.courses.title,
      status: schema.courses.status,
      creatorId: schema.courses.creatorId,
      updatedAt: schema.courses.updatedAt,
    })
    .from(schema.courses)
    .where(inArray(schema.courses.status, ["in_review", "published"]))
    .orderBy(desc(schema.courses.updatedAt));

  const creatorIds = Array.from(new Set(courses.map((c) => c.creatorId)));
  const creatorMap = new Map<string, { name: string | null; email: string | null }>();
  if (creatorIds.length > 0) {
    const rows = await db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.id, creatorIds));
    for (const r of rows) {
      creatorMap.set(r.id, { name: r.name ?? null, email: r.email ?? null });
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {dict.adminCourses.inboxTitle}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.adminCourses.inboxSubtitle}
      </p>

      {courses.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
          {dict.adminCourses.inboxEmpty}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {courses.map((c) => {
            const creator = creatorMap.get(c.creatorId);
            return (
              <li
                key={c.id}
                className="rounded-lg border border-black/10 p-4 dark:border-white/15"
              >
                <Link
                  href={`/${lang}/admin/courses/${c.id}`}
                  className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold hover:underline">{c.title}</h2>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                      {dict.creator.courses.statuses[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {creator?.name ?? creator?.email ?? c.creatorId} ·{" "}
                    {c.updatedAt.toISOString().slice(0, 10)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
