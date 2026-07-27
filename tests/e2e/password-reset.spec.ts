import { test, expect } from "@playwright/test";

// Public auth surfaces: no seed data, no auth state, and none of these assertions
// send a real reset email or write to the database, so this file does not self-skip.
//
// Covers the flow added 2026-07-26 after the "Authentication" support thread found
// there was no password reset at all. See plans/future/04 §A.

test("sign-in links to the password reset flow", async ({ page }) => {
  await page.goto("/en/sign-in", { waitUntil: "load" });

  const forgot = page.getByRole("link", { name: "Forgot your password?" });
  await expect(forgot).toBeVisible();
  await forgot.click();

  await expect(page).toHaveURL(/\/en\/forgot-password$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reset your password");
});

test("forgot-password with an empty email names the missing email", async ({ page }) => {
  await page.goto("/en/forgot-password", { waitUntil: "load" });

  await page.getByRole("button", { name: "Send the reset link" }).click();

  // Scoped to the form: Next's route announcer is also role="alert".
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toHaveText(/enter your email address first/i);
  await expect(page.locator("#email")).toBeFocused();
});

test("reset-password without a token refuses instead of showing a dead form", async ({
  page,
}) => {
  await page.goto("/en/reset-password", { waitUntil: "load" });

  // Scoped to <main>: Next's route announcer is also role="alert" at the document
  // level, and this alert sits outside any form so it cannot be form-scoped.
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    /invalid, already used, or expired/i,
  );
  // No password inputs — a form here could never succeed.
  await expect(page.locator("input[type=password]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Request a new reset link" })).toBeVisible();
});

test("reset-password with an INVALID_TOKEN redirect refuses too", async ({ page }) => {
  // Better Auth bounces here with ?error=INVALID_TOKEN when the emailed token
  // fails validation on its own route.
  await page.goto("/en/reset-password?error=INVALID_TOKEN", { waitUntil: "load" });

  // Scoped to <main>: Next's route announcer is also role="alert" at the document
  // level, and this alert sits outside any form so it cannot be form-scoped.
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    /invalid, already used, or expired/i,
  );
  await expect(page.locator("input[type=password]")).toHaveCount(0);
});

test("reset-password with a token shows the new-password form", async ({ page }) => {
  // The token is only validated when submitted, so an arbitrary value is enough
  // to prove the form renders and gates on its own client-side rules.
  await page.goto("/en/reset-password?token=not-a-real-token", { waitUntil: "load" });

  await expect(page.locator("#password")).toBeVisible();
  await expect(page.locator("#confirm")).toBeVisible();

  // Too short: must be caught client-side, because the form is noValidate so the
  // input's own minLength never fires.
  await page.locator("#password").fill("short");
  await page.locator("#confirm").fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(/at least 10 characters/i);

  // Long enough but mismatched.
  await page.locator("#password").fill("averylongpassword1");
  await page.locator("#confirm").fill("averylongpassword2");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(/do not match/i);
});
