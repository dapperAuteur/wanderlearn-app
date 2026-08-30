"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Ask the WitUS IdP, once, whether this visitor is already signed in.
 *
 * WHY THIS IS NEEDED AT ALL. Signing in to a sibling ecosystem app does not
 * give this app a session — each client holds its own cookie on its own host,
 * and the shared session lives only on accounts.witus.online. So "am I already
 * signed in?" is a question only the IdP can answer, and OIDC `prompt=none` is
 * the way to ask: authenticate silently if there is a session, return
 * `error=login_required` if there is not.
 *
 * WHY THE GUARDS MATTER MORE THAN THE FEATURE. This runs on the sign-in page
 * and can redirect away from it. Get it wrong and you have a redirect loop on
 * the one page nobody can route around — a locked door with the key inside. So:
 *
 *   1. **Once per tab, ever.** The sessionStorage flag is written BEFORE the
 *      redirect starts, so the attempt is recorded even though this page is
 *      about to be unloaded. On the way back the flag is present and nothing
 *      retries. sessionStorage (not localStorage) so a new tab can try again,
 *      and a closed browser forgets.
 *   2. **Never when the URL already says it failed.** The IdP bounces back with
 *      an `error` parameter; seeing one means we have just been through this.
 *   3. **Storage failures do not disable sign-in.** If sessionStorage throws —
 *      private mode, blocked site data — we skip the attempt entirely rather
 *      than risk an unguarded redirect. A visitor who has to click the button
 *      has lost nothing; a visitor in a loop has lost everything.
 *
 * Renders nothing. The visible "Sign in with WitUS" button stays exactly as it
 * was, and remains the path for anyone this misses.
 */
const ATTEMPT_KEY = "wl.witus.silentAttempted";

export function WitusSilentSignIn({ callbackPath = "/" }: { callbackPath?: string }) {
  useEffect(() => {
    // The IdP redirected back with a failure — this is the return leg, not a
    // fresh visit. Trying again is exactly the loop the guards exist to stop.
    const params = new URLSearchParams(window.location.search);
    if (params.has("error")) return;

    let attempted: string | null;
    try {
      attempted = window.sessionStorage.getItem(ATTEMPT_KEY);
      if (attempted) return;
      // Written BEFORE the redirect: this page is about to unload, and an
      // attempt that is not recorded is an attempt that repeats.
      window.sessionStorage.setItem(ATTEMPT_KEY, "1");
    } catch {
      // No reliable way to remember we tried, so do not try. The button works.
      return;
    }

    void authClient.signIn.oauth2({
      providerId: "witus",
      callbackURL: `${window.location.origin}${callbackPath}`,
      // Back to the sign-in page on failure. The `error` parameter that comes
      // with it is what rule 2 above keys on, so the second visit is inert.
      errorCallbackURL: `${window.location.origin}${window.location.pathname}`,
      // The only field the sign-in route does not strip. See the provider's
      // authorizationUrlParams in src/lib/auth.ts.
      additionalData: { silent: true },
    });
  }, [callbackPath]);

  return null;
}
