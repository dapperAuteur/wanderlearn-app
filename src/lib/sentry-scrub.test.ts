import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { REDACTED, isSecretName, scrubEvent, scrubQueryString, scrubText, scrubUrl } from "./sentry-scrub";

/**
 * FIXTURES ARE ASSEMBLED AT RUNTIME, NEVER WRITTEN AS LITERALS.
 *
 * GitHub push protection scans pushed content for vendor-shaped secrets and rejects the whole push
 * when it finds one -- including inside a test file, where the "secret" is obviously fake. Joining
 * the parts at runtime produces the same string for the assertions without ever putting the shape in
 * the committed bytes.
 */
const fake = {
  stripeSecretKey: ["sk", "live", `51${"T".repeat(22)}9`].join("_"),
  stripeWebhookSecret: ["whsec", "b".repeat(32)].join("_"),
  slackBotToken: ["xoxb", "2".repeat(12), "3".repeat(12), "c".repeat(24)].join("-"),
  resetToken: `${"A1b2C3d4".repeat(4)}Zz`,
  sessionCookie: `${"S9t7Q2".repeat(6)}xY`,
  cronSecret: `${"c7R2n9".repeat(4)}Kk`,
  cloudinarySignature: "d".repeat(40),
  dbPassword: `np${"g7X2q9".repeat(3)}`,
  jwt: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", `${"Zm9vYmFy".repeat(3)}`, "s".repeat(27)].join("."),
  // Deliberately UUID-shaped: a destination id and a reset token are the same shape, and the point
  // of the path-context rule is that only one of them gets masked.
  destinationId: "3f2a91c4-58de-4b17-9a02-7c1d6e8f4b55",
  traceId: "a".repeat(32),
  spanId: "b".repeat(16),
  authCode: `${"q4T8w2"}${"Z"}${"9r5Y1m".repeat(3)}`,
  shareToken: `${"H3m8Kp".repeat(5)}vT`,
  learnerEmail: ["learner", "example.com"].join("@"),
};

function buildEvent(): ErrorEvent {
  return {
    // `ErrorEvent` is the Event union member whose `type` is explicitly undefined.
    type: undefined,
    message: `Checkout failed: STRIPE_SECRET_KEY=${fake.stripeSecretKey}`,
    exception: {
      values: [
        {
          type: "Error",
          value: `connect ECONNREFUSED postgres://neon_owner:${fake.dbPassword}@ep-quiet-fog-123456.us-east-2.aws.neon.tech/wanderlust`,
        },
      ],
    },
    user: {
      id: "usr_a1b2c3",
      email: fake.learnerEmail,
      ip_address: "203.0.113.9",
      username: "learner",
    },
    request: {
      method: "POST",
      url: `https://wanderlust.witus.online/api/auth/reset-password/${fake.resetToken}?callbackURL=%2Fen%2Freset-password`,
      // Lesson: this is a SEPARATE field from `url`, and a bare query string is not a parseable URL.
      query_string: `token=${fake.resetToken}&code=${fake.authCode}&next=%2Fen%2Fcourses&state=NY&status_code=500`,
      cookies: { "better-auth.session_token": fake.sessionCookie },
      headers: {
        host: "wanderlust.witus.online",
        authorization: `Bearer ${fake.jwt}`,
        cookie: `better-auth.session_token=${fake.sessionCookie}`,
        "x-api-key": fake.stripeWebhookSecret,
        "x-forwarded-for": "203.0.113.9, 198.51.100.4",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        referer: `https://wanderlust.witus.online/en/reset-password?token=${fake.resetToken}`,
      },
      data: {
        email: fake.learnerEmail,
        password: "correct horse battery staple",
        client_secret: fake.stripeWebhookSecret,
      },
      env: { STRIPE_WEBHOOK_SECRET: fake.stripeWebhookSecret },
    },
    breadcrumbs: [
      {
        category: "fetch",
        message: `POST /api/cron/daily?secret=${fake.cronSecret}`,
        data: {
          url: `https://wanderlust.witus.online/api/auth/reset-password/${fake.resetToken}`,
          method: "POST",
          status_code: 500,
        },
      },
      {
        category: "navigation",
        data: {
          from: `/en/creator/destinations/${fake.destinationId}/scenes`,
          to: `/en/reset-password?token=${fake.resetToken}`,
        },
      },
      {
        category: "navigation",
        // The private tour preview link. `k` is this app's own capability param.
        data: { to: `/en/tours/mucho-chocolate-museum?k=${fake.shareToken}` },
      },
    ],
    extra: {
      // Not a secret-sounding name at all -- only the value's shape gives it away.
      slackWebhook: fake.slackBotToken,
      note: `upstream returned ${fake.jwt} in the body`,
      tourId: fake.destinationId,
      design: "minimal",
      keyboard: "qwerty",
      nested: { deep: { apiKey: fake.stripeWebhookSecret } },
    },
    tags: {
      "app.locale": "es",
      session_id: `cs_test_${"9".repeat(24)}`,
      state: "NY",
      "server.region": "iad1",
    },
    contexts: {
      trace: { trace_id: fake.traceId, span_id: fake.spanId },
      cloudinary: { signature: fake.cloudinarySignature, cloud_name: "wanderlust" },
    },
  };
}

