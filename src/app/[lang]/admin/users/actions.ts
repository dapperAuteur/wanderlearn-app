"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { sanitizePermissions } from "@/lib/permissions";
import { requireAdmin } from "@/lib/rbac";

const schemaInput = z.object({
  userId: z.string().min(1),
  role: z.enum(["learner", "creator", "teacher", "admin", "site_manager"]),
  // JSON-encoded UserPermissions blob. Only meaningful when role ===
  // 'site_manager'; for any other role it's cleared on save so a stale
  // bag can't lurk attached to a non-elevated user.
  permissions: z.string().optional(),
  lang: z.enum(["en", "es"]),
});

type SetUserRoleResult =
  | { ok: true }
  | { ok: false; error: string; code: string };

export async function setUserRole(formData: FormData): Promise<SetUserRoleResult> {
  const parsed = schemaInput.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    permissions: formData.get("permissions") ?? undefined,
    lang: formData.get("lang"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }

  const admin = await requireAdmin(parsed.data.lang);

  let permissions = {};
  if (parsed.data.role === "site_manager" && parsed.data.permissions) {
    try {
      permissions = sanitizePermissions(JSON.parse(parsed.data.permissions));
    } catch {
      return { ok: false, error: "Invalid permissions JSON", code: "invalid_input" };
    }
  }

  const grantingPermissions = parsed.data.role === "site_manager";
  await db
    .update(schema.users)
    .set({
      role: parsed.data.role,
      permissions,
      // Stamp the audit fields only when granting permissions; clear
      // them when downgrading so a future re-grant gets a fresh stamp.
      permissionsGrantedBy: grantingPermissions ? admin.id : null,
      permissionsGrantedAt: grantingPermissions ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, parsed.data.userId));

  revalidatePath(`/${parsed.data.lang}/admin/users`);
  return { ok: true };
}
