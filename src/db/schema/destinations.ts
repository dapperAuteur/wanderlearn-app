import {
  integer,
  type AnyPgColumn,
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { scenes } from "./scenes";
import { tourType } from "./tour-types";

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
    // Optional YouTube URL. When set, the public tour page plays this video
    // (a "video tour") — for destinations whose experience is a YouTube
    // video rather than (or in addition to) 360 scenes. Validated as a
    // YouTube URL at the action layer; rendered via youtube-nocookie.
    youtubeUrl: text("youtube_url"),
    heroMediaId: uuid("hero_media_id"),
    // Gate for the /[lang]/tours/<slug> public-share route. False by
    // default — creators explicitly opt a destination into sharing from
    // the destination view page.
    isPublic: boolean("is_public").notNull().default(false),
    // Narrow-card thumbnail. Optional. When null, render sites fall
    // back to heroMediaId — so existing destinations stay visually
    // unchanged until a creator picks a profile image. Lives separate
    // from heroMediaId so a creator can use a wide hero on the detail
    // page and a square / portrait crop on cards.
    profileMediaId: uuid("profile_media_id"),
    // Creator-controlled accent colors for the destination's virtual
    // tour viewer. Null = use the platform default (white arrow / red
    // pin). Validated against the preset list in `lib/tour-styling.ts`
    // before write.
    tourArrowColor: text("tour_arrow_color"),
    tourPinColor: text("tour_pin_color"),
    // Experience category for this destination (course / hike / museum /
    // …). Drives the globe pin color + legend via tour_type_settings.
    // Null = treated as the default type. See src/lib/tour-types.ts.
    tourType: tourType("tour_type"),
    // Optional creator-uploaded image asset (mediaAssets.id, kind=image)
    // used as the hotspot pin marker in this destination's tour. Null
    // falls back to the inline drop-pin SVG tinted by tourPinColor.
    pinIconMediaId: uuid("pin_icon_media_id"),
    // Optional creator-uploaded image used as the scene-to-scene
    // navigation arrow for every link in this destination's tour.
    // Reused across all arrows (per-tour, not per-link). Null falls
    // back to PSV's default chevron tinted by tourArrowColor. When
    // set, the color tint is ignored — PSV's `arrowStyle.image` path
    // does not flow through currentColor. Phase 2 (per-link custom
    // images) would require dropping VirtualTourPlugin's arrow
    // rendering for MarkersPlugin — deferred until creators ask.
    tourArrowMediaId: uuid("tour_arrow_media_id"),
    // Optional default starting scene for this destination's public
    // tour. When the visitor hits /tours/<slug> without ?scene=, the
    // tour opens here. Set null if the referenced scene is deleted so
    // the tour silently falls back to the oldest scene at the
    // destination instead of orphaning the column.
    defaultStartSceneId: uuid("default_start_scene_id").references(
      (): AnyPgColumn => scenes.id,
      { onDelete: "set null" },
    ),
    // The scene the creator considers this tour's high point — the view worth
    // travelling for. Distinct from defaultStartSceneId (where a tour BEGINS)
    // and from the last scene (where it ENDS).
    //
    // Why the model has an opinion about this at all: memory of an experience
    // is dominated by its most intense moment and its ending, and duration is
    // largely ignored (the peak-end rule). So the peak is what a visitor
    // actually remembers, and it is what a shareable artifact should be made
    // from — a postcard from the best view travels; a "you finished" badge
    // does not.
    //
    // Nullable: a tour with no marked peak simply has no peak-specific
    // behaviour. SET NULL on delete for the same reason as the start scene —
    // deleting a scene must never orphan the column or break the tour.
    peakSceneId: uuid("peak_scene_id").references((): AnyPgColumn => scenes.id, {
      onDelete: "set null",
    }),
    // Floor-plan image for the visitor-facing tour map. Plain column; the FK to
    // media_assets is hand-added in migration 0025 (cyclic-import precedent:
    // sceneHotspots.targetDestinationId). ON DELETE SET NULL — deleting the
    // image simply removes the map.
    mapMediaId: uuid("map_media_id"),
    // Built-in starter background ("grid" | "blank", validated in zod, not a pg
    // enum so adding templates is code-only). Mutually exclusive with
    // mapMediaId — each setter clears the other.
    mapTemplate: text("map_template"),
    // Capability token for sharing a PRIVATE tour: /tours/<slug>?k=<token>
    // renders without an account while the destination stays non-public.
    // High-entropy (32 bytes base64url) rather than a PIN — a guessable code
    // on a public URL is not privacy. Null = no share link. Rotating replaces
    // it (old links die); disabling nulls it.
    shareToken: text("share_token"),
    // Per-destination icon sizing, in CSS pixels. Null = the built-in defaults
    // (scene-link arrow: PSV default; hotspot pin: 32, or 48 for a custom icon).
    // Museum panoramas vary wildly in how much a 32px pin reads against, so
    // this is per tour rather than global.
    sceneLinkIconSize: integer("scene_link_icon_size"),
    hotspotIconSize: integer("hotspot_icon_size"),
    // Per-destination override for the account-level "allow external
    // linking" default (on users). Null = inherit from the owner's
    // account default. True/false = override either direction. Lets a
    // creator publish a mix of linkable and non-linkable tours from
    // one account.
    allowExternalLinkingOverride: boolean("allow_external_linking_override"),
    // Optional destination-level "next tour" CTA. When set, the public
    // tour page (and embed iframe) render a "Continue to {next} →"
    // card below the viewer pointing at this destination. Self-FK
    // cleared automatically if the target is deleted (ON DELETE SET
    // NULL); validate at write time that the target is linkable and
    // not the same destination.
    nextDestinationId: uuid("next_destination_id").references(
      (): AnyPgColumn => destinations.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("destinations_slug_unique").on(table.slug),
    index("destinations_country_city_idx").on(table.country, table.city),
  ],
);
