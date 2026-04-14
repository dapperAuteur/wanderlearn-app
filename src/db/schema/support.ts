import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