/**
 * Every leak assertion is made against the SERIALISED event, not against individual fields. A
 * field-by-field check only proves the fields you thought of are clean; stringifying the whole
 * payload means a secret surviving anywhere -- a field added by a future SDK version, a nested key
 * nobody enumerated -- still fails the test.
 */
const serialise = (event: ErrorEvent): string => JSON.stringify(event);

describe("scrubEvent", () => {
  it("removes every credential from the serialised event", () => {
    const out = serialise(scrubEvent(buildEvent()));

    expect(out).not.toContain(fake.stripeSecretKey);
    expect(out).not.toContain(fake.stripeWebhookSecret);
    expect(out).not.toContain(fake.slackBotToken);
    expect(out).not.toContain(fake.resetToken);
    expect(out).not.toContain(fake.sessionCookie);
    expect(out).not.toContain(fake.cronSecret);
    expect(out).not.toContain(fake.cloudinarySignature);
    expect(out).not.toContain(fake.dbPassword);
    expect(out).not.toContain(fake.jwt);
    expect(out).not.toContain(fake.authCode);
    expect(out).not.toContain(fake.shareToken);
    expect(out).not.toContain("correct horse battery staple");
  });

  it("removes learner identity and network origin", () => {
    const out = serialise(scrubEvent(buildEvent()));

    expect(out).not.toContain(fake.learnerEmail);
    expect(out).not.toContain("learner");
    // Deleting user.ip_address is pointless if the same address rides along in a proxy header.
    expect(out).not.toContain("203.0.113.9");
    expect(out).not.toContain("198.51.100.4");
    expect(scrubEvent(buildEvent()).request?.headers?.["x-forwarded-for"]).toBe(REDACTED);
    // The account id is an identifier, not a credential, and support needs it.
    expect(out).toContain("usr_a1b2c3");
  });

  it("does NOT over-redact: a scrubbed report is still worth reading", () => {
    const scrubbed = scrubEvent(buildEvent());
    const out = serialise(scrubbed);

    // Resource ids on non-credential paths survive, so you can open the thing that crashed.
    expect(out).toContain(fake.destinationId);
    expect(scrubbed.breadcrumbs?.[1]?.data?.from).toBe(`/en/creator/destinations/${fake.destinationId}/scenes`);

    // Trace context is exempt or the event is orphaned from its own timeline.
    expect(scrubbed.contexts?.trace?.trace_id).toBe(fake.traceId);
    expect(scrubbed.contexts?.trace?.span_id).toBe(fake.spanId);

    // Names that merely CONTAIN a secret-ish substring are not secrets.
    expect(scrubbed.extra?.design).toBe("minimal");
    expect(scrubbed.extra?.keyboard).toBe("qwerty");

    // `state` is a CSRF nonce and a US state code, never a bearer credential.
    expect(scrubbed.tags?.state).toBe("NY");

    // Qualified `*_code` fields are debugging gold, not authorization codes.
    expect(scrubbed.request?.query_string).toContain("status_code=500");
    expect(scrubbed.request?.query_string).toContain("next=%2Fen%2Fcourses");
    expect(scrubbed.request?.query_string).toContain("state=NY");

    // Ordinary request context survives.
    expect(scrubbed.request?.headers?.host).toBe("wanderlust.witus.online");
    expect(scrubbed.request?.headers?.["user-agent"]).toContain("iPhone");
    expect(scrubbed.request?.method).toBe("POST");
    expect(scrubbed.tags?.["app.locale"]).toBe("es");
    expect(scrubbed.tags?.["server.region"]).toBe("iad1");
    expect(scrubbed.contexts?.cloudinary?.cloud_name).toBe("wanderlust");

    // The DB host is what tells you WHICH database refused the connection.
    expect(scrubbed.exception?.values?.[0]?.value).toContain("ep-quiet-fog-123456.us-east-2.aws.neon.tech");
    expect(scrubbed.exception?.values?.[0]?.value).toContain("ECONNREFUSED");

    // The redirect target of a reset link is not itself a credential.
    expect(scrubbed.request?.url).toContain("callbackURL=%2Fen%2Freset-password");
  });

  it("drops credential-bearing request headers and cookies outright", () => {
    const scrubbed = scrubEvent(buildEvent());
    const headers = scrubbed.request?.headers ?? {};

    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    expect(headers["x-api-key"]).toBeUndefined();
    // A Referer is kept but scrubbed, because it is often the only clue to where the user came from.
    expect(headers.referer).toBe(`https://wanderlust.witus.online/en/reset-password?token=${REDACTED}`);
  });

  it("scrubs deeply nested and key-only-recognisable values", () => {
    const scrubbed = scrubEvent(buildEvent());
    const nested = scrubbed.extra?.nested as { deep: { apiKey: string } };

    expect(nested.deep.apiKey).toBe(REDACTED);
    // `client_secret` has a value that matches no shape on earth. Only the key gives it away.
    expect((scrubbed.request?.data as { client_secret: string }).client_secret).toBe(REDACTED);
  });

  it("handles all three query_string shapes the payload allows", () => {
    const asRecord = buildEvent();
    asRecord.request!.query_string = { token: fake.resetToken, next: "/en/courses" };
    const recordOut = scrubEvent(asRecord).request?.query_string as Record<string, string>;
    expect(recordOut.token).toBe(REDACTED);
    expect(recordOut.next).toBe("/en/courses");

    const asPairs = buildEvent();
    asPairs.request!.query_string = [
      ["token", fake.resetToken],
      ["next", "/en/courses"],
    ];
    const pairsOut = scrubEvent(asPairs).request?.query_string as Array<[string, string]>;
    expect(pairsOut[0]).toEqual(["token", REDACTED]);
    expect(pairsOut[1]).toEqual(["next", "/en/courses"]);
    expect(serialise(scrubEvent(asPairs))).not.toContain(fake.resetToken);
  });

  it("survives a self-referential payload without hanging", () => {
    const event = buildEvent();
    const cycle: Record<string, unknown> = { label: "loop" };
    cycle.self = cycle;
    event.extra = { ...event.extra, cycle };

    expect(() => scrubEvent(event)).not.toThrow();
  });

  it("is idempotent", () => {
    const once = serialise(scrubEvent(buildEvent()));
    const twice = serialise(scrubEvent(scrubEvent(buildEvent())));

    expect(twice).toBe(once);
  });
});

