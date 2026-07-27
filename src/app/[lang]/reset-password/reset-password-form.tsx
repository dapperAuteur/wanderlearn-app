"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { resetPassword } from "@/lib/auth-client";
import type { Locale } from "@/lib/locales";

type ResetDict = {
  passwordLabel: string;
  confirmLabel: string;
  passwordHint: string;
  submitCta: string;
  submitLoading: string;
  done: string;
  error: string;
  mismatchError: string;
  tooShortError: string;
  invalidTokenError: string;
  backToSignIn: string;
  requestNewLink: string;
};

/** Mirrors emailAndPassword.minPasswordLength in src/lib/auth.ts. */
const MIN_PASSWORD_LENGTH = 10;

export function ResetPasswordForm({ dict, lang }: { dict: ResetDict; lang: Locale }) {
  const router = useRouter();
  const params = useSearchParams();
  // Better Auth validates the emailed token on its own route, then redirects
  // here with ?token=<valid> on success or ?error=INVALID_TOKEN on failure.
  const token = params.get("token");
  const tokenError = params.get("error");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // No token means the link was already used, expired, or was tampered with.
  // Show the dead end plainly with a way forward, rather than a password form
  // that cannot possibly succeed.
  if (!token || tokenError) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p role="alert" className="text-base text-red-600 dark:text-red-400">
          {dict.invalidTokenError}
        </p>
        <Link
          href={`/${lang}/forgot-password`}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.requestNewLink}
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    // Checked here as well as server-side: the form is noValidate, so the
    // input's minLength never fires on its own.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(dict.tooShortError);
      return;
    }
    if (password !== confirm) {
      setError(dict.mismatchError);
      return;
    }

    setPending(true);
    setError(null);
    const result = await resetPassword({ newPassword: password, token: token! });
    setPending(false);

    if (result.error) {
      setError(dict.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p role="status" className="text-base text-emerald-700 dark:text-emerald-400">
          {dict.done}
        </p>
        <Link
          href={`/${lang}/sign-in`}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          {dict.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby="password-hint"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="password-hint" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.passwordHint}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="confirm" className="text-sm font-medium">
          {dict.confirmLabel}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
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
    </form>
  );
}
