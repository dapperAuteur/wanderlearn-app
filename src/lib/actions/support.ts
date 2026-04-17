"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getThreadById } from "@/db/queries/support";
import { getSession, requireAdmin, requireUser } from "@/lib/rbac";
import { sendEmail } from "@/lib/mailer";
import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/site";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

const categorySchema = z.enum([
  "bug",
  "ui_ux",
  "feature_request",
  "question",
  "content",
  "other",
]);

const statusSchema = z.enum([
  "open",
  "waiting_user",
  "waiting_admin",
  "resolved",
  "closed",
]);

const createThreadSchema = z.object({
  subject: z.string().min(3).max(200),
  category: categorySchema,
  body: z.string().min(1).max(10_000),
  lang: langSchema,
});

const addMessageSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(10_000),
  lang: langSchema,
});

const updateStatusSchema = z.object({
  threadId: z.string().uuid(),
  status: statusSchema,
  lang: langSchema,
});

function revalidateThreadPaths(lang: string, threadId: string) {
  revalidatePath(`/${lang}/support`);
  revalidatePath(`/${lang}/support/${threadId}`);
  revalidatePath(`/${lang}/admin/support`);
  revalidatePath(`/${lang}/admin/support/${threadId}`);
}

async function isAdmin(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return (rows[0]?.role ?? "learner") === "admin";
}

async function notifyAdminNewActivity(params: {
  threadId: string;
  subject: string;
  excerpt: string;
  fromName: string;
  lang: string;
  kind: "new_thread" | "user_reply";
}): Promise<void> {
  const to = env.ADMIN_NOTIFY_EMAIL;
  if (!to) return;
  const link = absoluteUrl(`/${params.lang}/admin/support/${params.threadId}`);
  const subjectPrefix = params.kind === "new_thread" ? "New support thread" : "Support reply";
  try {
    await sendEmail({
      to,
      subject: `[${subjectPrefix}] ${params.subject}`,
      text: `${params.fromName} wrote:\n\n${params.excerpt}\n\nOpen in admin: ${link}`,
    });
  } catch (error) {
    console.error("[support] admin notify failed", error);
  }
}

async function notifyUserAdminReply(params: {
  threadId: string;
  subject: string;
  excerpt: string;
  userEmail: string;
  lang: string;
}): Promise<void> {
  const link = absoluteUrl(`/${params.lang}/support/${params.threadId}`);
  try {
    await sendEmail({
      to: params.userEmail,
      subject: `Wanderlearn support: ${params.subject}`,
      text: `You have a new reply on your support thread:\n\n${params.excerpt}\n\nOpen the thread: ${link}`,
    });
  } catch (error) {
    console.error("[support] user notify failed", error);
  }
}

function excerpt(body: string, max = 400): string {
  if (body.length <= max) return body;
  return `${body.slice(0, max)}…`;
}