describe("scrubQueryString", () => {
  it("scrubs a BARE query string, which is not a parseable URL", () => {
    // `new URL("token=x&next=/y")` throws, so a URL-only pass misses this field completely.
    const out = scrubQueryString(`token=${fake.resetToken}&code=${fake.authCode}&next=%2Fen&state=NY`);

    expect(out).not.toContain(fake.resetToken);
    expect(out).not.toContain(fake.authCode);
    expect(out).toContain("next=%2Fen");
    expect(out).toContain("state=NY");
  });

  it("keeps a leading ? or #", () => {
    expect(scrubQueryString(`?token=${fake.resetToken}`)).toBe(`?token=${REDACTED}`);
    expect(scrubQueryString(`#access_token=${fake.resetToken}`)).toBe(`#access_token=${REDACTED}`);
  });
});

describe("scrubUrl", () => {
  it("masks token-shaped segments on credential paths only", () => {
    expect(scrubUrl(`https://wanderlust.witus.online/api/auth/reset-password/${fake.resetToken}`)).toBe(
      `https://wanderlust.witus.online/api/auth/reset-password/${REDACTED}`,
    );
    // Same shape, different context: a destination id must stay readable.
    expect(scrubUrl(`https://wanderlust.witus.online/en/creator/destinations/${fake.destinationId}/edit`)).toBe(
      `https://wanderlust.witus.online/en/creator/destinations/${fake.destinationId}/edit`,
    );
  });

  it("drops userinfo credentials", () => {
    const out = scrubUrl(`https://admin:${fake.dbPassword}@wanderlust.witus.online/en/admin`);

    expect(out).not.toContain(fake.dbPassword);
    expect(out).toBe("https://wanderlust.witus.online/en/admin");
  });

  it("handles a root-relative path, which new URL() rejects", () => {
    expect(scrubUrl(`/en/reset-password?token=${fake.resetToken}`)).toBe(`/en/reset-password?token=${REDACTED}`);
  });
});

