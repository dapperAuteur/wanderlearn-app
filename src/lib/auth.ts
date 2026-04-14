import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { emailOTP } from "better-auth/plugins/email-otp";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "@better-auth/passkey";
import { db, schema } from "@/db/client";
import { env } from "./env";
import { sendEmail } from "./mailer";

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
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Your Wanderlearn sign-in link",
          text: `Click to sign in to Wanderlearn: ${url}\n\nThis link expires in 10 minutes. If you did not request it, ignore this email.`,
        });
      },
    }),
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        const subject =
          type === "sign-in"
            ? "Your Wanderlearn sign-in code"
            : type === "email-verification"
              ? "Verify your Wanderlearn email"
              : "Your Wanderlearn password reset code";
        await sendEmail({
          to: email,
          subject,
          text: `Your Wanderlearn code is: ${otp}\n\nIt expires in 10 minutes. If you did not request it, ignore this email.`,
        });
      },
    }),
    twoFactor(),
    passkey({
      rpID: new URL(env.BETTER_AUTH_URL).hostname,
      rpName: "Wanderlearn",
      origin: env.BETTER_AUTH_URL,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
