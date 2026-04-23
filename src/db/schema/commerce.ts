import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { contentBlocks, courses, lessons } from "./courses";

export const purchaseStatus = pgEnum("purchase_status", [
  "pending",
  "paid",
  "refunded",
  "failed",
]);

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    amountToCreatorCents: integer("amount_to_creator_cents").notNull().default(0),
    status: purchaseStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    receiptSentAt: timestamp("receipt_sent_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("purchases_session_unique").on(table.stripeSessionId),
    index("purchases_user_course_idx").on(table.userId, table.courseId),
  ],
);

export const enrollmentSource = pgEnum("enrollment_source", [
  "purchase",
  "free",
  "gift",
  "admin",
]);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    purchaseId: uuid("purchase_id").references(() => purchases.id, {
      onDelete: "set null",
    }),
    source: enrollmentSource("source").notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    certificateIssuedAt: timestamp("certificate_issued_at", { withTimezone: true }),
    offlineEnabledAt: timestamp("offline_enabled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("enrollments_user_course_unique").on(table.userId, table.courseId),
    index("enrollments_user_idx").on(table.userId),
  ],
);

export const lessonProgressStatus = pgEnum("lesson_progress_status", [
  "in_progress",
  "completed",
]);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: lessonProgressStatus("status").notNull().default("in_progress"),
    percentComplete: integer("percent_complete").notNull().default(0),
    lastBlockId: uuid("last_block_id").references(() => contentBlocks.id, {
      onDelete: "set null",
    }),
    lastPositionSeconds: integer("last_position_seconds"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_progress_enrollment_lesson_unique").on(
      table.enrollmentId,
      table.lessonId,
    ),
    index("lesson_progress_enrollment_idx").on(table.enrollmentId),
  ],
);
