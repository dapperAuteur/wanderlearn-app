"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "@/lib/auth-client";
import type { Locale } from "@/lib/locales";

type ForgotDict = {
  emailLabel: string;
  submitCta: string;
  submitLoading: string;
  sent: string;
  error: string;
  emailRequiredError: string;
  backToSignIn: string;
};

export function ForgotPasswordForm({ dict, lang }: { dict: ForgotDict; lang: Locale }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) {
      setError(dict.emailRequiredError);
      document.getElementById("email")?.focus();
      return;
    }
    setPending(true);
    setError(null);

    const result = await requestPasswordReset({
      email,
      // Better Auth validates the token on its own GET route and then bounces
      // here with ?token=... or ?error=INVALID_TOKEN.
      redirectTo: `/${lang}/reset-password`,
    });
    setPending(false);

    if (result.error) {
      setError(dict.error);
      return;
    }
    // Deliberately identical whether or not the address exists — a different
    // message here would turn this form into an account-enumeration oracle.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p role="status" className="text-base text-emerald-700 dark:text-emerald-400">
          {dict.sent}
        </p>
        <Link
          href={`/${lang}/sign-in`}
          className="inline-flex min-h-11 items-center text-sm font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          {dict.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
      >
        {pending ? dict.submitLoading : dict.submitCta}
      </button>
      <Link
        href={`/${lang}/sign-in`}
        className="inline-flex min-h-11 items-center text-sm text-zinc-600 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-300"
      >
        {dict.backToSignIn}
      </Link>
    </form>
  );
}
