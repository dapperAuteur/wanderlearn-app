import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Tier-1 public pages. No seed data required.
// The list is mirrored in docs/a11y-critical-pages.md §Tier 1.
const tier1Paths = [
  "/en",
  "/es",
  "/en/how-it-works",
  "/es/how-it-works",
  "/en/sign-in",
  "/es/sign-in",
  "/en/sign-up",
  "/es/sign-up",
];

for (const path of tier1Paths) {
  test(`${path} has no serious WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious,
      `Serious/critical axe violations on ${path}:\n${JSON.stringify(serious, null, 2)}`,
    ).toEqual([]);
  });
}
