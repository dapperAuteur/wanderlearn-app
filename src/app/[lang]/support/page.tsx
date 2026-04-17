import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listThreadsForUser } from "@/db/queries/support";
import { getSession } from "@/lib/rbac";
import { hasLocale } from "@/lib/locales";
import { getDictionary } from "../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/support">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.support.listTitle,
    description: dict.support.listSubtitle,
    robots: { index: false, follow: false },
  };
}

export default async function SupportThreadListPage({
  params,
}: PageProps<"/[lang]/support">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const session = await getSession();
  const user = session?.user;
  if (!user) {
    redirect(`/${lang}/sign-in?from=${encodeURIComponent(`/${lang}/support`)}`);
  }
  const dict = await getDictionary(lang);
  const threads = await listThreadsForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {dict.support.listTitle}
          </h1>
          <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
            {dict.support.listSubtitle}
          </p>
        </div>
        <Link
          href={`/${lang}/support/new`}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.support.newThreadCta}
        </Link>
      </header>

      {threads.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
          {dict.support.listEmpty}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {threads.map((thread) => (
            <li
              key={thread.id}
              className="rounded-lg border border-black/10 p-4 dark:border-white/15"
            >
              <Link
                href={`/${lang}/support/${thread.id}`}
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
                  {dict.support.categories[thread.category]} ·{" "}
                  {thread.lastMessageAt.toISOString().slice(0, 10)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
