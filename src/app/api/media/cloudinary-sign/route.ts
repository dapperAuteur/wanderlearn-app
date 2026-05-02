import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/rbac";
import { hasCloudinary, signUpload } from "@/lib/cloudinary";

const fileSchema = z.object({
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

const bodySchema = z.object({
  files: z.array(fileSchema).min(1).max(10),
});

const MAX_BYTES_BY_KIND: Record<z.infer<typeof fileSchema>["kind"], number> = {
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

const ADMIN_BATCH_LIMIT = 10;
const DEFAULT_BATCH_LIMIT = 5;

export async function POST(request: Request) {
  if (!hasCloudinary) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Cloudinary is not configured on this server. The admin needs to set CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, and NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in the environment. See docs/CLOUDINARY_SETUP.md.",
        code: "cloudinary_not_configured",
      },
      { status: 503 },
    );
  }

  const user = await requireUser();
  const role = (user as { role?: string }).role ?? "learner";
  const batchLimit = role === "admin" ? ADMIN_BATCH_LIMIT : DEFAULT_BATCH_LIMIT;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body", code: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.files.length > batchLimit) {
    return NextResponse.json(
      {
        ok: false,
        error: `Batch exceeds limit of ${batchLimit} files for your role`,
        code: "batch_too_large",
      },
      { status: 400 },
    );
  }

  for (const f of parsed.data.files) {
    if (f.sizeBytes > MAX_BYTES_BY_KIND[f.kind]) {
      return NextResponse.json(
        {
          ok: false,
          error: `File "${f.filename}" exceeds maximum size for kind "${f.kind}"`,
          code: "file_too_large",
        },
        { status: 413 },
      );
    }
  }

  const inserted = await db
    .insert(schema.mediaAssets)
    .values(
      parsed.data.files.map((f) => ({
        ownerId: user.id,
        kind: f.kind,
        status: "uploading" as const,
        provider: "cloudinary" as const,
        sizeBytes: f.sizeBytes,
        metadata: { filename: f.filename },
      })),
    )
    .returning({ id: schema.mediaAssets.id });

  if (inserted.length !== parsed.data.files.length) {
    return NextResponse.json(
      { ok: false, error: "Failed to create media assets", code: "db_insert_failed" },
      { status: 500 },
    );
  }

  try {
    const data = inserted.map((row, i) => {
      const f = parsed.data.files[i];
      const signed = signUpload(f.kind, row.id);
      return {
        mediaId: row.id,
        ...signed,
        uploadUrl: `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`,
      };
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    await db
      .delete(schema.mediaAssets)
      .where(
        inArray(
          schema.mediaAssets.id,
          inserted.map((r) => r.id),
        ),
      );
    const message = error instanceof Error ? error.message : "Failed to sign upload";
    return NextResponse.json(
      { ok: false, error: message, code: "sign_failed" },
      { status: 500 },
    );
  }
}
