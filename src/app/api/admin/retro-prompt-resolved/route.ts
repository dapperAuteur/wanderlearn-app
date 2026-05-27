import { and, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getSession } from "@/lib/rbac";
import { absoluteUrl } from "@/lib/site";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETRO_WINDOW_DAYS = 90;

/**
 * One-shot admin endpoint: emails everyone whose support thread was
 * resolved or closed in the last 90 days and hasn't already been
 * retro-prompted. Designed to be hit once after the bug-resolution-loop
 * branch ships and the migration has applied; subsequent runs are
 * idempotent (the WHERE filter on `retroPromptedAt IS NULL` skips
 * already-prompted threads).
 *
 * Auth: requires admin role (Better Auth session) — this is not a
 * cron endpoint, BAM triggers it from his browser after verifying
 * counts.
 *
 * Side-effect: stamps `retroPromptedAt = now()` on every thread it
 * actually emails. Threads with no recipient email (account deleted)
 * are skipped without stamping.
 */
async function isAdmin(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return (rows[0]?.role ?? "learner") === "admin";
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user || !(await isAdmin(session.user.id))) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const cutoff = new Date(Date.now() - RETRO_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const threads = await db
    .select({
      id: schema.supportThreads.id,
      subject: schema.supportThreads.subject,
      status: schema.supportThreads.status,
      userId: schema.supportThreads.userId,
      resolvedAt: schema.supportThreads.resolvedAt,
    })
    .from(schema.supportThreads)
    .where(
      and(
        isNull(schema.supportThreads.retroPromptedAt),
        or(
          eq(schema.supportThreads.status, "resolved"),
          eq(schema.supportThreads.status, "closed"),
        ),
        gte(schema.supportThreads.resolvedAt, cutoff),
      ),
    );

  if (threads.length === 0) {
    return Response.json({ ok: true, prompted: 0, dryRun, threads: [] });
  }

  // Batch-resolve recipient emails.
  const userIds = Array.from(new Set(threads.map((t) => t.userId)));
  const userRows = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.id, userIds));
  const emailById = new Map(userRows.map((r) => [r.id, r.email]));

  if (dryRun) {
    return Response.json({
      ok: true,
      dryRun: true,
      wouldPrompt: threads.length,
      sample: threads.slice(0, 10).map((t) => ({
        id: t.id,
        subject: t.subject,
        email: emailById.get(t.userId) ?? null,
      })),
    });
  }

  let sent = 0;
  const skipped: Array<{ id: string; reason: string }> = [];
  const promptedIds: string[] = [];

  for (const thread of threads) {
    const email = emailById.get(thread.userId);
    if (!email) {
      skipped.push({ id: thread.id, reason: "no recipient email" });
      continue;
    }
    const link = absoluteUrl(`/en/support/${thread.id}?confirm=1`);
    try {
      await sendEmail({
        to: email,
        subject: `Was your report resolved? ${thread.subject}`,
        text: `We're following up on a report we resolved earlier.\n\nIf the fix worked, click to confirm. If you're still seeing the issue, let us know and we'll dig back in.\n\nConfirm or dispute → ${link}\n\nIf we don't hear back in 14 days, we'll close the thread automatically.`,
      });
      sent += 1;
      promptedIds.push(thread.id);
    } catch (error) {
      console.error("[retro-prompt] send failed", thread.id, error);
      skipped.push({ id: thread.id, reason: (error as Error).message });
    }
  }

  // Stamp every successfully-emailed thread. Doing it in batch after
  // the sends keeps the SQL simple and lets us re-run on partial
  // failure without re-sending to addresses that already got mail.
  if (promptedIds.length > 0) {
    await db
      .update(schema.supportThreads)
      .set({ retroPromptedAt: sql`now()` })
      .where(inArray(schema.supportThreads.id, promptedIds));
  }

  return Response.json({
    ok: true,
    dryRun: false,
    prompted: sent,
    skipped,
  });
}
