/**
 * Ecosystem SSO: the silent "Continue as <name>" check, and the two IdP endpoints that
 * sign-in and sign-out derive from the discovery URL this app is already configured with.
 *
 * WHY A CROSS-ORIGIN PROBE AND NOT `prompt=none`. Being signed in to a sibling WitUS app does
 * not give this app a session — each client keeps its own cookie on its own host and the shared
 * session lives only on the IdP — so "am I already signed in?" is a question only the IdP can
 * answer. This app used to ask it with OIDC `prompt=none`, which works but is a NAVIGATION: you
 * leave the sign-in page to ask, and a visitor who is signed in nowhere (the common case on a
 * sign-in page) pays a full round trip to be told so. BAM chose the other design on 2026-08-30:
 * render the form immediately, ask the question in PARALLEL over CORS, and relabel the existing
 * button to "Continue as <name>" if an answer comes back. The `prompt=none` component that used
 * to live at src/components/witus-silent-signin.tsx is gone; this replaces it.
 *
 * WHAT THE PROBE BUYS AND WHAT IT DOES NOT. It carries the IdP's cookie as a THIRD-PARTY cookie,
 * so it answers on Chrome/Edge and answers nothing under Safari ITP or Firefox Total Cookie
 * Protection. That is the design, not a bug: a probe that answers nothing renders nothing and the
 * visitor keeps exactly the sign-in page they already had. A failed check must be invisible.
 *
 * THE IDENTITY THIS RETURNS IS DISPLAY COPY, NEVER A CREDENTIAL. It arrives from another origin,
 * so it is client-supplied by definition. It must never gate access, populate a session, or be
 * sent anywhere. Clicking the button runs the real OIDC code flow, which is the only thing that
 * establishes identity. Nothing in this file may ever be used to grant access.
 *
 * Pure helpers only: no `server-only`, no next/headers, no window access at module scope. The
 * unit tests (src/lib/silent-sso.test.ts, vitest node environment) import them directly.
 */

/** Query param marking "this browser already tried the ecosystem flow on this page". */
export const SSO_ATTEMPT_PARAM = "sso";
export const SSO_ATTEMPT_VALUE = "tried";

/**
 * sessionStorage key for the same marker. Written IMMEDIATELY BEFORE the redirect to the IdP,
 * never after coming back: a marker written on return is a marker that does not exist when the
 * return is the thing that failed — which is exactly the loop it has to stop.
 */
export const SSO_ATTEMPT_STORAGE_KEY = "witus.sso.attempted";

/** How long to wait for the probe before giving up. A silent check that hangs is a broken page. */
export const SILENT_SSO_TIMEOUT_MS = 4000;

/** Longest display name we will render. Caps a hostile or absurd value from blowing up the button. */
const MAX_LABEL_LENGTH = 48;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Identity shown on the button. Display only, never a credential. */
export type SsoIdentity = {
  /** What "Continue as ___" says. Already de-controlled, trimmed, and length-capped. */
  label: string;
};

export type SilentSsoSkip = "not-configured" | "already-attempted" | "already-signed-in";

export type SilentSsoDecision = { attempt: true } | { attempt: false; skip: SilentSsoSkip };

/**
 * Should this browser ask the IdP who it is?
 *
 * `enabled` is the SERVER-RESOLVED gate (`hasWitusSso`, handed down from the sign-in page). Both
 * features stay completely dark unless this app is a provisioned ecosystem OIDC client: an
 * affordance the visitor cannot complete is worse than no affordance.
 */
export function silentSsoDecision(input: {
  enabled: boolean;
  endpoint: string | null | undefined;
  search?: string | null;
  attempted?: boolean;
  signedIn?: boolean;
}): SilentSsoDecision {
  if (!input.enabled || !input.endpoint) return { attempt: false, skip: "not-configured" };
  if (input.signedIn) return { attempt: false, skip: "already-signed-in" };
  if (input.attempted || hasAttemptMarker(input.search)) {
    return { attempt: false, skip: "already-attempted" };
  }
  return { attempt: true };
}

/** Does this query string carry the one-shot marker? Accepts "?a=b" or "a=b". */
export function hasAttemptMarker(search: string | null | undefined): boolean {
  if (typeof search !== "string" || search === "") return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(SSO_ATTEMPT_PARAM) === SSO_ATTEMPT_VALUE;
}

/**
 * Add the one-shot marker to a same-origin path, preserving any query it already carries —
 * notably `?next=`, which is how the intended destination survives the round trip.
 */
export function withAttemptMarker(path: string): string {
  const [beforeHash, ...hashRest] = path.split("#");
  const hash = hashRest.length > 0 ? `#${hashRest.join("#")}` : "";
  const [pathname, ...queryRest] = beforeHash.split("?");
  const params = new URLSearchParams(queryRest.join("?"));
  params.set(SSO_ATTEMPT_PARAM, SSO_ATTEMPT_VALUE);
  return `${pathname}?${params.toString()}${hash}`;
}

