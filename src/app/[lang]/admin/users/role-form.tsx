"use client";

import { useParams } from "next/navigation";
import { useTransition } from "react";

type Role = "learner" | "creator" | "teacher" | "admin";

type Dict = {
  roleLabel: string;
  saveRole: string;
  savingRole: string;
  roleLearner: string;
  roleCreator: string;
  roleTeacher: string;
  roleAdmin: string;
};

type Props = {
  userId: string;
  currentRole: Role;
  dict: Dict;
  action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string; code: string }>;
};

export function RoleForm({ userId, currentRole, dict, action }: Props) {
  const params = useParams<{ lang: string }>();
  const lang = params.lang;
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
        });
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="lang" value={lang} />
      <label className="sr-only" htmlFor={`role-${userId}`}>
        {dict.roleLabel}
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={currentRole}
        className="min-h-11 rounded-md border border-black/15 bg-transparent px-2 text-sm dark:border-white/20"
      >
        <option value="learner">{dict.roleLearner}</option>
        <option value="creator">{dict.roleCreator}</option>
        <option value="teacher">{dict.roleTeacher}</option>
        <option value="admin">{dict.roleAdmin}</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
      >
        {pending ? dict.savingRole : dict.saveRole}
      </button>
    </form>
  );
}
