import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Small site-wide settings an admin changes from the UI, one row per key.
 * First use: `toursIndexOrder`, how /[lang]/tours orders its cards.
 */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
