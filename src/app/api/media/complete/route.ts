import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/rbac";

const bodySchema = z.object({
  mediaId: z.string().uuid(),
  cloudinary: z.object({
    public_id: z.string(),
    secure_url: z.string().url(),
    resource_type: z.string(),
    format: z.string().optional(),
    bytes: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    duration: z.number().optional(),
  }),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { mediaId, cloudinary: c } = parsed.data;

  await db
    .update(schema.mediaAssets)
    .set({
      status: "ready",
      cloudinaryPublicId: c.public_id,
      cloudinaryResourceType: c.resource_type,
      cloudinaryFormat: c.format,
      cloudinarySecureUrl: c.secure_url,
      sizeBytes: c.bytes,
      width: c.width,
      height: c.height,
      durationSeconds: c.duration ? Math.round(c.duration) : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.mediaAssets.id, mediaId), eq(schema.mediaAssets.ownerId, user.id)));

  return NextResponse.json({ ok: true });
}
