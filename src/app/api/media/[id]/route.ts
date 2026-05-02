import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();

  await db
    .delete(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, id),
        eq(schema.mediaAssets.ownerId, user.id),
        eq(schema.mediaAssets.status, "uploading"),
      ),
    );

  return new NextResponse(null, { status: 204 });
}
