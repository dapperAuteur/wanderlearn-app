import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { sortMoments } from "@/lib/moments/moments";
import type { Moment } from "@/lib/moments/types";

/** A tour's timeline in display order. Empty for a tour without moments. */
export async function listTourMoments(destinationId: string): Promise<Moment[]> {
  const rows = await db
    .select({
      id: schema.tourMoments.id,
      label: schema.tourMoments.label,
      occurredOn: schema.tourMoments.occurredOn,
      sortOrder: schema.tourMoments.sortOrder,
      isBase: schema.tourMoments.isBase,
    })
    .from(schema.tourMoments)
    .where(eq(schema.tourMoments.destinationId, destinationId))
    .orderBy(asc(schema.tourMoments.createdAt));
  return sortMoments(rows);
}
