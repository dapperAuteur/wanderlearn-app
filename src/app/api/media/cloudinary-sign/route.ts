import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/rbac";
import { signUpload } from "@/lib/cloudinary";

const bodySchema = z.object({
  kind: z.enum([
    "image",
    "audio",
    "standard_video",
    "photo_360",
    "video_360",
    "drone_video",
    "transcript",
    "screenshot",
    "screen_recording",
  ]),
  filename: z.string().min(1).max(256),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024 * 1024),
});

const MAX_BYTES_BY_KIND: Record<z.infer<typeof bodySchema>["kind"], number> = {
  image: 50 * 1024 * 1024,
  audio: 500 * 1024 * 1024,
  standard_video: 2 * 1024 * 1024 * 1024,
  photo_360: 100 * 1024 * 1024,
  video_360: 5 * 1024 * 1024 * 1024,
  drone_video: 5 * 1024 * 1024 * 1024,
  transcript: 5 * 1024 * 1024,
  screenshot: 5 * 1024 * 1024,
  screen_recording: 150 * 1024 * 1024,
};

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

  if (parsed.data.sizeBytes > MAX_BYTES_BY_KIND[parsed.data.kind]) {
    return NextResponse.json(
      { ok: false, error: "File exceeds maximum size for its kind", code: "file_too_large" },
      { status: 413 },
    );
  }

  const [row] = await db
    .insert(schema.mediaAssets)
    .values({
      ownerId: user.id,
      kind: parsed.data.kind,
      status: "uploading",
      provider: "cloudinary",
      sizeBytes: parsed.data.sizeBytes,
      metadata: { filename: parsed.data.filename },
    })
    .returning({ id: schema.mediaAssets.id });

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Failed to create media asset", code: "db_insert_failed" },
      { status: 500 },
    );
  }

  const signed = signUpload(parsed.data.kind, row.id);

  return NextResponse.json({
    ok: true,
    data: {
      mediaId: row.id,
      ...signed,
      uploadUrl: `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`,
    },
  });
}
