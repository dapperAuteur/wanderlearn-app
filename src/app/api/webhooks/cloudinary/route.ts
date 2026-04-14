import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { verifyWebhookSignature } from "@/lib/cloudinary";

const notificationSchema = z.object({
  notification_type: z.string(),
  public_id: z.string().optional(),
  secure_url: z.string().optional(),
  url: z.string().optional(),
  resource_type: z.string().optional(),
  format: z.string().optional(),
  bytes: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const bodyText = await request.text();
  const timestamp = request.headers.get("x-cld-timestamp");
  const signature = request.headers.get("x-cld-signature");

  if (!timestamp || !signature) {
    return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 401 });
  }
  if (!verifyWebhookSignature(bodyText, timestamp, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const json = JSON.parse(bodyText);
  const parsed = notificationSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const { notification_type, public_id, secure_url, resource_type, format, bytes, width, height, duration } =
    parsed.data;

  if (notification_type !== "upload" || !public_id) {
    return NextResponse.json({ ok: true, ignored: notification_type });
  }

  const mediaId = public_id.split("/").pop();
  if (!mediaId) {
    return NextResponse.json({ ok: true, ignored: "no_id" });
  }

  await db
    .update(schema.mediaAssets)
    .set({
      status: "ready",
      cloudinaryPublicId: public_id,
      cloudinaryResourceType: resource_type,
      cloudinaryFormat: format,
      cloudinarySecureUrl: secure_url,
      sizeBytes: bytes,
      width,
      height,
      durationSeconds: duration ? Math.round(duration) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, mediaId));

  return NextResponse.json({ ok: true });
}
