import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db/client";
import { env, hasGoogleOAuth } from "./env";

const socialProviders = hasGoogleOAuth
  ? {
      google: {
        clientId: env.GOOGLE_CLIENT_ID as string,
        clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      },
    }
  : undefined;

export const auth = betterAuth({
  appName: "Wanderlearn",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 10,
  },
  ...(socialProviders ? { socialProviders } : {}),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "learner",
        input: false,
      },
      birthYear: {
        type: "number",
        required: false,
        input: true,
      },
      locale: {
        type: "string",
        defaultValue: "en",
        input: true,
      },
      stripeCustomerId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
