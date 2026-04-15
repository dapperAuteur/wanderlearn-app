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

export function DeleteSceneButton({
  id,
  name,
  destinationId,
  lang,
  dict,
  action,
}: {
  id: string;
  name: string;
  destinationId: string;
  lang: Locale;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const confirmed = window.confirm(dict.confirmPrompt.replace("{name}", name));
    if (!confirmed) return;
    const formData = new FormData();
    formData.set("id", id);
    formData.set("destinationId", destinationId);
    formData.set("lang", lang);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.push(`/${lang}/creator/destinations/${destinationId}`);
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 px-6 text-base font-semibold text-red-700 hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-60 dark:text-red-400"
    >
      {pending ? dict.deletingLabel : dict.label}
    </button>
  );
}
