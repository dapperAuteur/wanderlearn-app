import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Wanderlearn"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "es"]).default("en"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ADMIN_NOTIFY_EMAIL: z.string().email().optional(),
});

const isProd = process.env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const allowDevDefaults = !isProd || isBuildPhase;

const devPlaceholders = {
  DATABASE_URL: "postgres://placeholder:placeholder@localhost/wanderlearn_dev",
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
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL,
};

const parsed = schema.safeParse(input);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
  );
}

export const env = parsed.data;

export const hasGoogleOAuth = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
