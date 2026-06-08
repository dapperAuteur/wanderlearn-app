"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireAdmin } from "@/lib/rbac";
import { normalizeTourColor } from "@/lib/tour-styling";
import { TOUR_TYPES } from "@/lib/tour-types";

type Result = { ok: true } | { ok: false; error: string; code: string };

const schemaInput = z.object({
  type: z.enum(TOUR_TYPES),
  color: z.string(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  active: z.boolean(),
  lang: z.enum(["en", "es"]),
});

/**
 * Admin edits the presentation of a single tour type (pin/legend color,
 * ordering, whether it shows). The enum value itself is fixed — adding a
 * new type is a dev migration. Color is validated against the shared preset
 * palette so the globe stays on-brand.
 */
export async function updateTourTypeSetting(formData: FormData): Promise<Result> {
  const parsed = schemaInput.safeParse({
    type: formData.get("type"),
    color: formData.get("color"),
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on" || formData.get("active") === "true",
    lang: formData.get("lang"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireAdmin(parsed.data.lang);

  const color = normalizeTourColor(parsed.data.color);
  if (!color) {
    return { ok: false, error: "Color must be a preset", code: "invalid_color" };
  }

  await db
    .update(schema.tourTypeSettings)
    .set({
      color,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
      updatedAt: new Date(),
    })
    .where(eq(schema.tourTypeSettings.type, parsed.data.type));

  // The globe (tours catalog + home) reads these colors.
  revalidatePath(`/${parsed.data.lang}/admin/tour-types`);
  revalidatePath(`/${parsed.data.lang}/tours`);
  revalidatePath(`/${parsed.data.lang}`);
  return { ok: true };
}
