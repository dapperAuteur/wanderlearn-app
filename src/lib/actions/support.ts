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
  "resolved_pending_confirm",
  "resolved_user_confirmed",
  "resolved_user_disputed",
  "closed",
]);

const requestUserConfirmationSchema = z.object({
  threadId: z.string().uuid(),
  lang: langSchema,
});

const confirmResolutionSchema = z.object({
  threadId: z.string().uuid(),
  // Binary signal: true = "yes, this worked"; false = "no, still broken".
  // We accept it as a positive/negative outcome, not stars, per BAM's call.
  positive: z.boolean(),
  // Optional free-text. Only meaningful when positive === false (dispute);
  // ignored otherwise. Capped to keep the admin email digestible.
  reason: z.string().max(2_000).optional(),
  lang: langSchema,
});

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

/**
 * Sent when an admin marks a thread `resolved_pending_confirm`. Tells
 * the user to click in and confirm whether the fix actually worked.
 */
async function notifyUserResolved(params: {
  threadId: string;
  subject: string;
  userEmail: string;
  lang: string;
  retro?: boolean;
}): Promise<void> {
  const link = absoluteUrl(`/${params.lang}/support/${params.threadId}?confirm=1`);
  const preamble = params.retro
    ? "We're following up on a report we resolved earlier."
    : "We believe we've resolved your report.";
  try {
    await sendEmail({
      to: params.userEmail,
      subject: params.retro
        ? `Was your report resolved? ${params.subject}`
        : `We marked your report as resolved: ${params.subject}`,
      text: `${preamble}\n\nIf that's right, confirm so we can close the thread. If you're still seeing the issue, let us know and we'll dig back in.\n\nConfirm or dispute → ${link}\n\nIf we don't hear back in 14 days, we'll close the thread automatically. You can always reopen it.`,
    });
  } catch (error) {
    console.error("[support] user notify (resolved) failed", error);
  }
}

/**
 * Sent to ADMIN_NOTIFY_EMAIL when a user disputes a resolution. The
 * matching action also bumps thread priority and flips status back to
 * waiting_admin; this email is the "page BAM" wire BAM asked for.
 */
