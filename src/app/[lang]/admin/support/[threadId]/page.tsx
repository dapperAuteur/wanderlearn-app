import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getThreadById,
  listAuthorNames,
  listMessagesForThread,
} from "@/db/queries/support";
import {
  addSupportMessage,
  updateSupportThreadStatus,
} from "@/lib/actions/support";
import { requireAdmin } from "@/lib/rbac";
import { hasLocale } from "@/lib/locales";
import { ReplyForm } from "../../../support/[threadId]/reply-form";
import { StatusControl } from "./status-control";
import { getDictionary } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/support/[threadId]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.adminSupport.threadTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminSupportThreadPage({
  params,
}: PageProps<"/[lang]/admin/support/[threadId]">) {
  const { lang, threadId } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdmin(lang);

  const thread = await getThreadById(threadId);
  if (!thread) notFound();

  const [dict, messages] = await Promise.all([
    getDictionary(lang),
    listMessagesForThread(thread.id),
  ]);
  const authorMap = await listAuthorNames([
    thread.userId,
    ...messages.map((m) => m.authorId),
  ]);
  const threadAuthor = authorMap.get(thread.userId);

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/admin/support`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.adminSupport.inboxTitle}
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{thread.subject}</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {threadAuthor?.name ?? threadAuthor?.email ?? thread.userId} ·{" "}
          {dict.support.categories[thread.category]} ·{" "}
          {dict.support.statuses[thread.status]}
        </p>
      </header>

      <section
        aria-labelledby="status-section"
        className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/15"
      >
        <h2 id="status-section" className="text-sm font-semibold">
          {dict.adminSupport.statusHeading}
        </h2>
        <StatusControl
          lang={lang}
          threadId={thread.id}
          currentStatus={thread.status}
          dict={dict.adminSupport.statusControl}
          statusLabels={dict.support.statuses}
          action={updateSupportThreadStatus}
        />
      </section>

      {/* Surface the user's confirmation state for any thread that's
          been through the resolution loop. Helps the admin see at a
          glance whether a "resolved" actually held. */}
      {thread.userConfirmedAt || thread.status === "resolved_pending_confirm" ? (
        <section
          aria-labelledby="user-satisfaction-heading"
          className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h2 id="user-satisfaction-heading" className="text-sm font-semibold">
            {dict.adminSupport.userSatisfaction.heading}
          </h2>
          {thread.userConfirmedPositive === true ? (
            <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              ✓ {dict.adminSupport.userSatisfaction.confirmedLabel}
              {thread.userConfirmedAt
                ? ` · ${thread.userConfirmedAt.toISOString().slice(0, 10)}`
                : null}
            </p>
          ) : thread.userConfirmedPositive === false ? (
            <>
              <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                ✗ {dict.adminSupport.userSatisfaction.disputedLabel}
                {thread.userConfirmedAt
                  ? ` · ${thread.userConfirmedAt.toISOString().slice(0, 10)}`
                  : null}
              </p>
              {thread.userDisputeReason ? (
                <p className="mt-2 whitespace-pre-wrap rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-zinc-800 dark:border-amber-400/30 dark:text-zinc-100">
                  {thread.userDisputeReason}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {dict.adminSupport.userSatisfaction.pendingLabel}
            </p>
          )}
        </section>
      ) : null}

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
                      : (author?.name ?? author?.email ?? "—")}
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
        <section aria-labelledby="admin-reply-heading" className="mt-8">
          <h2 id="admin-reply-heading" className="text-lg font-semibold">
            {dict.adminSupport.replyHeading}
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
