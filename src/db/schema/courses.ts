import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { destinations } from "./destinations";
import { mediaAssets } from "./media";

export const courseStatus = pgEnum("course_status", [
  "draft",
  "in_review",
  "published",
  "unpublished",
]);

export const lessonStatus = pgEnum("lesson_status", ["draft", "published"]);

export const contentBlockType = pgEnum("content_block_type", [
  "text",
  "video",
  "photo_360",
  "video_360",
  "quiz",
  "virtual_tour",
]);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    destinationId: uuid("destination_id").references(() => destinations.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    defaultLocale: text("default_locale").notNull().default("en"),
    status: courseStatus("status").notNull().default("draft"),
    reviewRequired: boolean("review_required").notNull().default(true),
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    estimatedMinutes: integer("estimated_minutes"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("courses_slug_unique").on(table.slug),
    index("courses_creator_idx").on(table.creatorId),
    index("courses_destination_idx").on(table.destinationId),
    index("courses_status_idx").on(table.status),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    orderIndex: integer("order_index").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    status: lessonStatus("status").notNull().default("draft"),
    isFreePreview: boolean("is_free_preview").notNull().default(false),
    estimatedMinutes: integer("estimated_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lessons_course_slug_unique").on(table.courseId, table.slug),
    uniqueIndex("lessons_course_order_unique").on(table.courseId, table.orderIndex),
    index("lessons_course_idx").on(table.courseId),
  ],
);

export const contentBlocks = pgTable(
  "content_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    type: contentBlockType("type").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_blocks_lesson_order_unique").on(table.lessonId, table.orderIndex),
    index("content_blocks_lesson_idx").on(table.lessonId),
  ],
);
