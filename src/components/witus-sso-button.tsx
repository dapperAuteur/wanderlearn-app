"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * "Sign in with WitUS" — starts the ecosystem OIDC flow against
 * accounts.witus.online. Rendered only when the SSO client is provisioned (see
 * `hasWitusSso` in @/lib/env); the sign-in page gates it. After the IdP round-trip
 * the Better-Auth catch-all handles /api/auth/oauth2/callback/witus and lands the
 * user at `callbackPath`.
 */
export function WitusSsoButton({ callbackPath = "/" }: { callbackPath?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void authClient.signIn
          .oauth2({
            providerId: "witus",
            callbackURL: `${window.location.origin}${callbackPath}`,
          })
          .finally(() => setPending(false));
      }}
      className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
    >
      {pending ? "Redirecting…" : "Sign in with WitUS"}
    </button>
  );
}
