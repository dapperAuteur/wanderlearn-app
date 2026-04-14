"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signUp } from "@/lib/auth-client";
import type { Locale } from "@/lib/locales";

type AuthDict = {
  nameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  birthYearLabel: string;
  birthYearHelp: string;
  ageGateError: string;
  signUpCta: string;
  signUpLoading: string;
  signUpError: string;
  alreadyHaveAccount: string;
  signInLink: string;
};

const MINIMUM_AGE = 13;

export function SignUpForm({ dict, lang }: { dict: AuthDict; lang: Locale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const birthYearRaw = Number(form.get("birthYear") ?? 0);
    const currentYear = new Date().getFullYear();

    if (!Number.isFinite(birthYearRaw) || currentYear - birthYearRaw < MINIMUM_AGE) {
      setError(dict.ageGateError);
      return;
    }

    setPending(true);
    setError(null);
    const result = await signUp.email({
      name,
      email,
      password,
      birthYear: birthYearRaw,
      locale: lang,
    });
    setPending(false);
    if (result.error) {
      setError(dict.signUpError);
      return;
    }
    router.push(`/${lang}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium">
          {dict.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>
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
          autoComplete="new-password"
          minLength={10}
          required
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="birthYear" className="text-sm font-medium">
          {dict.birthYearLabel}
        </label>
        <input
          id="birthYear"
          name="birthYear"
          type="number"
          inputMode="numeric"
          min={1900}
          max={new Date().getFullYear() - MINIMUM_AGE}
          required
          aria-describedby="birthYear-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="birthYear-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.birthYearHelp}
        </p>
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
        {pending ? dict.signUpLoading : dict.signUpCta}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {dict.alreadyHaveAccount}{" "}
        <Link
          href={`/${lang}/sign-in`}
          className="font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.signInLink}
        </Link>
      </p>
    </form>
  );
}
