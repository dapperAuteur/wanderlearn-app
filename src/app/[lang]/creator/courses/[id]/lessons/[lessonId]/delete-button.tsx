"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/locales";

type Dict = {
  label: string;
  confirmPrompt: string;
  deletingLabel: string;
};

type ActionResult = { ok: true; data: null } | { ok: false; error: string; code: string };

export function DeleteLessonButton({
  id,
  courseId,
  name,
  lang,
  dict,
  action,
}: {
  id: string;
  courseId: string;
  name: string;
  lang: Locale;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(dict.confirmPrompt.replace("{name}", name))) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("courseId", courseId);
      formData.set("lang", lang);
      await action(formData);
      router.push(`/${lang}/creator/courses/${courseId}`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md border border-red-600/40 bg-red-600/10 px-6 text-base font-semibold text-red-700 hover:bg-red-600/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-red-400/40 dark:text-red-300"
    >
      {pending ? dict.deletingLabel : dict.label}
    </button>
  );
}
