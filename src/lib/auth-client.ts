"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  magicLinkClient,
  emailOTPClient,
  twoFactorClient,
  genericOAuthClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    magicLinkClient(),
    emailOTPClient(),
    twoFactorClient(),
    passkeyClient(),
    genericOAuthClient(),
  ],
});

// Note: `requestPasswordReset`, not `forgetPassword`. In better-auth 1.6 the
// endpoint is /request-password-reset; `authClient.forgetPassword` exists only as a
// namespace object contributed by the emailOTP plugin (`forgetPassword.emailOtp`),
// so destructuring it yields something that is not callable.
export const { signIn, signUp, signOut, useSession, requestPasswordReset, resetPassword } =
  authClient;
