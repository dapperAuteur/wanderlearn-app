import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Wanderlust"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "es"]).default("en"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  // "Sign in with WitUS" — ecosystem OIDC client against the accounts.witus.online
  // IdP. Optional: the SSO provider + button stay off until CLIENT_ID is set, so a
  // missing value never breaks the build or the existing sign-in methods. The
  // redirect URI the IdP expects: {BETTER_AUTH_URL}/api/auth/oauth2/callback/witus.
  WITUS_OIDC_CLIENT_ID: z.string().optional(),
  WITUS_OIDC_CLIENT_SECRET: z.string().optional(),
  WITUS_OIDC_DISCOVERY_URL: z.string().url().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_REGION: z.enum(["us", "eu"]).default("us"),
  EMAIL_FROM: z.string().optional(),
  ADMIN_NOTIFY_EMAIL: z.string().email().optional(),
  // PostHog product analytics. Both are publishable and ship in the browser bundle;
  // the phc_ project token is not a secret. Capture stays entirely off until the token
  // is set, so local dev and keyless previews are a supported state rather than an
  // error -- same posture as the WitUS SSO block above.
  //
  // HOST DEFAULT IS LOAD-BEARING. Posting to the wrong region does not error: PostHog
  // accepts the request and the events land nowhere visible, so the failure looks
  // exactly like "analytics isn't working" with nothing to debug. The WitUS project is
  // US-hosted (confirmed 2026-07-28), so the default matches it. Set the var explicitly
  // anyway -- a future ecosystem app in another region must not inherit this silently.
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Shared secret used to authenticate the single Vercel cron handler
  // at /api/cron/daily. Vercel passes it as
  // `Authorization: Bearer <CRON_SECRET>`; we accept the same value via
  // `?secret=` for local testing.
  CRON_SECRET: z.string().min(16).optional(),
  // Error monitoring. The destination is Better Stack, which ingests over the Sentry protocol, so
  // the client is @sentry/nextjs and the DSN is a Better Stack source DSN.
  //
  // ALL OPTIONAL, AND THAT IS THE DESIGN. The SDK is initialised only when a DSN is present
  // (sentry.server.config.ts / sentry.edge.config.ts / src/instrumentation-client.ts), so no DSN
  // means no collection and no network call -- local dev, CI, and keyless previews stay exactly as
  // they are. SENTRY_DSN covers server + edge; NEXT_PUBLIC_SENTRY_DSN is a SEPARATE var because the
  // browser one is inlined into the bundle and is therefore public by construction.
  //
  // SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN are read by the build plugin in next.config.ts,
  // not by this module: without the token it skips source-map upload and you get minified stack
  // traces, which is a degraded report rather than a broken build.
  //
  // NOT `.url()`, deliberately. This module THROWS on a validation failure, so a typo'd DSN would
  // take the whole app down instead of merely switching monitoring off. Error monitoring must never
  // be able to break the thing it is monitoring: a malformed DSN makes the Sentry SDK warn and stay
  // inert, which is the correct failure mode. Loose typing here buys that.
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
});

const isProd = process.env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const allowDevDefaults = !isProd || isBuildPhase;

const devPlaceholders = {
  DATABASE_URL: "postgres://placeholder:placeholder@localhost/wanderlust_dev",
  BETTER_AUTH_SECRET: "dev-secret-minimum-32-characters-xxxxxxxxxxxx",
  BETTER_AUTH_URL: "http://localhost:3000",
} as const;

const input = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  DATABASE_URL: process.env.DATABASE_URL ?? (allowDevDefaults ? devPlaceholders.DATABASE_URL : undefined),
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? (allowDevDefaults ? devPlaceholders.BETTER_AUTH_SECRET : undefined),
  BETTER_AUTH_URL:
    process.env.BETTER_AUTH_URL ?? (allowDevDefaults ? devPlaceholders.BETTER_AUTH_URL : undefined),
  WITUS_OIDC_CLIENT_ID: process.env.WITUS_OIDC_CLIENT_ID,
  WITUS_OIDC_CLIENT_SECRET: process.env.WITUS_OIDC_CLIENT_SECRET,
  WITUS_OIDC_DISCOVERY_URL: process.env.WITUS_OIDC_DISCOVERY_URL,
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
  MAILGUN_REGION: process.env.MAILGUN_REGION,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  SENTRY_DSN: process.env.SENTRY_DSN,
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
};

const parsed = schema.safeParse(input);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
  );
}

export const env = parsed.data;

export const hasCloudinary = Boolean(
  env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

export const hasStripe = Boolean(env.STRIPE_SECRET_KEY);

/** True once the WitUS SSO client is provisioned — gates the provider + the button. */
export const hasWitusSso = Boolean(env.WITUS_OIDC_CLIENT_ID);
export const hasPostHog = Boolean(env.NEXT_PUBLIC_POSTHOG_KEY);

/**
 * True once a Better Stack source DSN is provisioned. The Sentry configs read `process.env` directly
 * rather than this flag -- they load during server boot, outside the app's module graph -- so this
 * exists for app code and admin surfaces that want to say whether reporting is live.
 */
export const hasErrorMonitoring = Boolean(env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN);
