import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contentBlocks, courses, lessons } from "./courses";

export const courseTranslations = pgTable(
  "course_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("course_translations_course_locale_unique").on(table.courseId, table.locale),
  ],
);

export const lessonTranslations = pgTable(
  "lesson_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_translations_lesson_locale_unique").on(table.lessonId, table.locale),
  ],
);

export const contentBlockTranslations = pgTable(
  "content_block_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => contentBlocks.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_block_translations_block_locale_unique").on(table.blockId, table.locale),
  ],
);
