"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

const updateProfileSchema = z.object({
  name: z.string().min(1).max(120),
  locale: langSchema,
  lang: langSchema,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200),
  revokeOtherSessions: z.boolean().optional(),
  lang: langSchema,
});

const revokeSessionSchema = z.object({
  token: z.string().min(1),
  lang: langSchema,
});

/**
 * Update display name + locale on the user's own row. Email change is
 * intentionally NOT here — it requires Better Auth's re-verification
 * flow, which deserves its own dedicated page.
 */
export async function updateProfile(formData: FormData): Promise<Result<null>> {
  const parsed = updateProfileSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    locale: String(formData.get("locale") ?? "en"),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireUser(parsed.data.lang);

  await db
    .update(schema.users)
    .set({
      name: parsed.data.name,
      locale: parsed.data.locale,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id));

  revalidatePath(`/${parsed.data.lang}/account`);
  return { ok: true, data: null };
}

/**
 * Thin server-action wrapper around Better Auth's /change-password
 * endpoint. Errors from the underlying call (wrong current password,
 * weak new password) bubble through as `code: "change_failed"` with
 * the Better Auth error message — surfaced to the user.
 */
export async function changePassword(formData: FormData): Promise<Result<null>> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    revokeOtherSessions: String(formData.get("revokeOtherSessions") ?? "") === "true",
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    // Distinguish the "new password too short" case so the UI can show
    // a length-specific hint instead of "invalid input".
    const issues = parsed.error.issues;
    if (issues.some((i) => i.path[0] === "newPassword")) {
      return { ok: false, error: "Password too short", code: "weak_password" };
    }
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireUser(parsed.data.lang);

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: parsed.data.revokeOtherSessions,
      },
      headers: await headers(),
    });
  } catch (error) {
    // Better Auth throws with a `message` for known failures (wrong
    // current password, etc.). Pass that through; defensive fallback
    // for unknown shapes keeps us from leaking internals.
    const message = error instanceof Error ? error.message : "Password change failed";
    return { ok: false, error: message, code: "change_failed" };
  }

  revalidatePath(`/${parsed.data.lang}/account`);
  return { ok: true, data: null };
}

/**
 * Revoke a specific session by token. Wraps Better Auth's
 * /revoke-session. Useful for the sessions list "sign out from this
 * device" affordance.
 */
export async function revokeSession(formData: FormData): Promise<Result<null>> {
  const parsed = revokeSessionSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireUser(parsed.data.lang);

  try {
    await auth.api.revokeSession({
      body: { token: parsed.data.token },
      headers: await headers(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not revoke session";
    return { ok: false, error: message, code: "revoke_failed" };
  }

  revalidatePath(`/${parsed.data.lang}/account`);
  return { ok: true, data: null };
}
