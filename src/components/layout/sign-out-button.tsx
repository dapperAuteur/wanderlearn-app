"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/lib/auth-client";
import type { Locale } from "@/lib/locales";
import { withPostLogoutRedirect } from "@/lib/silent-sso";

/**
 * GLOBAL SIGN-OUT (BAM, 2026-08-30: "signout signs out of every app"). When `endSessionUrl` is
 * present, signing out here also ends the shared session at the WitUS IdP, so it signs you out of
 * every WitUS app in this browser. The caller resolves the URL on the SERVER
 * (`witusEndSessionEndpoint` in src/lib/env.ts) and passes null when this app is not a
 * provisioned ecosystem OIDC client, in which case sign-out stays exactly as local as it was.
 *
 * The label changes with the behaviour: "Sign out of WitUS" when it is global, plain "Sign out"
 * when it is not. Signing someone out of four other apps without saying so is not a courtesy.
 */
export function SignOutButton({
  label,
  globalLabel,
  lang,
  endSessionUrl = null,
}: {
  label: string;
  /** Used instead of `label` when sign-out is global. */
  globalLabel: string;
  lang: Locale;
  endSessionUrl?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await signOut();
      // ORDER IS THE SAFETY PROPERTY. The local session is already destroyed by the line above,
      // so if the IdP refuses the logout, is unreachable, or the redirect never completes, the
      // person is still signed out HERE. Never hand off first and destroy locally afterwards:
      // that turns any IdP failure into "I clicked sign out and I am still signed in".
      if (endSessionUrl) {
        // A full navigation, not router.push: this leaves our origin for the IdP, which then
        // returns to the post_logout_redirect_uri. The origin is read at click time rather than
        // hardcoded because this app is mid-cutover between two registered hosts.
        window.location.assign(withPostLogoutRedirect(endSessionUrl, window.location.origin));
        return;
      }
      router.push(`/${lang}`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
    >
      {endSessionUrl ? globalLabel : label}
    </button>
  );
}