export async function createSupportThread(
  formData: FormData,
): Promise<Result<{ threadId: string }>> {
  const parsed = createThreadSchema.safeParse({
    subject: String(formData.get("subject") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    body: String(formData.get("body") ?? "").trim(),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireUser(parsed.data.lang);
  const authorRole = (await isAdmin(user.id)) ? "admin" : "user";

  const now = new Date();
  const [thread] = await db
    .insert(schema.supportThreads)
    .values({
      userId: user.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      status: "open",
      lastMessageAt: now,
    })
    .returning({ id: schema.supportThreads.id });

  if (!thread) {
    return { ok: false, error: "Failed to create thread", code: "db_insert_failed" };
  }

  await db.insert(schema.supportMessages).values({
    threadId: thread.id,
    authorId: user.id,
    authorRole,
    body: parsed.data.body,
  });

  revalidateThreadPaths(parsed.data.lang, thread.id);

  if (authorRole === "user") {
    void notifyAdminNewActivity({
      threadId: thread.id,
      subject: parsed.data.subject,
      excerpt: excerpt(parsed.data.body),
      fromName: user.name ?? user.email ?? "A learner",
      lang: parsed.data.lang,
      kind: "new_thread",
    });
  }

  return { ok: true, data: { threadId: thread.id } };
}

export async function addSupportMessage(
  formData: FormData,
): Promise<Result<{ threadId: string }>> {
  const parsed = addMessageSchema.safeParse({
    threadId: String(formData.get("threadId") ?? ""),
    body: String(formData.get("body") ?? "").trim(),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireUser(parsed.data.lang);
  const acting = (await isAdmin(user.id)) ? "admin" : "user";

  const thread = await getThreadById(parsed.data.threadId);
  if (!thread) {
    return { ok: false, error: "Thread not found", code: "not_found" };
  }
  if (acting === "user" && thread.userId !== user.id) {
    return { ok: false, error: "Thread not found", code: "not_found" };
  }
  if (thread.status === "closed") {
    return { ok: false, error: "Thread is closed", code: "thread_closed" };
  }

  const now = new Date();
  await db.insert(schema.supportMessages).values({
    threadId: thread.id,
    authorId: user.id,
    authorRole: acting,
    body: parsed.data.body,
  });

  const nextStatus = acting === "user" ? "waiting_admin" : "waiting_user";
  await db
    .update(schema.supportThreads)
    .set({ lastMessageAt: now, status: nextStatus, updatedAt: now })
    .where(eq(schema.supportThreads.id, thread.id));

  revalidateThreadPaths(parsed.data.lang, thread.id);

  if (acting === "user") {
    void notifyAdminNewActivity({
      threadId: thread.id,
      subject: thread.subject,
      excerpt: excerpt(parsed.data.body),
      fromName: user.name ?? user.email ?? "A learner",
      lang: parsed.data.lang,
      kind: "user_reply",
    });
  } else {
    const [recipient] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, thread.userId))
      .limit(1);
    if (recipient?.email) {
      void notifyUserAdminReply({
        threadId: thread.id,
        subject: thread.subject,
        excerpt: excerpt(parsed.data.body),
        userEmail: recipient.email,
        lang: parsed.data.lang,
      });
    }
  }

  return { ok: true, data: { threadId: thread.id } };
}

export async function updateSupportThreadStatus(
  formData: FormData,
): Promise<Result<{ threadId: string; status: string }>> {
  const parsed = updateStatusSchema.safeParse({
    threadId: String(formData.get("threadId") ?? ""),
    status: String(formData.get("status") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireAdmin(parsed.data.lang);

  const thread = await getThreadById(parsed.data.threadId);
  if (!thread) {
    return { ok: false, error: "Thread not found", code: "not_found" };
  }

  const now = new Date();
  const isResolved = parsed.data.status === "resolved" || parsed.data.status === "closed";
  await db
    .update(schema.supportThreads)
    .set({
      status: parsed.data.status,
      resolvedAt: isResolved ? now : null,
      updatedAt: now,
    })
    .where(eq(schema.supportThreads.id, thread.id));

  revalidateThreadPaths(parsed.data.lang, thread.id);
  return { ok: true, data: { threadId: thread.id, status: parsed.data.status } };
}

export async function markThreadSeen(
  formData: FormData,
): Promise<Result<{ threadId: string }>> {
  const threadId = String(formData.get("threadId") ?? "");
  const lang = String(formData.get("lang") ?? "en");
  if (!z.string().uuid().safeParse(threadId).success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }

  const session = await getSession();
  const user = session?.user;
  if (!user) {
    return { ok: false, error: "Not signed in", code: "unauthorized" };
  }
  const acting = (await isAdmin(user.id)) ? "admin" : "user";

  const thread = await getThreadById(threadId);
  if (!thread) {
    return { ok: false, error: "Thread not found", code: "not_found" };
  }
  if (acting === "user" && thread.userId !== user.id) {
    return { ok: false, error: "Thread not found", code: "not_found" };
  }

  const now = new Date();
  const field = acting === "admin" ? "seenByAdminAt" : "seenByUserAt";
  await db
    .update(schema.supportMessages)
    .set({ [field]: now })
    .where(eq(schema.supportMessages.threadId, threadId));

  revalidateThreadPaths(lang, threadId);
  return { ok: true, data: { threadId } };
}
