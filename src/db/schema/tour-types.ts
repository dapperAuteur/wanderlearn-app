import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Canonical tour-type vocabulary. Keep in sync with TOUR_TYPES in
// src/lib/tour-types.ts. Adding a category = appending a value here (a
// migration) + the registry + the en/es label + a seed settings row.
export const tourType = pgEnum("tour_type", [
  "course",
  "tour_only",
  "concert",
  "hike",
  "bike_ride",
  "museum",
  "real_estate",
]);

// Admin-managed presentation for each tour type: the globe pin/legend
// color, ordering, and whether it shows at all. One row per enum value,
// seeded in the migration. Labels live in the dictionaries, not here.
export const tourTypeSettings = pgTable("tour_type_settings", {
  type: tourType("type").primaryKey(),
  // Hex string from TOUR_COLOR_PRESETS (src/lib/tour-styling.ts).
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
