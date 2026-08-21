import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility coverage for the 360° tour viewer.
 *
 * WHY THIS FILE EXISTS. Until 2026-08 the tour pages had **no** automated a11y
 * coverage — the whole suite audited only routes that render without content,
 * because those are trivial to automate. Tours need real destinations, so the
 * most distinctive surface in the product was never scanned.
 *
 * That is not a theoretical gap. It is how a CRITICAL defect survived for the
 * entire life of the feature: the scene-link arrows, which are the primary way
 * anyone walks a tour, were buttons with no accessible name and announced as
 * "button" with no indication of where they led. It was found by hand, on an
 * unrelated errand, not by this suite.
 *
 * WHY IT DISCOVERS A TOUR RATHER THAN NAMING ONE. The obvious approach is a
 * seeded fixture, and that is what kept this unwritten — the seed script only
 * creates a single-scene course, and building a believable multi-scene tour
 * fixture (panoramas, links, arrival headings) is a real piece of work that
 * nobody had time for. So the coverage stayed at zero while waiting for
 * perfect.
 *
 * Instead this reads the public catalogue and audits whatever it finds. That
 * works against any database with content, needs no fixture, and has the
 * useful property of testing *real* creator data — which is where the weird
 * cases live. The Patina Gallery tour that exposed the "Stop 9 of 9" bug
 * begins at a scene photographed ninth; no fixture anyone invented would have
 * looked like that.
 *
 * It skips cleanly when the catalogue is empty, so a fresh database reports a
 * skip rather than a failure.
 */

test.skip(
  !process.env.PLAYWRIGHT_SEEDED,
  "Tour a11y tests need a database with at least one published tour. Run with PLAYWRIGHT_SEEDED=1.",
);

/** First published tour slug in the catalogue, or null when there are none. */
async function findATourSlug(page: Page): Promise<string | null> {
  await page.goto("/en/tours", { waitUntil: "load" });
  const href = await page
    .locator('a[href^="/en/tours/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (!href) return null;
  const slug = href.split("/en/tours/")[1]?.split(/[?#]/)[0];
  return slug && slug.length > 0 ? slug : null;
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test("the tours catalogue has no serious WCAG 2.1 AA violations", async ({ page }) => {
  await page.goto("/en/tours", { waitUntil: "load" });
  // The globe draws to a WebGL canvas after the network settles, so auditing
  // on load alone would scan a page that is not finished assembling itself.
  await page.waitForTimeout(2_000);
  const serious = await seriousViolations(page);
  expect(
    serious,
    `Serious/critical axe violations on /en/tours:\n${JSON.stringify(serious, null, 2)}`,
  ).toEqual([]);
});

test("the tour viewer has no serious WCAG 2.1 AA violations", async ({ page }) => {
  const slug = await findATourSlug(page);
  test.skip(!slug, "No published tours in this database.");

  // `?start=1` bypasses the pre-tour scene chooser and mounts the viewer
  // itself, which is the surface that was never audited.
  await page.goto(`/en/tours/${slug}?start=1`, { waitUntil: "load" });

  // Photo Sphere Viewer mounts, loads a panorama, and only then renders its
  // link arrows. Auditing before that scans a page with no arrows on it —
  // which would have passed happily while the arrows were unlabelled.
  await page
    .locator(".psv-container")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(5_000);

  const serious = await seriousViolations(page);
  expect(
    serious,
    `Serious/critical axe violations on /en/tours/${slug}?start=1:\n${JSON.stringify(serious, null, 2)}`,
  ).toEqual([]);
});

test("every scene-link arrow has an accessible name", async ({ page }) => {
  const slug = await findATourSlug(page);
  test.skip(!slug, "No published tours in this database.");

  await page.goto(`/en/tours/${slug}?start=1`, { waitUntil: "load" });
  await page
    .locator(".psv-container")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(5_000);

  const arrows = await page.locator(".psv-virtual-tour-arrow").all();
  // A single-scene tour has no arrows, which is a legitimate state rather than
  // a failure — there is simply nothing to label.
  test.skip(arrows.length === 0, `Tour "${slug}" has no scene links.`);

  for (const arrow of arrows) {
    const label = (await arrow.getAttribute("aria-label"))?.trim() ?? "";
    const text = (await arrow.innerText().catch(() => ""))?.trim() ?? "";
    expect(
      label.length > 0 || text.length > 0,
      "A scene-link arrow has no accessible name. It will announce as just \"button\", " +
        "leaving a screen-reader user no way to know where it leads. " +
        "See src/components/virtual-tour/virtual-tour-viewer.tsx (arrowStyle.element).",
    ).toBe(true);
  }
});

test("a scene-link arrow can be operated from the keyboard", async ({ page }) => {
  const slug = await findATourSlug(page);
  test.skip(!slug, "No published tours in this database.");

  await page.goto(`/en/tours/${slug}?start=1`, { waitUntil: "load" });
  await page
    .locator(".psv-container")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(5_000);

  const arrow = page.locator(".psv-virtual-tour-arrow").first();
  const count = await page.locator(".psv-virtual-tour-arrow").count();
  test.skip(count === 0, `Tour "${slug}" has no scene links.`);

  // The caption is PSV's own display of the current scene name — an
  // independent witness that navigation actually happened, rather than
  // trusting our own UI to report on itself.
  const caption = () =>
    page.evaluate(() => document.querySelector(".psv-caption-content")?.textContent?.trim() ?? "");
  const before = await caption();

  await arrow.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(6_000);
  const after = await caption();

  expect(
    after,
    "Pressing Enter on a focused scene-link arrow did not change scene. " +
      "A labelled control that cannot be activated is still unusable — PSV navigates from a " +
      "viewer-level ClickEvent, not from the button, so the button needs its own handler.",
  ).not.toBe(before);
});
