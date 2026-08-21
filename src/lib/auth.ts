import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { emailOTP } from "better-auth/plugins/email-otp";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "@better-auth/passkey";
import { genericOAuth } from "better-auth/plugins";
import { db, schema } from "@/db/client";
import { env } from "./env";
import { sendEmail } from "./mailer";

export const auth = betterAuth({
  appName: "Wanderlust",
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
    // Until this landed there was no password reset at all: a user who forgot
    // their password could only get back in via the magic link. Better Auth
    // builds `url` as {baseURL}/reset-password/{token}?callbackURL={redirectTo},
    // and the GET on that route validates the token and then bounces to
    // redirectTo with ?token=... (or ?error=INVALID_TOKEN). The client passes
    // /{lang}/reset-password as redirectTo, which is the page that collects the
    // new password.
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Wanderlust password",
        text: `Click to choose a new Wanderlust password: ${url}\n\nThis link expires in 1 hour and can only be used once. If you did not request a password reset, ignore this email and your password will stay unchanged.`,
      });
    },
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
          subject: "Your Wanderlust sign-in link",
          text: `Click to sign in to Wanderlust: ${url}\n\nThis link expires in 10 minutes. If you did not request it, ignore this email.`,
        });
      },
    }),
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        const subject =
          type === "sign-in"
            ? "Your Wanderlust sign-in code"
            : type === "email-verification"
              ? "Verify your Wanderlust email"
              : "Your Wanderlust password reset code";
        await sendEmail({
          to: email,
          subject,
          text: `Your Wanderlust code is: ${otp}\n\nIt expires in 10 minutes. If you did not request it, ignore this email.`,
        });
      },
    }),
    twoFactor(),
    passkey({
      rpID: new URL(env.BETTER_AUTH_URL).hostname,
      rpName: "Wanderlust",
      origin: env.BETTER_AUTH_URL,
    }),
    // "Sign in with WitUS" — the ecosystem IdP (accounts.witus.online) as an OIDC
    // provider. Added only once WITUS_OIDC_CLIENT_ID is set, so a missing env never
    // breaks the build or the existing sign-in methods. Callback path served by the
    // Better-Auth catch-all: {BETTER_AUTH_URL}/api/auth/oauth2/callback/witus.
    ...(env.WITUS_OIDC_CLIENT_ID
      ? [
          genericOAuth({
            config: [
              {
                providerId: "witus",
                discoveryUrl:
                  env.WITUS_OIDC_DISCOVERY_URL ??
                  "https://accounts.witus.online/api/idp/.well-known/openid-configuration",
                clientId: env.WITUS_OIDC_CLIENT_ID,
                clientSecret: env.WITUS_OIDC_CLIENT_SECRET ?? "",
                scopes: ["openid", "email", "profile"],
                pkce: true,
              },
            ],
          }),
        ]
      : []),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
