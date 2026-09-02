import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  endSessionEndpointFromDiscovery,
  hasAttemptMarker,
  parseSilentSsoIdentity,
  silentSsoDecision,
  silentSsoEndpointFromDiscovery,
  withAttemptMarker,
  withPostLogoutRedirect,
} from "@/lib/silent-sso";

/**
 * Ecosystem SSO: the silent "Continue as <name>" check and global sign-out.
 *
 * Pinned here in order of what each would cost if it broke:
 *   1. THE REDIRECT LOOP. probe -> "Continue as X" -> click -> IdP declines -> back to sign-in ->
 *      probe. It never appears in normal use, so it is simulated end to end below.
 *   2. SIGN-OUT ORDER. The local session must die before the IdP is asked anything, or an
 *      unreachable IdP turns "sign out" into "still signed in".
 *   3. THE TRAILING SLASH on post_logout_redirect_uri. Better-Auth exact-matches it against the
 *      registered redirectUrls; without the slash the IdP answers 400.
 *   4. INVISIBLE FAILURE. Nothing the probe can return may produce an error, a stuck spinner, or
 *      a claim about who the visitor is.
 */

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

/** Assertions about what the CODE does must not be satisfied (or broken) by a comment. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DISCOVERY = "https://accounts.witus.online/api/idp/.well-known/openid-configuration";
const ENDPOINT = "https://accounts.witus.online/api/ecosystem/session";

describe("the gate: neither feature fires unless this app is a configured OIDC client", () => {
  it("refuses when the gate is off, no matter what else is true", () => {
    for (const search of ["", "?next=/tours", "?sso=tried"]) {
      for (const attempted of [false, true]) {
        for (const signedIn of [false, true]) {
          expect(
            silentSsoDecision({ enabled: false, endpoint: ENDPOINT, search, attempted, signedIn }),
          ).toEqual({ attempt: false, skip: "not-configured" });
        }
      }
    }
  });

  it("refuses when there is no endpoint to ask", () => {
    for (const endpoint of [null, undefined, ""]) {
      expect(silentSsoDecision({ enabled: true, endpoint, search: "" })).toEqual({
        attempt: false,
        skip: "not-configured",
      });
    }
  });

  it("does not ask on behalf of someone already signed in", () => {
    expect(silentSsoDecision({ enabled: true, endpoint: ENDPOINT, signedIn: true })).toEqual({
      attempt: false,
      skip: "already-signed-in",
    });
  });

  it("attempts on a clean first visit with the gate on", () => {
    expect(silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search: "" })).toEqual({
      attempt: true,
    });
  });

  it("is enforced on the server, and the endpoint reaches the client only through that gate", () => {
    const page = read("src/app/[lang]/sign-in/page.tsx");
    // hasWitusSso is resolved from the env on the server; the client never reads the raw env.
    expect(page).toContain("showWitusSso={hasWitusSso}");
    expect(page).toContain("witusSilentSsoEndpoint={witusSilentSsoEndpoint}");

    const form = read("src/app/[lang]/sign-in/sign-in-form.tsx");
    // The button is rendered inside `showWitusSso ? ... : null` and nowhere else.
    expect(form).toContain("{showWitusSso ? (");
    expect(form.split("<WitusSsoButton").length - 1).toBe(1);

    // Both env exports are dark without a client id.
    const env = read("src/lib/env.ts");
    expect(env).toContain("export const witusSilentSsoEndpoint: string | null = hasWitusSso");
    expect(env).toContain("if (!clientId) return null;");
  });

  it("is repeated as a hard precondition inside the component", () => {
    const component = read("src/components/witus-sso-button.tsx");
    expect(component).toContain("if (!enabled) return null;");
    // Exactly one network call, and the decision function is what guards it.
    expect(component.split("fetch(").length - 1).toBe(1);
    const effect = component.slice(
      component.indexOf("useEffect(() => {"),
      component.indexOf("fetch("),
    );
    expect(effect).toContain("silentSsoDecision({");
    expect(effect).toContain("if (!decision.attempt || !endpoint) return;");
  });

  it("only ever asks the server-resolved endpoint, never one it builds itself", () => {
    // Comments may name the IdP; CODE must not. A URL literal here would be a client-side default
    // that could outlive the gate.
    const code = stripComments(read("src/components/witus-sso-button.tsx"));
    expect(code).not.toContain("https://");
    expect(code).not.toContain("witus.online");
    expect(code).toContain("const endpoint = silentCheckUrl;");
    expect(code).toContain("fetch(endpoint,");
  });
});

describe("the redirect loop: simulating an IdP that will not sign the visitor in", () => {
  it("attempts once, then never again in that tab", () => {
    // 1. First arrival: no marker anywhere.
    let storage = false;
    expect(
      silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search: "", attempted: storage }),
    ).toEqual({ attempt: true });

    // 2. The probe answered, the visitor clicked, and the marker is written BEFORE the redirect.
    storage = true;

    // 3. The flow failed and Better-Auth returned to the errorCallbackURL the button built.
    const back = withAttemptMarker("/en/sign-in?next=%2Fen%2Ftours");
    expect(back).toBe("/en/sign-in?next=%2Fen%2Ftours&sso=tried");
    const search = new URL(back, "https://wanderlust.witus.online").search;

    // 4. Back on the sign-in page. Both halves of the marker now say stop.
    expect(
      silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search, attempted: storage }),
    ).toEqual({ attempt: false, skip: "already-attempted" });

    // 5. sessionStorage alone stops it (the visitor navigated back to a bare sign-in page).
    expect(
      silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search: "", attempted: true }),
    ).toEqual({ attempt: false, skip: "already-attempted" });

    // 6. The query param alone stops it — the case that matters in a browser where
    //    sessionStorage throws or is empty (private mode, a return into a fresh tab).
    expect(
      silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search, attempted: false }),
    ).toEqual({ attempt: false, skip: "already-attempted" });
  });

  it("writes the marker BEFORE redirecting, never after the return", () => {
    const component = read("src/components/witus-sso-button.tsx");
    const write = component.indexOf("writeAttempted();");
    const redirect = component.indexOf("authClient.signIn");
    expect(write).toBeGreaterThan(-1);
    expect(redirect).toBeGreaterThan(-1);
    // A marker written after the redirect is a marker that does not exist when the return is the
    // thing that failed, which is precisely the loop.
    expect(write).toBeLessThan(redirect);
    expect(component).toContain("SSO_ATTEMPT_STORAGE_KEY");
    expect(SSO_ATTEMPT_STORAGE_KEY).toBe("witus.sso.attempted");
  });

  it("wraps every sessionStorage access, because it throws outright in some privacy modes", () => {
    const component = read("src/components/witus-sso-button.tsx");
    const helpers = component.slice(component.indexOf("function readAttempted"));
    expect(helpers).toContain("function writeAttempted");
    // One catch per helper: a read that throws must not break the page, and a write that throws
    // must not stop the sign-in it was about to guard.
    expect(helpers.split("catch {").length - 1).toBe(2);
  });
});

describe("the one-shot marker", () => {
  it("reads only its own exact value", () => {
    expect(hasAttemptMarker("?sso=tried")).toBe(true);
    expect(hasAttemptMarker("sso=tried")).toBe(true);
    expect(hasAttemptMarker("?next=%2Ftours&sso=tried")).toBe(true);
    expect(hasAttemptMarker("?sso=something-else")).toBe(false);
    expect(hasAttemptMarker("?next=/sso=tried")).toBe(false);
    expect(hasAttemptMarker("")).toBe(false);
    expect(hasAttemptMarker(null)).toBe(false);
    expect(hasAttemptMarker(undefined)).toBe(false);
  });

  it("keeps the intended destination when it marks a path", () => {
    expect(withAttemptMarker("/en/sign-in?next=%2Fen%2Ftours%2Fmucho")).toBe(
      "/en/sign-in?next=%2Fen%2Ftours%2Fmucho&sso=tried",
    );
    expect(withAttemptMarker("/es/sign-in")).toBe("/es/sign-in?sso=tried");
    expect(withAttemptMarker("/en/sign-in#form")).toBe("/en/sign-in?sso=tried#form");
  });

  it("is idempotent, so a second pass cannot stack duplicates", () => {
    const once = withAttemptMarker("/en/sign-in?next=%2Fen");
    expect(withAttemptMarker(once)).toBe(once);
  });
});

describe("the endpoints are derived, never invented", () => {
  it("turns the configured discovery URL into the IdP's ecosystem session route", () => {
    expect(silentSsoEndpointFromDiscovery(DISCOVERY)).toBe(ENDPOINT);
    // The probe lives at a FIXED path on the IdP's origin, not under its Better-Auth basePath,
    // so an IdP mounted at the root derives the same route.
    expect(
      silentSsoEndpointFromDiscovery("https://id.example.test/.well-known/openid-configuration"),
    ).toBe("https://id.example.test/api/ecosystem/session");
  });

  it("never probes Better-Auth's /get-session, which would expose a session token", () => {
    // /get-session returns { session, user } and `session` carries the SESSION TOKEN, so a
    // credentialed cross-origin probe there would let any ecosystem origin — or an XSS on one —
    // lift a live IdP session. If someone "fixes" the probe by re-deriving that path, this fails.
    for (const discovery of [DISCOVERY, "https://id.example.test/.well-known/openid-configuration"]) {
      expect(silentSsoEndpointFromDiscovery(discovery)).not.toContain("get-session");
    }
  });

  it("derives the RP-initiated logout endpoint under the IdP's basePath", () => {
    expect(endSessionEndpointFromDiscovery(DISCOVERY)).toBe(
      "https://accounts.witus.online/api/idp/oauth2/endsession",
    );
  });

  it("returns null rather than guessing when there is nothing to derive from", () => {
    for (const bad of [null, undefined, "", "not a url", "https://accounts.witus.online/api/idp"]) {
      expect(silentSsoEndpointFromDiscovery(bad)).toBeNull();
      expect(endSessionEndpointFromDiscovery(bad)).toBeNull();
    }
  });

  it("names the discovery URL exactly once in the codebase", () => {
    // Two copies that drift would send the silent probe to a different IdP than the click signs
    // in against. src/lib/auth.ts now imports the resolved value from src/lib/env.ts.
    expect(read("src/lib/auth.ts")).toContain("discoveryUrl: witusDiscoveryUrl,");
    expect(stripComments(read("src/lib/auth.ts"))).not.toContain("openid-configuration");
  });
});

describe("global sign-out", () => {
  it("appends the redirect WITH its trailing slash, and with & not ?", () => {
    // THE TRAILING SLASH IS THE TEST. Better-Auth exact-matches post_logout_redirect_uri against
    // the client's registered redirectUrls and the IdP registry registers `origin + "/"`. Drop
    // the slash and the IdP answers 400 invalid_request.
    const base = "https://accounts.witus.online/api/idp/oauth2/endsession?client_id=wanderlearn";
    expect(withPostLogoutRedirect(base, "https://wanderlust.witus.online")).toBe(
      `${base}&post_logout_redirect_uri=${encodeURIComponent("https://wanderlust.witus.online/")}`,
    );
    expect(withPostLogoutRedirect(base, "https://wanderlust.witus.online")).toContain("%2F");
  });

  it("derives the origin at click time, so the host cutover cannot strand it", () => {
    // wanderlearn.witus.online -> wanderlust.witus.online. Both hosts serve this app during the
    // cutover, so a hardcoded origin would be wrong on one of them.
    const component = read("src/components/layout/sign-out-button.tsx");
    expect(component).toContain("window.location.origin");
    expect(stripComments(component)).not.toContain("witus.online");
  });

  it("destroys the local session BEFORE handing off to the IdP", () => {
    // ORDER IS THE SAFETY PROPERTY. Hand off first and any IdP failure becomes "I clicked sign
    // out and I am still signed in".
    const component = read("src/components/layout/sign-out-button.tsx");
    const local = component.indexOf("await signOut();");
    const handoff = component.indexOf("window.location.assign(");
    expect(local).toBeGreaterThan(-1);
    expect(handoff).toBeGreaterThan(local);
    // A full navigation, not a router push: it leaves this origin.
    expect(component).not.toMatch(/router\.push\([^)]*endSessionUrl/);
  });

  it("carries client_id, which Better-Auth requires alongside post_logout_redirect_uri", () => {
    // Without a verifiable id_token_hint — and there is none client-side — Better-Auth rejects
    // post_logout_redirect_uri with invalid_request unless client_id is present.
    expect(read("src/lib/env.ts")).toContain("?client_id=${encodeURIComponent(clientId)}");
  });

  it("says which kind of sign-out it is", () => {
    const component = read("src/components/layout/sign-out-button.tsx");
    expect(component).toContain("{endSessionUrl ? globalLabel : label}");
    const en = JSON.parse(read("src/app/[lang]/dictionaries/en.json"));
    expect(en.nav.signOut).toBe("Sign out");
    expect(en.nav.signOutGlobal).toBe("Sign out of WitUS");
    const es = JSON.parse(read("src/app/[lang]/dictionaries/es.json"));
    expect(typeof es.nav.signOutGlobal).toBe("string");
  });
});

describe("reading the probe answer", () => {
  it("finds the name in the IdP's ecosystem-session shape", () => {
    expect(parseSilentSsoIdentity({ signedIn: true, user: { name: "Brand Anthony McDonald" } })).toEqual(
      { label: "Brand Anthony McDonald" },
    );
  });

  it("accepts a bare user object and falls back to the email", () => {
    expect(parseSilentSsoIdentity({ name: "Ada", email: "ada@example.test" })).toEqual({
      label: "Ada",
    });
    expect(parseSilentSsoIdentity({ user: { name: "", email: "ada@example.test" } })).toEqual({
      label: "ada@example.test",
    });
  });

  it("returns nothing for every shape that means nobody is signed in", () => {
    expect(parseSilentSsoIdentity({ signedIn: false })).toBeNull();
    // A stale `user` alongside signedIn:false must not win.
    expect(parseSilentSsoIdentity({ signedIn: false, user: { name: "Ada" } })).toBeNull();
    expect(parseSilentSsoIdentity(null)).toBeNull();
    expect(parseSilentSsoIdentity(undefined)).toBeNull();
    expect(parseSilentSsoIdentity({})).toBeNull();
    expect(parseSilentSsoIdentity({ user: null })).toBeNull();
    expect(parseSilentSsoIdentity({ user: { id: "u1" } })).toBeNull();
    expect(parseSilentSsoIdentity("Ada")).toBeNull();
    expect(parseSilentSsoIdentity(42)).toBeNull();
    expect(parseSilentSsoIdentity([{ name: "Ada" }])).toBeNull();
  });

  it("cleans a name it did not author before putting it on a button", () => {
    // The answer comes from another origin, so it is untrusted input even though it is only ever
    // display copy. Control characters go, whitespace is trimmed, absurd lengths are capped.
    expect(parseSilentSsoIdentity({ name: "  Ada  Lovelace " })).toEqual({ label: "Ada Lovelace" });
    expect(parseSilentSsoIdentity({ name: "A\u0000d\u001Fa\u007F" })).toEqual({ label: "Ada" });
    expect(parseSilentSsoIdentity({ name: "   " })).toBeNull();
    const long = parseSilentSsoIdentity({ name: "N".repeat(300) });
    expect(long?.label.length).toBeLessThanOrEqual(48);
    expect(long?.label.endsWith("…")).toBe(true);
  });

  it("says the right thing in both states, in both locales", () => {
    const en = JSON.parse(read("src/app/[lang]/dictionaries/en.json")).auth;
    const es = JSON.parse(read("src/app/[lang]/dictionaries/es.json")).auth;
    for (const dict of [en, es]) {
      const copy = { signIn: dict.witusSsoCta, continueAs: dict.witusSsoContinueAs };
      expect(continueAsLabel(null, copy)).toBe(dict.witusSsoCta);
      expect(continueAsLabel({ label: "Ada" }, copy)).toContain("Ada");
      expect(continueAsLabel({ label: "Ada" }, copy)).not.toContain("{name}");
    }
    expect(continueAsLabel({ label: "Ada" }, { signIn: "x", continueAs: "Continue as {name}" })).toBe(
      "Continue as Ada",
    );
  });
});

describe("a failed check is invisible", () => {
  it("swallows every probe outcome and never renders an error", () => {
    const component = read("src/components/witus-sso-button.tsx");
    expect(component).toContain(".catch(() => {");
    // No error state to render, and no loading state that could hang: the button is fully usable
    // from first paint and only ever gains a better label.
    expect(component).not.toMatch(/useState[^\n]*[Ee]rror/);
    expect(component).not.toMatch(/useState[^\n]*[Ll]oading/);
    // The probe cannot hang the page open forever.
    expect(component).toContain("SILENT_SSO_TIMEOUT_MS");
    expect(component).toContain("controller.abort()");
  });

  it("asks with the cross-origin options the probe actually needs", () => {
    const component = read("src/components/witus-sso-button.tsx");
    // credentials:"include" IS the mechanism — the answer depends on the IdP's own cookie, which
    // is third-party here. Without it the probe answers "nobody" on every browser.
    for (const opt of ['credentials: "include"', 'mode: "cors"', 'cache: "no-store"']) {
      expect(component).toContain(opt);
    }
  });

  it("no longer redirects away from the sign-in page to ask the question", () => {
    // The prompt=none component (src/components/witus-silent-signin.tsx) is gone, and the
    // provider no longer accepts a silent flag. Leaving either in place would mean the page
    // navigates to the IdP before "Continue as ..." can ever render.
    const form = read("src/app/[lang]/sign-in/sign-in-form.tsx");
    expect(form).not.toContain("WitusSilentSignIn");
    expect(stripComments(read("src/lib/auth.ts"))).not.toContain("authorizationUrlParams");
  });
});
