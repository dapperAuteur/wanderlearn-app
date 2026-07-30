import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Sentry `beforeSend` scrubber. The last thing that runs before a crash report leaves this app for
 * a third party (Better Stack, via the Sentry ingest protocol).
 *
 * Why this file exists
 * --------------------
 * A crash report is a copy of whatever the app was holding when it broke, and several of the things
 * this app holds are working credentials:
 *   - the Better Auth password-reset link, `/api/auth/reset-password/<token>?callbackURL=...`, which
 *     bounces to `/{lang}/reset-password?token=...` (account takeover);
 *   - `Authorization: Bearer ...` and the session cookie on any server request;
 *   - `?secret=<CRON_SECRET>` on `/api/cron/daily`, which we accept for local curl testing;
 *   - `DATABASE_URL`, whose password sits in the userinfo of a `postgres://` connection string and
 *     therefore appears verbatim in most Neon / Drizzle error messages;
 *   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `CLOUDINARY_API_SECRET`, which land in error
 *     text as `NAME=value` whenever a vendor SDK complains about them.
 * None of that is needed to fix a bug, and all of it is dangerous in a second system.
 *
 * It never returns null. We still want the crash signal, just with the credentials stripped.
 *
 * Constraints this file is written under
 * -------------------------------------
 * 1. NO REGEX LOOKBEHIND. This module is imported by `instrumentation-client.ts`, so it parses in
 *    the browser, and a lookbehind assertion is a SyntaxError on iOS Safari below 16.4 -- which
 *    would break the whole chunk EVEN WITH NO DSN SET. Boundaries are expressed as leading capture
 *    groups instead, and a unit test asserts the assertion syntax appears nowhere in this file.
 * 2. NO `\b` FOR NAME BOUNDARIES. `_` is a word character, so `\b(secret)\b` never matches
 *    `STRIPE_WEBHOOK_SECRET`. Names are split into segments and compared segment by segment.
 * 3. KEY-AWARE, NOT JUST SHAPE-AWARE. A bare value under a `client_secret` key matches no value
 *    pattern; the only thing that marks it as a credential is the name beside it.
 * 4. MATCH PER SEGMENT, NEVER BY SUBSTRING. A substring test redacts `design` (contains "sig") and
 *    `keyboard` (contains "key"), which throws away debuggable context for nothing.
 */

/** What replaces a redacted value. Stable so tests and eyeballs can both recognise it. */
export const REDACTED = "[redacted]";

/**
 * What replaces a redacted email address. Distinct from {@link REDACTED} so a reader of the report
 * can tell that PII was removed rather than a credential.
 */
export const REDACTED_EMAIL = "[redacted email]";

/**
 * Name segments that make a value a bearer credential no matter what it looks like.
 * `session` is in here because `session_id` on the Stripe success page is a capability handle.
 */
const HARD_SECRET_SEGMENTS = new Set([
  "auth",
  "authorization",
  "oauth",
  "oauth2",
  "bearer",
  "token",
  "tokens",
  "secret",
  "secrets",
  "password",
  "passwords",
  "passwd",
  "pwd",
  "passphrase",
  "passcode",
  "pin",
  "otp",
  "totp",
  "mfa",
  "cookie",
  "cookies",
  "session",
  "sessions",
  "jwt",
  "credential",
  "credentials",
  "private",
  "magic",
  "invite",
  "dsn",
]);

/**
 * Segments that mean "credential" only when nothing marks them public. A `key` is a secret; a
 * `publishable_key` is deliberately shipped to browsers and is one of the more useful things to see
 * in a report ("wrong Stripe account" is a real bug shaped exactly like that).
 */
const KEY_SEGMENTS = new Set(["key", "keys", "apikey", "signature", "sig", "hmac", "salt", "hash", "digest"]);

/** Segments that neutralise {@link KEY_SEGMENTS}. `NEXT_PUBLIC_*` is public by construction. */
const PUBLIC_QUALIFIERS = new Set(["public", "publishable", "pk"]);

/**
 * `code` is the problem child. `?code=` on an OAuth callback IS an authorization code, but
 * `status_code`, `country_code`, `locale_code`, and `error_code` are exactly the fields you want in
 * a crash report. So `code` counts as a credential unless one of these sits beside it.
 */
const CODE_QUALIFIERS = new Set([
  "status",
  "error",
  "http",
  "country",
  "postal",
  "zip",
  "area",
  "locale",
  "lang",
  "language",
  "currency",
  "iso",
  "region",
  "color",
  "colour",
  "exit",
  "reason",
  "coupon",
  "promo",
]);

