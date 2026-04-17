"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";

type ActionResult =
  | { ok: true; data: { threadId: string; status: string } }
  | { ok: false; error: string; code: string };

type Dict = {
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  genericError: string;
};

const STATUSES = [
  "open",
  "waiting_user",
  "waiting_admin",
  "resolved",
  "closed",
] as const;

export function StatusControl({
  lang,
  threadId,
  currentStatus,
  dict,
  statusLabels,
  action,
}: {
  lang: Locale;
  threadId: string;
  currentStatus: (typeof STATUSES)[number];
  dict: Dict;
  statusLabels: Record<string, string>;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<(typeof STATUSES)[number]>(currentStatus);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");

  function save() {
    if (value === currentStatus) return;
    setState("idle");
    const formData = new FormData();
    formData.set("lang", lang);
    formData.set("threadId", threadId);
    formData.set("status", value);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setState("saved");
        router.refresh();
      } else {
        setState("error");
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <select
        aria-label={dict.saveCta}
        value={value}
        onChange={(e) => setValue(e.target.value as (typeof STATUSES)[number])}
        className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s] ?? s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={pending || value === currentStatus}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
      >
        {pending ? dict.savingLabel : dict.saveCta}
      </button>
      {state === "saved" ? (
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {dict.savedLabel}
        </span>
      ) : null}
      {state === "error" ? (
        <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
          {dict.genericError}
        </span>
      ) : null}
    </div>
  );
}
