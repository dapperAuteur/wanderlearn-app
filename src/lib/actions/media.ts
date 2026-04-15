"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireCreator } from "@/lib/rbac";
import { destroyAsset, type UploadKind } from "@/lib/cloudinary";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

export type MediaBlocker = {
  type: "destination" | "scene" | "course";
  id: string;
  name: string;
};

const langSchema = z.enum(["en", "es"]);

const updateSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  lang: langSchema,
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  hardDelete: z.boolean(),
  lang: langSchema,
});

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "1" || value === "true" || value === "on";
}

function trimOrUndefined(value: FormDataEntryValue | null): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function findReferences(mediaId: string): Promise<MediaBlocker[]> {
  const [destRefs, sceneRefs, courseRefs] = await Promise.all([
    db
      .select({ id: schema.destinations.id, name: schema.destinations.name })
      .from(schema.destinations)
      .where(eq(schema.destinations.heroMediaId, mediaId)),
    db
      .select({ id: schema.scenes.id, name: schema.scenes.name })
      .from(schema.scenes)
      .where(
        or(
          eq(schema.scenes.panoramaMediaId, mediaId),
          eq(schema.scenes.posterMediaId, mediaId),
        ),
      ),
    db
      .select({ id: schema.courses.id, name: schema.courses.title })
      .from(schema.courses)
      .where(eq(schema.courses.coverMediaId, mediaId)),
  ]);

  return [
    ...destRefs.map((r) => ({ type: "destination" as const, id: r.id, name: r.name })),
    ...sceneRefs.map((r) => ({ type: "scene" as const, id: r.id, name: r.name })),
    ...courseRefs.map((r) => ({ type: "course" as const, id: r.id, name: r.name })),
  ];
}

export async function updateMedia(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = updateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    displayName: trimOrUndefined(formData.get("displayName")),
    description: trimOrUndefined(formData.get("description")),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const [existing] = await db
    .select({ id: schema.mediaAssets.id })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.id),
        eq(schema.mediaAssets.ownerId, user.id),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Media not found", code: "not_found" };
  }

  await db
    .update(schema.mediaAssets)
    .set({
      displayName: parsed.data.displayName ?? null,
      description: parsed.data.description ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  return { ok: true, data: { id: parsed.data.id } };
}

export async function deleteMedia(
  formData: FormData,
): Promise<Result<{ id: string; hardDeleted: boolean }> & { blockers?: MediaBlocker[] }> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    hardDelete: parseBool(formData.get("hardDelete")),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const [row] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.id),
        eq(schema.mediaAssets.ownerId, user.id),
      ),
    )
    .limit(1);

  if (!row) {
    return { ok: false, error: "Media not found", code: "not_found" };
  }

  const blockers = await findReferences(parsed.data.id);
  if (blockers.length > 0) {
    return {
      ok: false,
      error: "Media is still in use",
      code: "in_use",
      blockers,
    };
  }

  if (parsed.data.hardDelete) {
    if (row.cloudinaryPublicId) {
      const destroyed = await destroyAsset(row.cloudinaryPublicId, row.kind as UploadKind);
      if (!destroyed.ok) {
        return {
          ok: false,
          error: `Cloudinary delete failed: ${destroyed.error}`,
          code: "cloudinary_delete_failed",
        };
      }
    }
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, parsed.data.id));
    revalidatePath(`/${parsed.data.lang}/creator/media`);
    return { ok: true, data: { id: parsed.data.id, hardDeleted: true } };
  }

  await db
    .update(schema.mediaAssets)
    .set({
      status: "deleted",
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  return { ok: true, data: { id: parsed.data.id, hardDeleted: false } };
}
