import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { destinations } from "./destinations";
import { scenes } from "./scenes";

// HUNTS — a guided, ordered path through a destination's scenes, where each stop can be locked until
// the visitor does something: answer a question, find a hidden hotspot, or physically arrive at a
// real-world coordinate.
//
// Built from plans/future/16-hunt-builder-and-geo-map-layer.md, which extends the mechanics parked in
// plans/future/12-tour-games.md. Two design decisions carried over from plan 08 and worth not
// relearning:
//
//   1. LIST-BASED AUTHORING, NOT A CANVAS. The drag-to-connect node builder was rejected because it
//      could never be keyboard-accessible. A hunt is the same problem and gets the same answer.
//   2. THE NO-GPS TIER IS NOT OPTIONAL. Plan 08 shipped a usable map because it had starter
//      backgrounds and auto-arrange for creators with no floor plan. Here the equivalent is
//      `allowRemoteFallback`: a hunt nobody can finish without physically travelling excludes people
//      with mobility limits, people who live elsewhere, and anyone visiting a site that has since
//      closed. Default TRUE, and the authoring UI makes turning it off a deliberate act.

export const huntMode = pgEnum("hunt_mode", ["virtual", "onsite"]);
export const huntStatus = pgEnum("hunt_status", ["draft", "published"]);

/**
 * How a stop unlocks.
 *   open     — no gate; available as soon as the previous stop is done.
 *   answer   — the visitor types an answer that matches one of `answers`.
 *   keys     — the visitor holds every key in `requiredKeys` (earned from hotspots or earlier stops).
 *   geo      — the visitor is physically within `unlockRadiusM` of the scene's real-world position.
 */
export const huntUnlockKind = pgEnum("hunt_unlock_kind", ["open", "answer", "keys", "geo"]);

export const hunts = pgTable(
  "hunts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    intro: text("intro"),
    // virtual = playable from anywhere. onsite = at least one stop is geo-gated.
    // Derived from the stops at save time rather than trusted from the client, so the badge a
    // visitor sees ("you need to be there") cannot disagree with what the stops actually require.
    mode: huntMode("mode").notNull().default("virtual"),
    status: huntStatus("status").notNull().default("draft"),
    // ACCESSIBILITY, not a convenience toggle. When true, a geo-gated stop also offers an "I can't
    // get there" path that unlocks it without a position. See the header note.
    allowRemoteFallback: boolean("allow_remote_fallback").notNull().default(true),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hunts_destination_slug_unique").on(t.destinationId, t.slug),
    index("hunts_destination_idx").on(t.destinationId),
    index("hunts_owner_idx").on(t.ownerId),
  ],
);

export const huntStops = pgTable(
  "hunt_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    huntId: uuid("hunt_id")
      .notNull()
      .references(() => hunts.id, { onDelete: "cascade" }),
    // The scene the visitor is standing in for this stop. Cascade: deleting a scene removes the
    // stop, which is correct — a stop with no panorama is not recoverable, and leaving a dangling
    // stop would silently break the hunt's completability check.
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    title: text("title").notNull(),
    /** The clue shown BEFORE the stop unlocks. Plain text; rendered escaped. */
    clue: text("clue"),
    /** Shown AFTER it unlocks — the payoff, and where the teaching happens. */
    reveal: text("reveal"),
    unlockKind: huntUnlockKind("unlock_kind").notNull().default("open"),
    /**
     * Accepted answers for `answer` stops. Compared case-insensitively with accents and surrounding
     * whitespace ignored, the same forgiveness the LMS exercise grader uses. A list, because a
     * question with one accepted spelling is a question that fails honest visitors.
     */
    answers: jsonb("answers").$type<string[]>(),
    /** Keys required for a `keys` stop. The visitor must hold ALL of them. */
    requiredKeys: jsonb("required_keys").$type<string[]>(),
    /** Key granted when this stop unlocks, so stops can chain into later gates. */
    grantsKey: text("grants_key"),
    /**
     * Unlock radius in metres for a `geo` stop.
     *
     * Default 40 is deliberate and worth defending: consumer GPS is roughly ±5-20m, and worse in the
     * dense downtown blocks this feature exists to serve. A 10m radius reads as precise and misfires
     * constantly, which trains visitors to use the fallback and makes the whole mechanic pointless.
     * Prefer a radius that always works over one that looks exact.
     */
    unlockRadiusM: integer("unlock_radius_m").notNull().default(40),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hunt_stops_hunt_idx").on(t.huntId),
    uniqueIndex("hunt_stops_hunt_order_unique").on(t.huntId, t.sortOrder),
  ],
);

/**
 * A visitor's progress through a hunt.
 *
 * ── PRIVACY, and this is the load-bearing comment in the file ──────────────────────────────────
 * This table stores WHICH STOP was unlocked and WHEN. It never stores where the visitor was.
 * Proximity is evaluated entirely in the browser: the page reads the device position, compares it to
 * the stop's coordinates locally, and POSTs only "stop X unlocked". No latitude or longitude for a
 * visitor is transmitted or persisted anywhere in this system, and no column here could hold one.
 *
 * `visitorKey` is an opaque random token the browser generates and keeps in localStorage. It is not
 * an account, not derived from a device identifier, and not joinable to a user. It exists so a
 * visitor who reloads the page does not lose their progress.
 */
export const huntProgress = pgTable(
  "hunt_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    huntId: uuid("hunt_id")
      .notNull()
      .references(() => hunts.id, { onDelete: "cascade" }),
    stopId: uuid("stop_id")
      .notNull()
      .references(() => huntStops.id, { onDelete: "cascade" }),
    /** Opaque browser-generated token. Never an account id, never a device id. */
    visitorKey: text("visitor_key").notNull(),
    /** True when the visitor used the remote fallback rather than physically arriving. */
    viaFallback: boolean("via_fallback").notNull().default(false),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hunt_progress_unique").on(t.huntId, t.visitorKey, t.stopId),
    index("hunt_progress_hunt_idx").on(t.huntId),
  ],
);
