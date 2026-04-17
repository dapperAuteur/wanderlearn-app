"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type ActionResult =
  | { ok: true; data: { threadId: string } }
  | { ok: false; error: string; code: string };

type Dict = {
  bodyLabel: string;
  bodyPlaceholder: string;
  sendCta: string;
  sendingLabel: string;
  genericError: string;
};

export function ReplyForm({
  lang,
  threadId,
  dict,
  action,
}: {
  lang: Locale;
  threadId: string;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("lang", lang);
    formData.set("threadId", threadId);
    formData.set("body", body);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(dict.genericError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <label htmlFor="support-reply-body" className="text-sm font-medium">
        {dict.bodyLabel}
      </label>
      <textarea
        id="support-reply-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={dict.bodyPlaceholder}
        minLength={1}
        maxLength={10_000}
        required
        rows={5}
        className="min-h-32 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
      />
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:border-red-400/30 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.sendingLabel : dict.sendCta}
        </button>
      </div>
    </form>
  );
}
