import "server-only";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type TourTypeSettingRow = typeof schema.tourTypeSettings.$inferSelect;

/** All tour-type settings rows, ordered by the admin-managed sort order. */
export async function listTourTypeSettings(): Promise<TourTypeSettingRow[]> {
  return db
    .select()
    .from(schema.tourTypeSettings)
    .orderBy(asc(schema.tourTypeSettings.sortOrder));
}

/**
 * Map of tour_type → pin color for ACTIVE types only. Used to color globe
 * pins; destinations whose type is null/inactive fall back to the caller's
 * default. Returns the rows too so callers can build the legend without a
 * second query.
 */
export async function getActiveTourTypeColors(): Promise<{
  colorByType: Map<string, string>;
  active: TourTypeSettingRow[];
}> {
  const rows = await listTourTypeSettings();
  const active = rows.filter((r) => r.active);
  return {
    colorByType: new Map(active.map((r) => [r.type, r.color] as const)),
    active,
  };
}
