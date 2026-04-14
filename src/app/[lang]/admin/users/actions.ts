"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireAdmin } from "@/lib/rbac";

const schemaInput = z.object({
  userId: z.string().min(1),
  role: z.enum(["learner", "creator", "teacher", "admin"]),
  lang: z.enum(["en", "es"]),
});

type SetUserRoleResult =
  | { ok: true }
  | { ok: false; error: string; code: string };

export async function setUserRole(formData: FormData): Promise<SetUserRoleResult> {
  const parsed = schemaInput.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    lang: formData.get("lang"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }

  await requireAdmin(parsed.data.lang);

  await db
    .update(schema.users)
    .set({ role: parsed.data.role, updatedAt: new Date() })
    .where(eq(schema.users.id, parsed.data.userId));

  revalidatePath(`/${parsed.data.lang}/admin/users`);
  return { ok: true };
}
