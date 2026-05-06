import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { auth, type Session } from "./auth";
import {
  type Action,
  type Resource,
  type UserPermissions,
  hasPermission,
} from "./permissions";

export type UserRole = "learner" | "creator" | "teacher" | "site_manager" | "admin";

/**
 * Augmented session user with the permissions JSONB pulled in. Use
 * this when an action might bypass an ownership check via canManage().
 */
export type AuthzUser = Session["user"] & {
  role: UserRole;
  permissions: UserPermissions;
};

export async function getSession(): Promise<Session | null> {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

export async function requireUser(lang = "en"): Promise<Session["user"]> {
  const session = await getSession();
  if (!session) redirect(`/${lang}/sign-in`);
  return session.user;
}

export async function requireRole(role: UserRole, lang = "en"): Promise<Session["user"]> {
  const user = await requireUser(lang);
  const currentRole = (user as { role?: UserRole }).role ?? "learner";
  if (!canAct(currentRole, role)) redirect(`/${lang}`);
  return user;
}

export function canAct(userRole: UserRole, required: UserRole): boolean {
  // Rank ordering is set in code, not in the enum. site_manager sits
  // between teacher (1) and admin (3) — they have creator-level reach
  // (rank ≥ 1) and can be elevated per-resource via canManage(), but
  // requireAdmin() (rank ≥ 3) still rejects them so admin-only flows
  // (course approval, role assignment) stay locked to admins.
  const rank: Record<UserRole, number> = {
    learner: 0,
    creator: 1,
    teacher: 1,
    site_manager: 2,
    admin: 3,
  };
  return rank[userRole] >= rank[required];
}

export const requireCreator = (lang?: string) => requireRole("creator", lang);
export const requireAdmin = (lang?: string) => requireRole("admin", lang);

/**
 * Like requireCreator, but also fetches the permissions blob from
 * the users table. Use this in server actions that have an ownership
 * check the site_manager role should be able to bypass — pass the
 * returned user to canManage() to do the bypass evaluation. One extra
 * SELECT per action call; acceptable for write paths.
 */
export async function requireCreatorWithAuthz(lang = "en"): Promise<AuthzUser> {
  const user = await requireCreator(lang);
  const [row] = await db
    .select({ role: schema.users.role, permissions: schema.users.permissions })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  return {
    ...user,
    role: (row?.role as UserRole) ?? ((user as { role?: UserRole }).role ?? "learner"),
    permissions: (row?.permissions as UserPermissions | null) ?? {},
  };
}

/**
 * True when the user is allowed to act on a resource even though they
 * don't own the underlying row. Admins always pass. site_managers
 * pass only if their permissions JSONB has the specific
 * `resource[action] === true` key. Everyone else (creator, teacher,
 * learner) is denied here — they fall back to the owner-equality
 * check at the callsite.
 */
export function canManage(user: AuthzUser, resource: Resource, action: Action): boolean {
  if (user.role === "admin") return true;
  if (user.role === "site_manager") return hasPermission(user.permissions, resource, action);
  return false;
}

/**
 * Convenience for the common server-action pattern: "the row's owner
 * can act, or any user with the matching site_manager permission can."
 * Replaces the older `eq(table.ownerId, user.id)` WHERE clause —
 * actions that use this helper SELECT by id alone, then check
 * authorization in code.
 */
export function canManageOrOwn(
  user: AuthzUser,
  ownerId: string,
  resource: Resource,
  action: Action,
): boolean {
  return ownerId === user.id || canManage(user, resource, action);
}
