import { withPostLogoutRedirect } from "@/lib/silent-sso";

/**
 * The two sign-outs, as pure steps so their ORDER can be unit-tested without a browser
 * (BAM, 2026-10-29, witus task 128 option (b)):
 *
 *   - "Sign out" ends ONLY this app's session, then goes to the local home. It never touches the
 *     IdP: other WitUS apps and the WitUS session stay signed in, so the next "Sign in with WitUS"
 *     goes straight through.
 *   - "Sign out of WitUS everywhere" ends this app's session, then sends the browser to the IdP's
 *     end-session endpoint so the shared WitUS session ends too. Offered only when the server
 *     resolved an end-session URL (this app is a provisioned ecosystem OIDC client).
 *
 * This replaces the 2026-08-30 behaviour where the one plain button also ended the WitUS session.
 * The components that call these live in src/components/layout/sign-out-button.tsx.
 */

/** "Sign out": local session, then the local destination. Never the IdP. */
export async function signOutHere(deps: {
  endLocalSession: () => Promise<unknown>;
  goLocal: () => void;
}): Promise<void> {
  // Awaited with its error swallowed: a failed local call still leaves the visitor on the local
  // page, where the server-rendered header shows whatever session state is actually true.
  await deps.endLocalSession().catch(() => null);
  deps.goLocal();
}

/** "Sign out of WitUS everywhere": local session FIRST, then a full navigation to the IdP. */
export async function signOutEverywhere(deps: {
  endLocalSession: () => Promise<unknown>;
  endSessionUrl: string;
  origin: string;
  assign: (url: string) => void;
}): Promise<void> {
  // ORDER IS THE SAFETY PROPERTY. The local session is destroyed before the hand-off, so if the
  // IdP refuses the logout, is unreachable, or the redirect never completes, the person is still
  // signed out HERE. Never hand off first and destroy locally afterwards: that turns any IdP
  // failure into "I clicked sign out and I am still signed in".
  await deps.endLocalSession().catch(() => null);
  // A full navigation, not router.push: this leaves our origin for the IdP, which then returns to
  // the post_logout_redirect_uri (`origin + "/"`).
  deps.assign(withPostLogoutRedirect(deps.endSessionUrl, deps.origin));
}
