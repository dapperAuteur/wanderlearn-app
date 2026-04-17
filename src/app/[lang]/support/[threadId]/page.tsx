import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getThreadById,
  listAuthorNames,
  listMessagesForThread,
} from "@/db/queries/support";
import { addSupportMessage } from "@/lib/actions/support";
import { getSession } from "@/lib/rbac";
import { hasLocale } from "@/lib/locales";
import { ReplyForm } from "./reply-form";
import { getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/support/[threadId]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.support.threadTitle,
    robots: { index: false, follow: false },
  };
}

export default async function SupportThreadPage({
  params,
}: PageProps<"/[lang]/support/[threadId]">) {
  const { lang, threadId } = await params;
  if (!hasLocale(lang)) notFound();
  const session = await getSession();
  const user = session?.user;
  if (!user) {
    redirect(`/${lang}/sign-in?from=${encodeURIComponent(`/${lang}/support/${threadId}`)}`);
  }

  const thread = await getThreadById(threadId);
  if (!thread || thread.userId !== user.id) notFound();

  const [dict, messages] = await Promise.all([
    getDictionary(lang),
    listMessagesForThread(thread.id),
  ]);
  const authorMap = await listAuthorNames(messages.map((m) => m.authorId));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/support`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.support.listTitle}
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{thread.subject}</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {dict.support.categories[thread.category]} ·{" "}
          {dict.support.statuses[thread.status]}
        </p>
      </header>

      <section aria-labelledby="messages-heading" className="mt-8">
        <h2 id="messages-heading" className="sr-only">
          {dict.support.messagesHeading}
        </h2>
        <ol className="flex flex-col gap-4">
          {messages.map((m) => {
            const author = authorMap.get(m.authorId);
            const isAdmin = m.authorRole === "admin";
            return (
              <li
                key={m.id}
                className={
                  isAdmin
                    ? "rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 dark:border-emerald-400/30"
                    : "rounded-lg border border-black/10 p-4 dark:border-white/15"
                }
              >
                <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                    {isAdmin
                      ? dict.support.adminLabel
                      : (author?.name ?? author?.email ?? dict.support.youLabel)}
                  </span>{" "}
                  · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </p>
                <p className="whitespace-pre-wrap text-base leading-7 text-zinc-800 dark:text-zinc-100">
                  {m.body}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {thread.status === "closed" ? (
        <p className="mt-8 rounded-md border border-black/10 bg-black/5 px-4 py-3 text-sm text-zinc-600 dark:border-white/15 dark:bg-white/5 dark:text-zinc-400">
          {dict.support.threadClosed}
        </p>
      ) : (
        <section aria-labelledby="reply-heading" className="mt-8">
          <h2 id="reply-heading" className="text-lg font-semibold">
            {dict.support.replyHeading}
          </h2>
          <ReplyForm
            lang={lang}
            threadId={thread.id}
            dict={dict.support.replyForm}
            action={addSupportMessage}
          />
        </section>
      )}
    </main>
  );
}