/**
 * Deliberately absent from every set above, because redacting them costs debuggability and buys
 * nothing:
 *   - `state`, `csrf`, `nonce` -- anti-forgery values. They authorise nothing on replay, and
 *     `state` doubles as a US state code across an education catalog.
 *   - `id`, `slug`, `email_id`, `trace_id` -- identifiers, not credentials.
 * The unit test asserts these survive, so a future widening of the sets has to argue with a test.
 */

/**
 * Split a name into comparable segments. Handles `snake_case`, `kebab-case`, `dotted.paths`,
 * `bracket[0]` indexes, `camelCase`, and `ACRONYMCase`.
 *
 * `STRIPE_WEBHOOK_SECRET` -> ["stripe", "webhook", "secret"]
 * `clientSecret`          -> ["client", "secret"]
 * `X-API-Key`             -> ["x", "api", "key"]
 * `keyboard`              -> ["keyboard"]   (NOT ["key", "board"] -- so it is not a credential)
 */
function nameSegments(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * EXACT names -- not segments -- that carry a credential in THIS app specifically and would slip
 * past any generic word list.
 *
 *   `k` -- the private tour preview link, `/tours/<slug>?k=<token>`. It is a rotatable capability
 *          token, constant-time checked in `src/app/[lang]/tours/[destinationSlug]/page.tsx`, and
 *          anyone holding it can read an unpublished partner tour. A single letter matches no
 *          dictionary of secret-sounding words, so it has to be named here or it leaks.
 */
const REPO_SECRET_NAMES = new Set(["k"]);

/**
 * EXACT names that carry the caller's IP address. Not credentials, so they are kept separate from
 * the secret sets, but `event.user.ip_address` is deleted below and leaving the SAME value in a proxy
 * header or in `request.env` would simply put it back.
 */
const IP_ADDRESS_NAMES = new Set([
  "ip",
  "ip_address",
  "ipaddress",
  "remote_addr",
  "client_ip",
  "forwarded",
  "x-forwarded-for",
  "x-real-ip",
  "x-client-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "x-vercel-proxied-for",
]);

/** Does this name carry a caller IP address? */
export function isIpAddressName(name: string): boolean {
  return IP_ADDRESS_NAMES.has(name.toLowerCase());
}

/** Does this field / param / header / env name identify a bearer credential? */
export function isSecretName(name: string): boolean {
  if (REPO_SECRET_NAMES.has(name.toLowerCase())) return true;
  const segments = nameSegments(name);
  if (segments.some((s) => HARD_SECRET_SEGMENTS.has(s))) return true;
  if (segments.some((s) => KEY_SEGMENTS.has(s))) {
    return !segments.some((s) => PUBLIC_QUALIFIERS.has(s));
  }
  if (segments.indexOf("code") !== -1) {
    return !segments.some((s) => CODE_QUALIFIERS.has(s));
  }
  return false;
}

/**
 * Path segments that only exist to issue or redeem a credential. Taken from this app's real routes
 * (`src/app/api/auth/[...all]`, `/{lang}/reset-password`, `/{lang}/forgot-password`,
 * `/api/media/cloudinary-sign`) plus the Better Auth sub-paths those routes delegate to.
 */
const CREDENTIAL_PATH_SEGMENTS = new Set([
  "auth",
  "oauth",
  "oauth2",
  "callback",
  "sign-in",
  "signin",
  "sign-up",
  "signup",
  "sign-out",
  "signout",
  "login",
  "logout",
  "session",
  "sessions",
  "reset",
  "reset-password",
  "forgot-password",
  "set-password",
  "verify-email",
  "confirm",
  "activate",
  "magic-link",
  "magic",
  "invite",
  "invites",
  "join",
  "accept",
  "unsubscribe",
  "token",
  "tokens",
  "share",
  "cloudinary-sign",
  "passkey",
  "two-factor",
]);

/** Long, opaque, drawn from the alphabet our token generators use (hex / base64url / nanoid / uuid). */
const TOKENISH_SEGMENT_RE = /^[A-Za-z0-9_-]{16,}$/;

/**
 * A path segment that looks machine-generated rather than authored. Requires a digit or mixed case
 * on top of the length test, so a long human route name (`cloudinary-signature`, `forgot-password`)
 * is not mistaken for a token.
 */
function looksGenerated(segment: string): boolean {
  if (!TOKENISH_SEGMENT_RE.test(segment)) return false;
  if (CREDENTIAL_PATH_SEGMENTS.has(segment.toLowerCase())) return false;
  const hasDigit = /[0-9]/.test(segment);
  const mixedCase = /[a-z]/.test(segment) && /[A-Z]/.test(segment);
  return hasDigit || mixedCase;
}

/**
 * Mask token-shaped segments, but ONLY on a path that exists to carry a credential.
 *
 * This is the path-context-over-shape rule: a reset token and a destination id are both 36-ish
 * opaque characters, so a shape-only rule either leaks the token or destroys every resource id in
 * every stack trace. `/api/auth/reset-password/<token>` is masked;
 * `/en/creator/destinations/<uuid>/scenes/<uuid>` is preserved, because the whole point of a crash
 * report is being able to open the thing that crashed.
 */
function scrubPath(pathname: string): string {
  const segments = pathname.split("/");
  const isCredentialPath = segments.some((s) => CREDENTIAL_PATH_SEGMENTS.has(s.toLowerCase()));
  if (!isCredentialPath) return pathname;
  return segments.map((s) => (looksGenerated(s) ? REDACTED : s)).join("/");
}

/**
 * Is this value already our redaction marker -- possibly TRUNCATED, because an outer match ended at
 * the marker's own closing bracket?
 *
 * Without this, scrubbing twice is not the same as scrubbing once: `URL_RE` stops at `]`, so a
 * second pass over `?token=[redacted]` sees the value `[redacted`, redacts it again, and leaves
 * `[redacted]]` behind. Sentry only calls `beforeSend` once, but a scrubber whose output is not a
 * fixed point is a scrubber that is doing something it did not intend to somewhere else.
 */
function alreadyRedacted(value: string): boolean {
  if (value.charAt(0) !== "[") return false;
  return REDACTED.indexOf(value) === 0 || value.indexOf(REDACTED) === 0 || value === REDACTED_EMAIL;
}

/** Percent-decode a param name for the secret test, without throwing on malformed input. */
function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

/**
 * Scrub a QUERY STRING, which is a separate job from scrubbing a URL.
 *
 * `event.request.query_string` is its own field on the Sentry payload and a bare query string is
 * NOT a parseable URL -- `new URL("token=abc&next=/x")` throws. A URL-only pass therefore misses
 * `token=` and `code=` entirely, which is the single easiest way to ship this file and still leak.
 * Accepts a leading `?` (or `#`) and preserves it.
 */
export function scrubQueryString(queryString: string): string {
  const lead = queryString.charAt(0) === "?" || queryString.charAt(0) === "#" ? queryString.charAt(0) : "";
  const body = lead ? queryString.slice(1) : queryString;
  if (!body) return queryString;
  return (
    lead +
    body
      .split("&")
      .map((pair) => {
        if (!pair) return pair;
        const eq = pair.indexOf("=");
        const rawName = eq === -1 ? pair : pair.slice(0, eq);
        if (!isSecretName(decodeName(rawName))) return pair;
        if (eq !== -1 && alreadyRedacted(pair.slice(eq + 1))) return pair;
        return `${rawName}=${REDACTED}`;
      })
      .join("&")
  );
}

/**
 * Scrub a URL: drop any userinfo credentials, mask secret query params and fragment params, and
 * mask token-shaped path segments on credential paths. Built by string assembly rather than
 * `searchParams.set` so the surviving values are not re-encoded into unreadable soup.
 *
 * Falls back to path+query handling for anything `new URL` rejects, which is the common case for
 * `event.request.url` on a Next server (often a root-relative path).
 */
export function scrubUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    const hash = raw.indexOf("#");
    const withoutHash = hash === -1 ? raw : raw.slice(0, hash);
    const fragment = hash === -1 ? "" : scrubQueryString(raw.slice(hash));
    const q = withoutHash.indexOf("?");
    if (q === -1) return scrubPath(withoutHash) + fragment;
    return scrubPath(withoutHash.slice(0, q)) + scrubQueryString(withoutHash.slice(q)) + fragment;
  }
  // `url.origin` excludes userinfo, so `https://user:pass@host` loses its credentials here.
  const base = url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
  const search = url.search ? scrubQueryString(url.search) : "";
  const hash = url.hash ? scrubQueryString(url.hash) : "";
  return `${base}${scrubPath(url.pathname)}${search}${hash}`;
}

