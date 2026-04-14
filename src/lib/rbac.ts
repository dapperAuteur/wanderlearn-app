import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "./auth";

export type UserRole = "learner" | "creator" | "teacher" | "admin";

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
  const rank: Record<UserRole, number> = {
    learner: 0,
    creator: 1,
    teacher: 1,
    admin: 2,
  };
  return rank[userRole] >= rank[required];
}

export const requireCreator = (lang?: string) => requireRole("creator", lang);
export const requireAdmin = (lang?: string) => requireRole("admin", lang);
