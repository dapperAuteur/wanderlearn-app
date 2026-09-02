"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  SILENT_SSO_TIMEOUT_MS,
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  parseSilentSsoIdentity,
  silentSsoDecision,
  withAttemptMarker,
  type SsoIdentity,
} from "@/lib/silent-sso";

export type WitusSsoDict = {
  /** Default label: "Sign in with WitUS". */
  cta: string;
  /** Label once the probe answers. Carries a `{name}` placeholder. */
  continueAs: string;
  redirecting: string;
  /** Offered under the button only when a name is shown, so it is never a dangling question. */
  notYou: string;
};

/**
 * "Sign in with WitUS", plus the silent "Continue as <name>" check on top of it.
 *
 * WHAT THE VISITOR SEES. The sign-in form is already on screen and nothing here delays it. The
 * button reads "Sign in with WitUS" from first paint. If the probe comes back with a live WitUS
 * session it becomes "Continue as <name>". If the probe fails, times out, is refused by CORS, or
 * is blocked by the browser's third-party-cookie rules, NOTHING changes and nothing is said —
 * no error, no spinner, no layout shift. A failed silent check has to be invisible, and on
 * Safari and Firefox it is the common case rather than the exception.
 *
 * THE NAME IS DISPLAY COPY, NEVER A CREDENTIAL. It crossed an origin boundary to get here, so it
 * is client-supplied by definition. Clicking the button runs the real OIDC code flow, which is
 * the only thing that establishes identity; the label grants nothing.
 *
 * After the IdP round-trip the Better-Auth catch-all handles
 * /api/auth/oauth2/callback/witus and lands the visitor at `callbackPath`.
 */
export function WitusSsoButton({
  callbackPath = "/",
  signInPath,
  enabled = true,
  silentCheckUrl = null,
  dict,
}: {
  callbackPath?: string;
  /** This locale's sign-in path, e.g. `/en/sign-in`. Where a failed flow comes back to. */
  signInPath: string;
  /** Server-resolved gate (`hasWitusSso`). False means this component does nothing at all. */
  enabled?: boolean;
  /** IdP session endpoint, or null when ecosystem SSO is not configured. */
  silentCheckUrl?: string | null;
  dict: WitusSsoDict;
}) {
  const [pending, setPending] = useState(false);
  const [identity, setIdentity] = useState<SsoIdentity | null>(null);

  useEffect(() => {
    const endpoint = silentCheckUrl;
    const decision = silentSsoDecision({
      enabled,
      endpoint,
      search: window.location.search,
      attempted: readAttempted(),
    });
    // `!endpoint` is already implied by decision.attempt; repeating it keeps the narrowing the
    // compiler's rather than a cast that could quietly outlive the invariant.
    if (!decision.attempt || !endpoint) return;

    // Abort rather than hang. A probe still in flight when the visitor has moved on is a leak of
    // attention, not just of a socket.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SILENT_SSO_TIMEOUT_MS);
    let live = true;

    // `credentials: "include"` is the entire mechanism: the answer depends on the IdP's OWN
    // cookie, which is third-party from here. Browsers that partition or block third-party
    // cookies (Safari ITP, Firefox Total Cookie Protection) answer "nobody", and that is a
    // supported outcome, not a bug to work around.
    fetch(endpoint, {
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!live) return;
        const found = parseSilentSsoIdentity(payload);
        if (found) setIdentity(found);
      })
      .catch(() => {
        // Invisible on purpose: network error, CORS refusal, abort, non-JSON body — all the same.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, silentCheckUrl]);

  const start = useCallback(() => {
    setPending(true);
    // THE LOOP GUARD, written BEFORE the redirect and never after the return. Without it a
    // visitor whose IdP session has gone stale gets: probe says "Continue as X" -> click -> the
    // IdP cannot finish -> back to sign-in -> probe says "Continue as X" -> forever. With it,
    // one attempt per tab: the next render offers the plain button and the email form, which
    // always work.
    writeAttempted();
    const origin = window.location.origin;
    void authClient.signIn
      .oauth2({
        providerId: "witus",
        callbackURL: `${origin}${callbackPath}`,
        // Back to the sign-in form, carrying the query-param half of the guard — the half that
        // survives a browser where sessionStorage throws, and a return that lands in a new tab.
        // Better-Auth only reads this for failures AFTER it parses the OAuth state (token
        // exchange, issuer mismatch); an `error` the IdP itself returns on the callback still
        // lands on Better-Auth's own error page, exactly as it does today.
        errorCallbackURL: `${origin}${withAttemptMarker(
          `${signInPath}?next=${encodeURIComponent(callbackPath)}`,
        )}`,
      })
      .finally(() => setPending(false));
  }, [callbackPath, signInPath]);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={start}
        className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
      >
        {pending ? dict.redirecting : continueAsLabel(identity, { signIn: dict.cta, continueAs: dict.continueAs })}
      </button>
      {/* Always in the DOM so the label change is announced when it happens, and silent (and
          invisible) when the probe found nothing. */}
      <p
        role="status"
        aria-live="polite"
        className={identity ? "text-center text-sm text-zinc-600 dark:text-zinc-300" : "sr-only"}
      >
        {identity ? dict.notYou : ""}
      </p>
    </>
  );
}

/**
 * sessionStorage throws outright in some privacy modes, so both halves are wrapped. A browser
 * that cannot remember the attempt still gets the other half of the guard: the `?sso=tried`
 * marker on the URL it comes back to.
 */
function readAttempted(): boolean {
  try {
    return window.sessionStorage.getItem(SSO_ATTEMPT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAttempted(): void {
  try {
    window.sessionStorage.setItem(SSO_ATTEMPT_STORAGE_KEY, "1");
  } catch {
    // No storage, no marker. The query-param half still applies.
  }
}