async function notifyAdminDispute(params: {
  threadId: string;
  subject: string;
  reason: string | null;
  fromName: string;
  lang: string;
}): Promise<void> {
  const to = env.ADMIN_NOTIFY_EMAIL;
  if (!to) return;
  const link = absoluteUrl(`/${params.lang}/admin/support/${params.threadId}`);
  const reasonBlock = params.reason && params.reason.length > 0
    ? `\n\nUser's reason:\n${params.reason}\n`
    : "\n\n(No reason given.)\n";
  try {
    await sendEmail({
      to,
      subject: `[Wanderlearn] User disputed resolution: ${params.subject}`,
      text: `${params.fromName} disputed the resolution on a support thread.${reasonBlock}\nPriority has been bumped automatically and the thread is back in waiting_admin.\n\nOpen in admin: ${link}`,
    });
  } catch (error) {
    console.error("[support] admin dispute notify failed", error);
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
  // Any resolved-flavored status carries the resolvedAt stamp; closed
  // keeps it (it's when the resolution was committed). Open/waiting
  // states clear it because the thread is no longer in resolution.
  const RESOLVED_STATES = new Set([
    "resolved",
    "resolved_pending_confirm",
    "resolved_user_confirmed",
    "resolved_user_disputed",
    "closed",
  ]);
  const isResolved = RESOLVED_STATES.has(parsed.data.status);
  await db
    .update(schema.supportThreads)
    .set({
      status: parsed.data.status,
      resolvedAt: isResolved ? thread.resolvedAt ?? now : null,
      updatedAt: now,
    })
    .where(eq(schema.supportThreads.id, thread.id));

  revalidateThreadPaths(parsed.data.lang, thread.id);
  return { ok: true, data: { threadId: thread.id, status: parsed.data.status } };
}

/**
 * Admin action: mark a thread resolved AND ask the user to confirm
 * (or dispute) the fix worked. Separate from updateSupportThreadStatus
 * because this one also fires the user-facing email and only makes
 * sense for the "I think this is fixed; please verify" handoff.
 */
export async function requestUserConfirmation(
  formData: FormData,
): Promise<Result<{ threadId: string }>> {
  const parsed = requestUserConfirmationSchema.safeParse({
    threadId: String(formData.get("threadId") ?? ""),
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
  await db
    .update(schema.supportThreads)
    .set({
      status: "resolved_pending_confirm",
      resolvedAt: thread.resolvedAt ?? now,
      // Reset the confirmation fields in case this is a re-resolution
      // (e.g., user previously disputed and admin re-resolved).
      userConfirmedAt: null,
      userConfirmedPositive: null,
      userDisputeReason: null,
      updatedAt: now,
    })
    .where(eq(schema.supportThreads.id, thread.id));

  const [recipient] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, thread.userId))
    .limit(1);
  if (recipient?.email) {
    void notifyUserResolved({
      threadId: thread.id,
      subject: thread.subject,
      userEmail: recipient.email,
      lang: parsed.data.lang,
    });
  }

  revalidateThreadPaths(parsed.data.lang, thread.id);
  return { ok: true, data: { threadId: thread.id } };
}

const PRIORITY_BUMP: Record<string, "low" | "normal" | "high" | "urgent"> = {
  low: "normal",
  normal: "high",
  high: "urgent",
  urgent: "urgent",
};

/**
 * User action: confirm or dispute a `resolved_pending_confirm` thread.
 *
 * - `positive: true` → status becomes `resolved_user_confirmed`. The
 *   auto-close cron will close this thread 14 days from the
 *   confirmation timestamp.
 * - `positive: false` → status flips to `resolved_user_disputed`
 *   briefly, then **moves back to `waiting_admin`** so the admin
 *   inbox picks it up. Priority bumps one notch (capped at `urgent`)
 *   and BAM gets an email at ADMIN_NOTIFY_EMAIL.
 *
 * RBAC: thread owner only.
 */
export async function confirmResolution(
  formData: FormData,
): Promise<Result<{ threadId: string; positive: boolean }>> {
  const parsed = confirmResolutionSchema.safeParse({
    threadId: String(formData.get("threadId") ?? ""),
    positive: String(formData.get("positive") ?? "") === "true",
    reason: String(formData.get("reason") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireUser(parsed.data.lang);

  const thread = await getThreadById(parsed.data.threadId);
  if (!thread) {
    return { ok: false, error: "Thread not found", code: "not_found" };
  }
  if (thread.userId !== user.id) {
    return { ok: false, error: "Thread not found", code: "not_found" };
  }
  if (thread.status !== "resolved_pending_confirm") {
    return {
      ok: false,
      error: "Thread is not awaiting your confirmation",
      code: "not_pending_confirm",
    };
  }

  const now = new Date();

  if (parsed.data.positive) {
    await db
      .update(schema.supportThreads)
      .set({
        status: "resolved_user_confirmed",
        userConfirmedAt: now,
        userConfirmedPositive: true,
        userDisputeReason: null,
        updatedAt: now,
      })
      .where(eq(schema.supportThreads.id, thread.id));
    revalidateThreadPaths(parsed.data.lang, thread.id);
    return { ok: true, data: { threadId: thread.id, positive: true } };
  }

  // Dispute path: bump priority, page admin, return to waiting_admin so
  // the inbox surfaces it. We momentarily stamp the disputed status via
  // userConfirmedPositive=false but immediately move status to
  // waiting_admin so the admin queue picks the thread up.
  const bumped = PRIORITY_BUMP[thread.priority] ?? "high";
  await db
    .update(schema.supportThreads)
    .set({
      status: "waiting_admin",
      priority: bumped,
      userConfirmedAt: now,
      userConfirmedPositive: false,
      userDisputeReason: parsed.data.reason ?? null,
      // resolvedAt is cleared — the resolution didn't hold.
      resolvedAt: null,
      lastMessageAt: now,
      updatedAt: now,
    })
    .where(eq(schema.supportThreads.id, thread.id));

  void notifyAdminDispute({
    threadId: thread.id,
    subject: thread.subject,
    reason: parsed.data.reason ?? null,
    fromName: user.name ?? user.email ?? "A learner",
    lang: parsed.data.lang,
  });

  revalidateThreadPaths(parsed.data.lang, thread.id);
  return { ok: true, data: { threadId: thread.id, positive: false } };
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
