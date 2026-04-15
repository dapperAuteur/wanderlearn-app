import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type DestinationRow = typeof schema.destinations.$inferSelect;

export async function listDestinations(): Promise<DestinationRow[]> {
  return db.select().from(schema.destinations).orderBy(desc(schema.destinations.createdAt));
}

export async function getDestinationById(id: string): Promise<DestinationRow | null> {
  const rows = await db
    .select()
    .from(schema.destinations)
    .where(eq(schema.destinations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDestinationBySlug(slug: string): Promise<DestinationRow | null> {
  const rows = await db
    .select()
    .from(schema.destinations)
    .where(eq(schema.destinations.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}
