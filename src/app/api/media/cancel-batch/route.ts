import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getSession } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

// Designed to be called via navigator.sendBeacon during `beforeunload`, so
// the response is fire-and-forget. Always returns 204 — the client can't read
// it anyway. Bulk-deletes only rows that belong to the caller AND are still
// in `uploading`, so a beacon firing late can't trash already-completed media.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 204 });

  // sendBeacon may post as text/plain or application/json depending on the
  // body type. We accept either by reading text and parsing.
  const raw = await request.text().catch(() => "");
  let parsed: z.infer<typeof bodySchema> | null = null;
  try {
    parsed = bodySchema.parse(JSON.parse(raw));
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  await db
    .delete(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, session.user.id),
        eq(schema.mediaAssets.status, "uploading"),
        inArray(schema.mediaAssets.id, parsed.ids),
      ),
    );

  return new NextResponse(null, { status: 204 });
}
