import { test, expect } from "@playwright/test";

// No seed data and no auth state needed: /sign-in is public and these assertions
// never reach the database, so unlike enroll-to-certificate.spec.ts this file
// does not self-skip.
//
// Regression guard for the 2026-07-26 support thread "Authentication": clicking
// the sign-in-link button with an empty email reported "We couldn't sign you in.
// Check your email and password." — the *password* error, naming a credential
// the user had not typed. See plans/bugs/18.

test("sign-in link button with an empty email names the missing email, not a password", async ({
  page,
}) => {
  await page.goto("/en/sign-in", { waitUntil: "load" });

  await page.getByRole("button", { name: "Email me a sign-in link" }).click();

  // Scoped to the form: Next's route announcer is also role="alert" at the
  // document level, which makes an unscoped getByRole("alert") ambiguous.
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toHaveText(/enter your email address first/i);
  await expect(alert).not.toHaveText(/password/i);

  // The cursor should land in the field that is actually missing.
  await expect(page.locator("#email")).toBeFocused();
});

test("sign-in page offers no passkey button", async ({ page }) => {
  await page.goto("/en/sign-in", { waitUntil: "load" });

  // The app has no passkey enrollment UI, so a sign-in button could only fail.
  await expect(page.getByRole("button", { name: /passkey/i })).toHaveCount(0);
});