/** Absolute http(s) URLs inside prose. Closing brackets and quotes end the match, not the URL. */
const URL_RE = /https?:\/\/[^\s<>"'`)\]}]+/g;

/**
 * A ROOT-RELATIVE path inside prose, e.g. `POST /api/auth/reset-password/<token> 500`. `URL_RE` only
 * matches absolute URLs, and server log lines are usually relative, so without this a token sitting
 * in an error message survives every other rule (there is no `name=value` for the label rule to key
 * off). The leading group is a capture group, not a lookbehind, and it deliberately excludes an
 * alphanumeric so the path portion of an already-scrubbed absolute URL is not matched twice.
 */
const RELATIVE_PATH_RE = /(^|[\s"'(<[])(\/[A-Za-z0-9._~%+-]+(?:\/[A-Za-z0-9._~%+-]*)*)/g;

/**
 * `scheme://user:password@host` for non-http schemes -- the shape `DATABASE_URL` has. No `\b` and
 * no lookbehind: the scheme is captured and re-emitted, so the leftmost match starts at the scheme.
 */
const CONNECTION_CREDENTIALS_RE = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^\s:@/]+):([^\s@/]+)@/g;

/** A JWT. Unambiguous enough to redact on shape alone, with or without a name beside it. */
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g;

/**
 * Vendor secret prefixes. The leading `(^|[^A-Za-z0-9])` is a capture group standing in for a
 * lookbehind, and it deliberately ALLOWS `_` before the prefix so `MY_sk_live_...` still matches.
 * The separator is `[_-]` because Stripe uses `sk_` and Slack uses `xoxb-`.
 * `pk_` is absent on purpose: a publishable key is meant to be public.
 */
const VENDOR_SECRET_RE =
  /(^|[^A-Za-z0-9])((?:sk|rk|whsec|xox[abopsr]|gh[pousr]|glpat|shpat|dop_v1)[_-][A-Za-z0-9_-]{10,})/gi;

/**
 * An email address. Not a credential, but it IS the learner PII this app holds most of, and
 * `sendDefaultPii: false` only stops the SDK attaching it automatically -- it does nothing about an
 * address sitting in a request body or an error message.
 */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** `Bearer <token>` / `Basic <token>`, which carry no `name=value` separator to key off. */
const BEARER_RE = /(^|[^A-Za-z0-9])(Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{8,})/gi;

/**
 * `NAME=value` / `NAME: value` / `"NAME": "value"`. Two details are load-bearing:
 *
 *  - the name group spans `_`, `-`, and `.` so the WHOLE env-var-shaped name is captured and can be
 *    segment-tested. This is the reason a `\b`-anchored word list silently misses
 *    `STRIPE_WEBHOOK_SECRET`;
 *  - the tail is `{0,63}`, not `{1,63}`, so a ONE-CHARACTER name matches. `?k=<token>` is this app's
 *    private tour preview link, and a two-character minimum skipped it entirely inside free text.
 *
 * Broad by design: it matches nearly every `name=value` in a message, and `isSecretName` decides.
 */
const LABELLED_VALUE_RE =
  /([A-Za-z][A-Za-z0-9_.[\]-]{0,63})["']?\s*(=|:)\s*["']?([^\s"'`,;&<>{}]{3,})/g;

/**
 * Remove every credential we can recognise from a free-text string (a message, an exception value,
 * a breadcrumb, a header value).
 *
 * Order matters: URLs are handled while they are still whole, then the narrow shape rules, then the
 * broad `name=value` rule last so it cannot eat a value a narrower rule wanted.
 */
export function scrubText(text: string): string {
  let out = text.replace(URL_RE, (match) => scrubUrl(match));
  out = out.replace(RELATIVE_PATH_RE, (_m, before: string, path: string) => `${before}${scrubPath(path)}`);
  out = out.replace(CONNECTION_CREDENTIALS_RE, (_m, scheme: string, user: string) => `${scheme}${user}:${REDACTED}@`);
  out = out.replace(JWT_RE, REDACTED);
  out = out.replace(EMAIL_RE, REDACTED_EMAIL);
  out = out.replace(VENDOR_SECRET_RE, (_m, before: string) => `${before}${REDACTED}`);
  out = out.replace(BEARER_RE, (_m, before: string, scheme: string) => `${before}${scheme} ${REDACTED}`);
  out = out.replace(LABELLED_VALUE_RE, (match, name: string, separator: string, value: string) => {
    if (!isSecretName(name)) return match;
    if (alreadyRedacted(value)) return match;
    return separator === ":" ? `${name}: ${REDACTED}` : `${name}=${REDACTED}`;
  });
  return out;
}

/** Depth cap so a self-referential or absurdly nested payload cannot stall the error path. */
const MAX_DEPTH = 8;

/**
 * Walk arbitrary attached data, redacting by KEY as well as by value shape. The key-aware half is
 * the load-bearing one: `{ client_secret: "abc123xyz" }` has a value that matches no pattern on
 * earth, and the only thing that identifies it is the name.
 *
 * Mutates in place, which is what `beforeSend` is allowed to do, and is cheaper than cloning a
 * payload on the error path.
 */
function scrubDeep(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return scrubText(value);
  if (!value || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = scrubDeep(value[i], depth + 1, seen);
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const current = record[key];
    const redactable = current !== undefined && current !== null;
    if (redactable && (isSecretName(key) || isIpAddressName(key))) record[key] = REDACTED;
    else record[key] = scrubDeep(current, depth + 1, seen);
  }
  return record;
}

/**
 * `beforeSend`. Scrubs every field a credential can ride in, then returns the event so the crash is
 * still reported.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const seen = new WeakSet<object>();

  if (typeof event.message === "string") event.message = scrubText(event.message);
  if (event.logentry && typeof event.logentry.message === "string") {
    event.logentry.message = scrubText(event.logentry.message);
  }
  if (event.logentry && event.logentry.params) {
    event.logentry.params = scrubDeep(event.logentry.params, 1, seen) as unknown[];
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) {
      // Local-variable capture is off by default, but if it is ever turned on this is a firehose.
      if (frame.vars) frame.vars = scrubDeep(frame.vars, 1, seen) as Record<string, unknown>;
    }
  }

  // Never ship the account identity or the network origin. `id` stays: it is an identifier, not a
  // credential, and without it a report cannot be tied to a support thread.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
    scrubDeep(event.user, 1, seen);
  }

  if (event.request) {
    const request = event.request;
    if (typeof request.url === "string") request.url = scrubUrl(request.url);
    if (typeof request.query_string === "string") {
      request.query_string = scrubQueryString(request.query_string);
    } else if (Array.isArray(request.query_string)) {
      // The array-of-pairs form needs its own branch: a generic deep walk would see the numeric array
      // indices as the keys, so the param NAME would never be tested and the token would survive.
      request.query_string = request.query_string.map(([name, value]) =>
        isSecretName(name) ? [name, REDACTED] : [name, scrubText(value)],
      ) as typeof request.query_string;
    } else if (request.query_string) {
      // The record form is keyed by param name, so the ordinary key-aware walk is correct.
      request.query_string = scrubDeep(request.query_string, 1, seen) as typeof request.query_string;
    }
    delete request.cookies;
    if (request.headers) {
      const headers = request.headers;
      for (const key of Object.keys(headers)) {
        if (isSecretName(key)) delete headers[key];
        // Kept as a marker rather than deleted, so "there was a proxy in front of this" survives.
        else if (isIpAddressName(key)) headers[key] = REDACTED;
        else if (typeof headers[key] === "string") headers[key] = scrubText(headers[key]);
      }
    }
    if (request.env) request.env = scrubDeep(request.env, 1, seen) as Record<string, string>;
    if (request.data !== undefined) request.data = scrubDeep(request.data, 1, seen);
  }

  // The browser SDK records EVERY fetch/xhr URL as a breadcrumb, which makes this the busiest leak
  // surface on the client: a single `POST /api/auth/reset-password/<token>` crumb undoes the rest.
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubText(crumb.message);
    if (crumb.data) crumb.data = scrubDeep(crumb.data, 1, seen) as Record<string, unknown>;
  }

  if (event.extra) event.extra = scrubDeep(event.extra, 1, seen) as typeof event.extra;

  if (event.tags) {
    const tags = event.tags;
    for (const key of Object.keys(tags)) {
      const current = tags[key];
      if (isSecretName(key) && current !== undefined && current !== null) tags[key] = REDACTED;
      else if (typeof current === "string") tags[key] = scrubText(current);
    }
  }

  if (event.contexts) {
    for (const name of Object.keys(event.contexts)) {
      // `contexts.trace` is exempt: trace_id / span_id are how a report joins the rest of the
      // timeline, they are opaque ids rather than credentials, and masking them orphans the event.
      if (name === "trace") continue;
      const context = event.contexts[name];
      if (context) event.contexts[name] = scrubDeep(context, 1, seen) as typeof context;
    }
  }

  return event;
}
