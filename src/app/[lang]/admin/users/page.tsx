import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { hasLocale } from "@/lib/locales";
import { requireAdmin } from "@/lib/rbac";
import { getDictionary } from "../../dictionaries";
import { setUserRole } from "./actions";
import { RoleForm } from "./role-form";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ params }: PageProps<"/[lang]/admin/users">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdmin(lang);
  const dict = await getDictionary(lang);

  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(schema.users.createdAt);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{dict.admin.usersTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.admin.usersSubtitle}
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{dict.admin.usersTitle}</caption>
          <thead>
            <tr className="border-b border-black/10 dark:border-white/15">
              <th scope="col" className="py-3 pr-4 font-semibold">
                {dict.admin.colName}
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                {dict.admin.colEmail}
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                {dict.admin.colRole}
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                <span className="sr-only">{dict.admin.colActions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-black/5 dark:border-white/10">
                <td className="py-3 pr-4">{row.name ?? "—"}</td>
                <td className="py-3 pr-4">{row.email}</td>
                <td className="py-3 pr-4">{row.role}</td>
                <td className="py-3 pr-4">
                  <RoleForm
                    userId={row.id}
                    currentRole={row.role}
                    action={setUserRole}
                    dict={dict.admin}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-zinc-600 dark:text-zinc-400">
                  {dict.admin.noUsers}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
