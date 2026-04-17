import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Tier-2 pages. Require `pnpm db:seed` so the MUCHO course is present.
// Run: PLAYWRIGHT_SEEDED=1 pnpm a11y:seeded
// Skipped by default so CI doesn't fail on a fresh DB.
test.skip(
  !process.env.PLAYWRIGHT_SEEDED,
  "Tier-2 a11y tests require PLAYWRIGHT_SEEDED=1 and a seeded MUCHO course.",
);

const tier2Paths = [
  "/en/courses",
  "/es/courses",
  "/en/courses/mucho-museo-del-chocolate",
  "/es/courses/mucho-museo-del-chocolate",
];

for (const path of tier2Paths) {
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
