"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { signOut } from "@/lib/auth-client";
import type { Locale } from "@/lib/locales";
import { signOutEverywhere, signOutHere } from "@/lib/sign-out-flow";

/**
 * "Sign out": ends ONLY this app's session and returns to `/${lang}` (BAM, 2026-10-29, witus task
 * 128 option (b)). It never navigates to the WitUS IdP, even when this app is an ecosystem OIDC
 * client, and its label is always plain "Sign out". Ending the shared WitUS session is a separate,
 * explicit control: SignOutEverywhereButton below.
 */
export function SignOutButton({ label, lang }: { label: string; lang: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await signOutHere({
        endLocalSession: () => signOut(),
        goLocal: () => {
          router.push(`/${lang}`);
          router.refresh();
        },
      });
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
    >
      {label}
    </button>
  );
}

/**
 * "Sign out of WitUS everywhere": ends this app's session, THEN the shared WitUS session at the IdP
 * (order and reasons in src/lib/sign-out-flow.ts). Renders nothing unless the caller passes the
 * end-session URL, which is resolved on the SERVER (`witusEndSessionEndpoint` in src/lib/env.ts)
 * and is null when this app is not a provisioned ecosystem OIDC client.
 *
 * The origin is read at click time rather than hardcoded because this app is mid-cutover between
 * two hosts (see withPostLogoutRedirect in src/lib/silent-sso.ts).
 */
export function SignOutEverywhereButton({
  label,
  help,
  endSessionUrl = null,
}: {
  label: string;
  /** Visible help text, linked to the button with aria-describedby. */
  help: string;
  endSessionUrl?: string | null;
}) {
  const helpId = useId();
  const [pending, startTransition] = useTransition();

  if (!endSessionUrl) return null;
  const url = endSessionUrl;

  function onClick() {
    startTransition(async () => {
      await signOutEverywhere({
        endLocalSession: () => signOut(),
        endSessionUrl: url,
        origin: window.location.origin,
        assign: (to) => window.location.assign(to),
      });
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-describedby={helpId}
        className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
      >
        {label}
      </button>
      <p id={helpId} className="max-w-64 px-3 text-xs text-muted">
        {help}
      </p>
    </div>
  );
}
