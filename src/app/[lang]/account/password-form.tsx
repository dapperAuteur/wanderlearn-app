"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { changePassword } from "@/lib/actions/account";

export type PasswordFormDict = {
  heading: string;
  intro: string;
  currentLabel: string;
  newLabel: string;
  newHelp: string;
  confirmLabel: string;
  revokeOtherLabel: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  mismatchError: string;
  weakError: string;
  genericError: string;
};

const MIN_PASSWORD_LENGTH = 10;

export function PasswordForm({
  lang,
  dict,
}: {
  lang: Locale;
  dict: PasswordFormDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (newPassword !== confirm) {
      setStatus("error");
      setError(dict.mismatchError);
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setStatus("error");
      setError(dict.weakError);
      return;
    }
    // Don't send the confirm field server-side; only what the action needs.
    form.delete("confirmPassword");
    form.set("lang", lang);
    setError(null);
    setStatus("idle");
    startTransition(async () => {
      const result = await changePassword(form);
      if (!result.ok) {
        setStatus("error");
        setError(
          result.code === "weak_password"
            ? dict.weakError
            : result.error || dict.genericError,
        );
        return;
      }
      setStatus("saved");
      formEl.reset();
      router.refresh();
      setTimeout(() => setStatus("idle"), 4000);
    });
  }

  return (
    <section
      aria-labelledby="password-heading"
      className="rounded-lg border border-black/10 p-6 dark:border-white/15"
    >
      <h2 id="password-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" autoComplete="off">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{dict.currentLabel}</span>
          <input
            type="password"
            name="currentPassword"
            required
            autoComplete="current-password"
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{dict.newLabel}</span>
          <input
            type="password"
            name="newPassword"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            aria-describedby="new-password-help"
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
          <span id="new-password-help" className="text-xs text-zinc-600 dark:text-zinc-400">
            {dict.newHelp}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{dict.confirmLabel}</span>
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="revokeOtherSessions"
            value="true"
            defaultChecked
            className="size-4"
          />
          <span>{dict.revokeOtherLabel}</span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pending ? dict.savingLabel : dict.saveCta}
          </button>
          {status === "saved" ? (
            <span role="status" aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              ✓ {dict.savedLabel}
            </span>
          ) : null}
          {error ? (
            <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
              {error}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
