import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const destinations = pgTable(
  "destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    country: text("country"),
    city: text("city"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    description: text("description"),
    website: text("website"),
    heroMediaId: uuid("hero_media_id"),
    // Gate for the /[lang]/tours/<slug> public-share route. False by
    // default — creators explicitly opt a destination into sharing from
    // the destination view page.
    isPublic: boolean("is_public").notNull().default(false),
    // Creator-controlled accent colors for the destination's virtual
    // tour viewer. Null = use the platform default (white arrow / red
    // pin). Validated against the preset list in `lib/tour-styling.ts`
    // before write.
    tourArrowColor: text("tour_arrow_color"),
    tourPinColor: text("tour_pin_color"),
    // Optional creator-uploaded image asset (mediaAssets.id, kind=image)
    // used as the hotspot pin marker in this destination's tour. Null
    // falls back to the inline drop-pin SVG tinted by tourPinColor.
    pinIconMediaId: uuid("pin_icon_media_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("destinations_slug_unique").on(table.slug),
    index("destinations_country_city_idx").on(table.country, table.city),
  ],
);
