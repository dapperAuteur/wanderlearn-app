import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const supportCategory = pgEnum("support_category", [
  "bug",
  "ui_ux",
  "feature_request",
  "question",
  "content",
  "other",
]);

export const supportThreadStatus = pgEnum("support_thread_status", [
  "open",
  "waiting_user",
  "waiting_admin",
  "resolved",
  // Admin marked resolved AND asked for user confirmation. Waiting for the
  // user to click "yes worked" or "no still broken." The auto-close cron
  // doesn't touch threads in this state — only `resolved_user_confirmed`
  // gets closed automatically after 14 days.
  "resolved_pending_confirm",
  // User confirmed the fix. Auto-closes 14 days after this transition
  // unless new activity bumps the thread back to `waiting_admin`.
  "resolved_user_confirmed",
  // User pushed back. Server action that sets this state also bumps
  // priority, emails BAM, and moves the thread back to `waiting_admin`
  // for re-investigation — so this enum value is mostly transitional
  // (visible in the audit log via updatedAt + status history).
  "resolved_user_disputed",
  "closed",
]);

export const supportPriority = pgEnum("support_priority", ["low", "normal", "high", "urgent"]);

export const supportAuthorRole = pgEnum("support_author_role", ["user", "admin"]);

export const supportThreads = pgTable(
  "support_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    category: supportCategory("category").notNull(),
    status: supportThreadStatus("status").notNull().default("open"),
    priority: supportPriority("priority").notNull().default("normal"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    // Set when the user clicks Confirm or Dispute on a thread that was
    // `resolved_pending_confirm`. The cron uses this timestamp as the
    // anchor for the 14-day auto-close window on confirmed-positive
    // threads. Null = the user hasn't responded yet.
    userConfirmedAt: timestamp("user_confirmed_at", { withTimezone: true }),
    // null = no response yet. true = "yes worked" (positive). false = "no
    // still broken" (negative; triggers the dispute escalation).
    userConfirmedPositive: boolean("user_confirmed_positive"),
    // Optional free-text the user writes when disputing the resolution.
    // Surfaced to the admin in the inbox + thread view.
    userDisputeReason: text("user_dispute_reason"),
    // Set when the admin one-shot retro-prompt endpoint emails this
    // thread's owner. Makes the endpoint idempotent — re-running it
    // skips threads already prompted.
    retroPromptedAt: timestamp("retro_prompted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("support_threads_inbox_idx").on(table.status, table.lastMessageAt),
    index("support_threads_user_idx").on(table.userId),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => supportThreads.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorRole: supportAuthorRole("author_role").notNull(),
    body: text("body").notNull(),
    attachments: jsonb("attachments"),
    seenByUserAt: timestamp("seen_by_user_at", { withTimezone: true }),
    seenByAdminAt: timestamp("seen_by_admin_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("support_messages_thread_idx").on(table.threadId),
    index("support_messages_author_idx").on(table.authorId),
  ],
);
