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
  magicLinkCta: string;
  magicLinkLoading: string;
  magicLinkSent: string;
  magicLinkError: string;
  passkeyCta: string;
  passkeyLoading: string;
  passkeyError: string;
  orDivider: string;
};

export function SignInForm({ dict, lang }: { dict: AuthDict; lang: Locale }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? `/${lang}`;
  const [pendingPassword, setPendingPassword] = useState(false);
  const [pendingMagic, setPendingMagic] = useState(false);
  const [pendingPasskey, setPendingPasskey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setPendingPassword(true);
    setError(null);
    setStatus(null);
    const result = await signIn.email({ email, password });
    setPendingPassword(false);
    if (result.error) {
      setError(dict.signInError);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function onMagicLink() {
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const email = emailInput?.value ?? "";
    if (!email) {
      setError(dict.signInError);
      return;
    }
    setPendingMagic(true);
    setError(null);
    setStatus(null);
    const result = await signIn.magicLink({ email, callbackURL: next });
    setPendingMagic(false);
    if (result.error) {
      setError(dict.magicLinkError);
      return;
    }
    setStatus(dict.magicLinkSent);
  }

  async function onPasskey() {
    setPendingPasskey(true);
    setError(null);
    setStatus(null);
    const result = await signIn.passkey();
    setPendingPasskey(false);
    if (result?.error) {
      setError(dict.passkeyError);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <form onSubmit={onPasswordSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium">
            {dict.emailLabel}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email webauthn"
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
            autoComplete="current-password webauthn"
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
        {status ? (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {status}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pendingPassword}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pendingPassword ? dict.signInLoading : dict.signInCta}
        </button>
      </form>

      <div
        role="separator"
        aria-label={dict.orDivider}
        className="flex items-center gap-3 text-xs uppercase tracking-widest text-zinc-500"
      >
        <span className="h-px flex-1 bg-black/10 dark:bg-white/15" aria-hidden="true" />
        {dict.orDivider}
        <span className="h-px flex-1 bg-black/10 dark:bg-white/15" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onMagicLink}
          disabled={pendingMagic}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
        >
          {pendingMagic ? dict.magicLinkLoading : dict.magicLinkCta}
        </button>
        <button
          type="button"
          onClick={onPasskey}
          disabled={pendingPasskey}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
        >
          {pendingPasskey ? dict.passkeyLoading : dict.passkeyCta}
        </button>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {dict.noAccount}{" "}
        <Link
          href={`/${lang}/sign-up`}
          className="font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.signUpLink}
        </Link>
      </p>
    </div>
  );
}
