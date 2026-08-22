import { existsSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The passport is behind a sign-in, which puts it out of reach of the a11y
 * suite — that suite audits signed-out pages, and this one redirects.
 *
 * So the guard is split. The signed-out behaviour is checked unconditionally,
 * because a redirect that breaks (a 500, or a redirect that loses where you
 * were going) is the failure most likely to ship unnoticed. The signed-in
 * rendering self-skips without a saved auth state, following the pattern in
 * enroll-to-certificate.spec.ts — see that file for the one-time setup.
 */
const authStatePath = path.join(process.cwd(), "tests/e2e/.auth/user.json");
const hasAuth = existsSync(authStatePath);

test.describe("passport — signed out", () => {
  test("redirects to sign-in and remembers where you were going", async ({ page }) => {
    await page.goto("/en/account/passport");
    await expect(page).toHaveURL(/\/en\/sign-in/);
    // Without `from`, signing in drops you on the account page and you have to
    // find your way back — the sort of small breakage nobody reports.
    expect(new URL(page.url()).searchParams.get("from")).toBe("/en/account/passport");
  });

  test("does not 500 on a locale that does not exist", async ({ page }) => {
    const res = await page.goto("/xx/account/passport");
    expect(res?.status()).toBe(404);
  });
});

test.describe("passport — signed in", () => {
  test.skip(!hasAuth, "Requires tests/e2e/.auth/user.json — see enroll-to-certificate.spec.ts.");
  test.use({ storageState: authStatePath });

  test("renders and has no serious accessibility violations", async ({ page }) => {
    await page.goto("/en/account/passport");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious,
      `Serious/critical axe violations on the passport:\n${JSON.stringify(serious, null, 2)}`,
    ).toEqual([]);
  });

  test("never shows a total that sums places and stamps", async ({ page }) => {
    await page.goto("/en/account/passport");
    const body = (await page.locator("main").textContent()) ?? "";
    // The counts are separate facts about the same rows. A combined total
    // would look authoritative and mean nothing — the inflation trap the
    // passport design exists to avoid.
    expect(body).not.toMatch(/\b\d+\s+(stamps?\s+)?total\b/i);
  });

  test("is reachable from the account page", async ({ page }) => {
    await page.goto("/en/account");
    const link = page.getByRole("link", { name: /passport/i }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/en\/account\/passport/);
  });
});
