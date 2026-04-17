import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listAllThreads, listAuthorNames } from "@/db/queries/support";
import { requireAdmin } from "@/lib/rbac";
import { hasLocale } from "@/lib/locales";
import { getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/support">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.adminSupport.inboxTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminSupportInboxPage({
  params,
  searchParams,
}: PageProps<"/[lang]/admin/support">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdmin(lang);
  const dict = await getDictionary(lang);
  const query = await searchParams;
  const statusFilter = typeof query?.status === "string" ? query.status : null;

  const allowedStatuses = [
    "open",
    "waiting_user",
    "waiting_admin",
    "resolved",
    "closed",
  ] as const;
  const appliedStatus = allowedStatuses.find((s) => s === statusFilter);

  const threads = await listAllThreads({ status: appliedStatus });
  const authorMap = await listAuthorNames(threads.map((t) => t.userId));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {dict.adminSupport.inboxTitle}
      </h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.adminSupport.inboxSubtitle}
      </p>

      <nav aria-label={dict.adminSupport.filtersLabel} className="mt-6 flex flex-wrap gap-2">
        <FilterLink
          lang={lang}
          currentStatus={appliedStatus ?? null}
          target={null}
          label={dict.adminSupport.filterAll}
        />
        {allowedStatuses.map((s) => (
          <FilterLink
            key={s}
            lang={lang}
            currentStatus={appliedStatus ?? null}
            target={s}
            label={dict.support.statuses[s]}
          />
        ))}
      </nav>

      {threads.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
          {dict.adminSupport.inboxEmpty}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {threads.map((thread) => {
            const author = authorMap.get(thread.userId);
            return (
              <li
                key={thread.id}
                className="rounded-lg border border-black/10 p-4 dark:border-white/15"
              >
                <Link
                  href={`/${lang}/admin/support/${thread.id}`}
                  className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold hover:underline">
                      {thread.subject}
                    </h2>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                      {dict.support.statuses[thread.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {author?.name ?? author?.email ?? thread.userId} ·{" "}
                    {dict.support.categories[thread.category]} ·{" "}
                    {thread.lastMessageAt.toISOString().slice(0, 10)}
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

function FilterLink({
  lang,
  currentStatus,
  target,
  label,
}: {
  lang: string;
  currentStatus: string | null;
  target: string | null;
  label: string;
}) {
  const href = target
    ? `/${lang}/admin/support?status=${target}`
    : `/${lang}/admin/support`;
  const isActive = currentStatus === target;
  return (
    <Link
      href={href}
      className={
        isActive
          ? "inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-4 text-sm font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          : "inline-flex min-h-11 items-center justify-center rounded-full border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
      }
    >
      {label}
    </Link>
  );
}