describe("isSecretName", () => {
  it("matches env-var-shaped names, where underscores defeat a word boundary", () => {
    // `\b(secret)\b` never matches any of these, because `_` is a word character.
    for (const name of [
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_SECRET_KEY",
      "CLOUDINARY_API_SECRET",
      "BETTER_AUTH_SECRET",
      "CRON_SECRET",
      "WITUS_OIDC_CLIENT_SECRET",
      "client_secret",
      "clientSecret",
      "X-API-Key",
      "access_token",
      "refreshToken",
      "session_id",
      "authorization",
      "passwordConfirm",
    ]) {
      expect(isSecretName(name), name).toBe(true);
    }
  });

  it("does not match names that merely contain a secret-ish substring", () => {
    for (const name of [
      "design",
      "designSystem",
      "keyboard",
      "keyboardShortcut",
      "state",
      "csrf",
      "nonce",
      "author",
      "authored_at",
      "monkey",
      "status_code",
      "error_code",
      "country_code",
      "locale_code",
      "currencyCode",
      "promo_code",
      "NEXT_PUBLIC_POSTHOG_KEY",
      "STRIPE_PUBLISHABLE_KEY",
      "trace_id",
      "destination_id",
      "email",
    ]) {
      expect(isSecretName(name), name).toBe(false);
    }
  });

  it("treats an unqualified code as an authorization code", () => {
    expect(isSecretName("code")).toBe(true);
    expect(isSecretName("otp_code")).toBe(true);
  });

  it("knows this app's own one-letter capability param", () => {
    // /tours/<slug>?k=<token> is the private preview link. No generic word list catches `k`.
    expect(isSecretName("k")).toBe(true);
    // ...and it is an EXACT name, so ordinary words containing k are untouched.
    expect(isSecretName("kind")).toBe(false);
    expect(isSecretName("kilometers")).toBe(false);
  });
});

describe("browser safety", () => {
  it("contains no regex lookbehind", () => {
    // This module is imported by instrumentation-client.ts, so it PARSES in the browser whether or
    // not a DSN is set. `(?<=` / `(?<!` is a SyntaxError on iOS Safari below 16.4, which would break
    // the chunk -- an observability feature causing an outage. Boundaries use capture groups instead.
    const source = readFileSync(fileURLToPath(new URL("./sentry-scrub.ts", import.meta.url)), "utf8");
    const lookbehinds = source.match(/\(\?<[=!]/g);

    expect(lookbehinds).toBeNull();
  });
});

describe("scrubText", () => {
  it("redacts a labelled secret whose name spans underscores", () => {
    const out = scrubText(`env check failed: STRIPE_WEBHOOK_SECRET=${fake.stripeWebhookSecret}`);

    expect(out).not.toContain(fake.stripeWebhookSecret);
    expect(out).toContain("STRIPE_WEBHOOK_SECRET=");
  });

  it("redacts a bearer token that carries no name=value separator", () => {
    const out = scrubText(`retry sent Bearer ${fake.jwt} upstream`);

    expect(out).not.toContain(fake.jwt);
    expect(out).toContain("Bearer");
  });

  it("masks a token in a ROOT-RELATIVE path, which no name=value rule can see", () => {
    // A server log line has no absolute URL and no `name=value`, so this needs its own pass.
    const out = scrubText(`POST /api/auth/reset-password/${fake.resetToken} 500 in 812ms`);

    expect(out).not.toContain(fake.resetToken);
    expect(out).toContain("/api/auth/reset-password/");
    expect(out).toContain("500 in 812ms");
  });

  it("leaves a resource path with the same shape alone", () => {
    const line = `render failed at /en/creator/destinations/${fake.destinationId}/scenes`;

    expect(scrubText(line)).toBe(line);
  });

  it("leaves ordinary prose alone", () => {
    const prose = "Scene 4 failed to load: the panorama is 14200x7100, above the 8192px WebGL limit.";

    expect(scrubText(prose)).toBe(prose);
  });
});

describe("inert without a DSN", () => {
  // Generous timeout: importing the real SDK is a multi-second cold start, and the point of this
  // test is to exercise the actual guard rather than a mock of it.
  it(
    "never initialises the SDK when SENTRY_DSN is unset",
    async () => {
      delete process.env.SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      await import("../../sentry.server.config");
      const Sentry = await import("@sentry/nextjs");

      // No client means no transport, no integrations, and no network call: the app behaves exactly
      // as it does today until BAM sets the DSN.
      expect(Sentry.getClient()).toBeUndefined();
    },
    60_000,
  );
});
