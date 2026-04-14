"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signIn } from "@/lib/auth-client";
import type { Locale } from "@/lib/locales";

type AuthDict = {
  emailLabel: string;
  passwordLabel: string;
  signInCta: string;
  signInLoading: string;
  signInError: string;
  noAccount: string;
  signUpLink: string;
};

export function SignInForm({ dict, lang }: { dict: AuthDict; lang: Locale }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? `/${lang}`;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    const result = await signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(dict.signInError);
      return;
    }
    router.push(next);
    router.refresh();
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
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          {dict.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={10}
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
        {pending ? dict.signInLoading : dict.signInCta}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {dict.noAccount}{" "}
        <Link
          href={`/${lang}/sign-up`}
          className="font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.signUpLink}
        </Link>
      </p>
    </form>
  );
}