/**
 * Split a discovery URL into the IdP's origin and its Better-Auth basePath.
 *
 *   https://accounts.witus.online/api/idp/.well-known/openid-configuration
 *     -> { origin: "https://accounts.witus.online", basePath: "/api/idp" }
 *
 * Everything below derives from this instead of naming accounts.witus.online a second time, so
 * the only external value this app asserts stays the discovery URL it is already configured with
 * (authoritative-values rule).
 */
function splitDiscoveryUrl(
  discoveryUrl: string | null | undefined,
): { origin: string; basePath: string } | null {
  if (!discoveryUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(discoveryUrl);
  } catch {
    return null;
  }
  const cut = parsed.pathname.indexOf("/.well-known/");
  if (cut < 0) return null;
  return { origin: parsed.origin, basePath: parsed.pathname.slice(0, cut) };
}

/**
 * The ecosystem session probe: `<idp-origin>/api/ecosystem/session`.
 *
 * A FIXED path on the IdP's origin, deliberately NOT under its Better-Auth basePath, and
 * deliberately NOT `<basePath>/get-session`. Better-Auth's `/get-session` answers with
 * `{ session, user }` and `session` carries the SESSION TOKEN, so a credentialed cross-origin
 * probe against it would let any ecosystem origin — or an XSS on any one of them — lift a live
 * IdP session. `/api/ecosystem/session` is the purpose-built replacement in gemini/witus: same
 * cookie, but it answers `{ signedIn, user: { name } }` and nothing else, with an allow-origin
 * list derived from the IdP's own client registry.
 */
export function silentSsoEndpointFromDiscovery(
  discoveryUrl: string | null | undefined,
): string | null {
  const parts = splitDiscoveryUrl(discoveryUrl);
  if (!parts) return null;
  return `${parts.origin}/api/ecosystem/session`;
}

/**
 * The IdP's RP-initiated logout endpoint, `<basePath>/oauth2/endsession` — the
 * `end_session_endpoint` its discovery document advertises. Unlike the probe, this one DOES live
 * under the Better-Auth basePath.
 *
 * BAM chose GLOBAL sign-out on 2026-08-30: signing out of one WitUS app signs you out of all of
 * them. Ending only this app's session leaves the shared session alive, and with "Continue as
 * ..." live that means signing out and coming back offers to sign you straight back in — which
 * reads as a broken sign-out.
 */
export function endSessionEndpointFromDiscovery(
  discoveryUrl: string | null | undefined,
): string | null {
  const parts = splitDiscoveryUrl(discoveryUrl);
  if (!parts) return null;
  return `${parts.origin}${parts.basePath}/oauth2/endsession`;
}

/**
 * Finish the end-session URL with where the IdP should send the browser back to.
 *
 * TRAILING SLASH IS REQUIRED. Better-Auth exact-matches `post_logout_redirect_uri` against the
 * client's registered redirectUrls and the IdP registry (gemini/witus lib/identity/clients.ts)
 * registers `origin + "/"`. Drop the slash and the IdP answers 400 invalid_request.
 *
 * The origin is read from `window.location.origin` at call time rather than baked in, because
 * this app is mid-cutover from wanderlearn.witus.online to wanderlust.witus.online and both
 * hosts serve it. NOTE: only the primary origin is registered as a post-logout target; from the
 * old host the IdP will refuse the redirect. The visitor is still signed out here either way,
 * which is the whole point of the ordering in sign-out-button.tsx.
 *
 * `&`, not `?`: the base URL already carries `client_id` (see src/lib/env.ts).
 */
export function withPostLogoutRedirect(endSessionUrl: string, origin: string): string {
  return `${endSessionUrl}&post_logout_redirect_uri=${encodeURIComponent(`${origin}/`)}`;
}

/**
 * Read a display name out of the probe response.
 *
 * Shapes handled: `{ signedIn, user: { name } }` (what the IdP serves), a bare user object, and
 * every signed-out answer — including Better-Auth's habit of returning 200 with a null body.
 * Anything else yields null, which renders nothing.
 */
export function parseSilentSsoIdentity(payload: unknown): SsoIdentity | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.signedIn === false) return null;
  const candidate =
    root.user && typeof root.user === "object" ? (root.user as Record<string, unknown>) : root;
  const label = cleanLabel(candidate.name) ?? cleanLabel(candidate.email);
  return label ? { label } : null;
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Control characters go first, then whitespace runs collapse: stripping a newline out of the
  // middle of a name otherwise leaves the two spaces that surrounded it sitting on the button.
  const cleaned = value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_LABEL_LENGTH
    ? `${cleaned.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`
    : cleaned;
}

/**
 * Button copy. Localised: the caller passes the dictionary strings, and `continueAs` carries a
 * `{name}` placeholder so Spanish can put the name where Spanish puts it.
 */
export function continueAsLabel(
  identity: SsoIdentity | null,
  copy: { signIn: string; continueAs: string },
): string {
  return identity ? copy.continueAs.replace("{name}", identity.label) : copy.signIn;
}
