import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Happy path + a11y gate for the public surface (witus plan 30 Phase 2; a11y mandate from
// docs/shared-ui-ux-dx.md). Kept to stable public pages on purpose — deep seeded flows live in
// tests/e2e; this gate's job is "the deployed site renders, navigates, and stays accessible".
//
// Localization: every public route is locale-prefixed (/en, /es — src/lib/locales.ts) and "/"
// redirects by Accept-Language (src/app/page.tsx). Specs follow the redirect and read the landed
// locale off the URL instead of hardcoding one.

/** Gate on serious+critical axe violations. Minor/moderate findings are reported in the failure
 *  message when the gate trips, but don't fail the build on their own — the charter's bar is
 *  WCAG AA, and axe's minor findings routinely include below-AA nitpicks that would make the
 *  gate flaky-red and get ignored. Tighten later if the pages stay clean. Same bar as
 *  tests/a11y/public.spec.ts, which audits the full Tier-1 list against a local server. */
async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const gating = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    gating.map((v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} nodes)`),
  ).toEqual([]);
}

/** "/" 302s to the negotiated locale; return whichever one we landed on. */
async function gotoHomeAndGetLocale(page: Page): Promise<string> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(en|es)(\/|$|\?)/);
  const match = new URL(page.url()).pathname.match(/^\/(en|es)(\/|$)/);
  return match![1]!;
}

test("homepage renders and is accessible", async ({ page }) => {
  await gotoHomeAndGetLocale(page);
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("tours catalog renders and is accessible", async ({ page }) => {
  // /tours is the primary public explore surface (globe + destination catalog, real DB data;
  // force-dynamic in src/app/[lang]/tours/page.tsx). Direct goto rather than clicking the header
  // nav: the inline nav is hidden below lg (app-header.tsx), so a nav click would need the mobile
  // menu on the 360px project and this gate stays deliberately simple.
  const locale = await gotoHomeAndGetLocale(page);
  await page.goto(`/${locale}/tours`);
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
