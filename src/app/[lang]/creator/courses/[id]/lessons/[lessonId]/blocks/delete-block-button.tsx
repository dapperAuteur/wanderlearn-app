"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/locales";
import { deleteBlock } from "@/lib/actions/content-blocks";

type Dict = {
  label: string;
  confirmPrompt: string;
  deletingLabel: string;
};

export function DeleteBlockButton({
  blockId,
  blockLabel,
  lang,
  dict,
}: {
  blockId: string;
  blockLabel: string;
  lang: Locale;
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(dict.confirmPrompt.replace("{label}", blockLabel))) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", blockId);
      formData.set("lang", lang);
      await deleteBlock(formData);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={dict.label}
      className="inline-flex min-h-9 items-center justify-center rounded-md border border-red-600/30 px-3 text-xs font-semibold text-red-700 hover:bg-red-600/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-red-400/40 dark:text-red-300"
    >
      {pending ? dict.deletingLabel : dict.label}
    </button>
  );
}
