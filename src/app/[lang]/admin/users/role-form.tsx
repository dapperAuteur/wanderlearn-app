"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ACTIONS,
  type Action,
  type Resource,
  RESOURCES,
  type UserPermissions,
} from "@/lib/permissions";

type Role = "learner" | "creator" | "teacher" | "admin" | "site_manager";

type Dict = {
  roleLabel: string;
  saveRole: string;
  savingRole: string;
  roleLearner: string;
  roleCreator: string;
  roleTeacher: string;
  roleAdmin: string;
  roleSiteManager: string;
  permissionsHeading: string;
  permissionsHint: string;
  resourceLabels: Record<Resource, string>;
  actionLabels: Record<Action, string>;
};

type Props = {
  userId: string;
  currentRole: Role;
  currentPermissions: UserPermissions;
  dict: Dict;
  action: (
    formData: FormData,
  ) => Promise<{ ok: true } | { ok: false; error: string; code: string }>;
};

export function RoleForm({
  userId,
  currentRole,
  currentPermissions,
  dict,
  action,
}: Props) {
  const params = useParams<{ lang: string }>();
  const lang = params.lang;
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<Role>(currentRole);
  const [permissions, setPermissions] = useState<UserPermissions>(currentPermissions);

  const showPermissions = role === "site_manager";

  function togglePerm(resource: Resource, action: Action, on: boolean) {
    setPermissions((prev) => {
      const block = { ...(prev[resource] ?? {}) };
      if (on) block[action] = true;
      else delete block[action];
      const next = { ...prev };
      if (Object.keys(block).length === 0) delete next[resource];
      else next[resource] = block;
      return next;
    });
  }

  return (
    <form
      action={(formData) => {
        formData.set("permissions", JSON.stringify(permissions));
        startTransition(async () => {
          await action(formData);
        });
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="lang" value={lang} />
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`role-${userId}`}>
          {dict.roleLabel}
        </label>
        <select
          id={`role-${userId}`}
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
        >
          <option value="learner">{dict.roleLearner}</option>
          <option value="creator">{dict.roleCreator}</option>
          <option value="teacher">{dict.roleTeacher}</option>
          <option value="site_manager">{dict.roleSiteManager}</option>
          <option value="admin">{dict.roleAdmin}</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
        >
          {pending ? dict.savingRole : dict.saveRole}
        </button>
      </div>

      {showPermissions ? (
        <fieldset className="rounded-md border border-black/10 p-3 text-xs dark:border-white/15">
          <legend className="px-1 text-xs font-semibold">{dict.permissionsHeading}</legend>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{dict.permissionsHint}</p>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left font-medium">&nbsp;</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="px-2 text-center font-medium">
                    {dict.actionLabels[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((resource) => (
                <tr key={resource} className="border-t border-black/5 dark:border-white/10">
                  <th scope="row" className="py-2 pr-2 text-left font-medium">
                    {dict.resourceLabels[resource]}
                  </th>
                  {ACTIONS.map((action) => {
                    const checked = permissions[resource]?.[action] === true;
                    return (
                      <td key={action} className="px-2 py-2 text-center">
                        <label className="inline-flex items-center justify-center">
                          <span className="sr-only">
                            {dict.resourceLabels[resource]} – {dict.actionLabels[action]}
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => togglePerm(resource, action, e.target.checked)}
                            className="h-4 w-4 cursor-pointer"
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
      ) : null}
    </form>
  );
}
