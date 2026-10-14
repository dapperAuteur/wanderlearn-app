"use server";

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireRole } from "@/lib/rbac";
import { TOURS_ORDERS, type ToursOrder } from "@/lib/tours-order";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

function revalidateToursIndex() {
  revalidatePath("/[lang]/tours", "page");
  revalidatePath("/[lang]", "page");
}

const setOrderSchema = z.object({
  order: z.enum(TOURS_ORDERS),
  /** The order on screen, used to seed "custom" the first time it is chosen. */
  seedIds: z.array(z.string().uuid()).max(500).optional(),
  lang: langSchema,
});

/** Admin only: how /[lang]/tours orders its cards. */
export async function setToursOrder(
  input: z.input<typeof setOrderSchema>,
): Promise<Result<{ order: ToursOrder }>> {
  const parsed = setOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };
  const user = await requireRole("admin", parsed.data.lang as Locale);
  const now = new Date();
  await db
    .insert(schema.siteSettings)
    .values({ key: "toursIndexOrder", value: parsed.data.order, updatedBy: user.id, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.siteSettings.key,
      set: { value: parsed.data.order, updatedBy: user.id, updatedAt: now },
    });
  // First time on "custom": start from what the admin was looking at, not a
  // jump back to newest-first. Never overwrites an arrangement already made.
  if (parsed.data.order === "custom" && parsed.data.seedIds?.length) {
    const [{ placed }] = await db
      .select({ placed: sql<number>`count(*)::int` })
      .from(schema.destinations)
      .where(and(eq(schema.destinations.isPublic, true), isNotNull(schema.destinations.indexPosition)));
    if (placed === 0) await writePositions(parsed.data.seedIds);
  }
  revalidateToursIndex();
  return { ok: true, data: { order: parsed.data.order } };
}

const customSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
  lang: langSchema,
});

/** Admin only: saves the custom sequence (position = index) in one statement. */
export async function saveCustomToursOrder(
  input: z.input<typeof customSchema>,
): Promise<Result<{ count: number }>> {
  const parsed = customSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };
  await requireRole("admin", parsed.data.lang as Locale);
  await writePositions(parsed.data.orderedIds);
  revalidateToursIndex();
  return { ok: true, data: { count: parsed.data.orderedIds.length } };
}

async function writePositions(orderedIds: string[]) {
  const cases = sql.join(
    orderedIds.map((id, index) => sql`when ${id}::uuid then ${index}::int`),
    sql` `,
  );
  await db
    .update(schema.destinations)
    .set({ indexPosition: sql`case ${schema.destinations.id} ${cases} end` })
    .where(and(inArray(schema.destinations.id, orderedIds), eq(schema.destinations.isPublic, true)));
}
