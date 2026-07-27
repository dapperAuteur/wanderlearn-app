import { test, expect } from "@playwright/test";

// Mobile-first launch gate: "No horizontal scroll at any width >= 320 px"
// (STYLE_GUIDE). This regressed once already — the header rendered its inline
// nav from `sm:` (640px) up in a single non-wrapping row, so a signed-in admin
// with nine nav links overflowed the viewport between 640px and 1024px. The
// band around the desktop/mobile switch is the part that breaks, so sample
// either side of it.
const widths = [320, 375, 414, 640, 768, 1023, 1024, 1280];

// Signed-out rendering only: the FAB and the creator/admin nav links need a
// session. The signed-in variants carry more nav items and are covered by the
// manual pre-merge sweep noted in plans/07.
const paths = ["/en", "/en/help", "/en/help/upload-media", "/es/help"];

for (const path of paths) {
  for (const width of widths) {
    test(`${path} has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path, { waitUntil: "load" });

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        scrollWidth,
        `${path} at ${width}px scrolls horizontally: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`,
      ).toBeLessThanOrEqual(clientWidth);
    });
  }
}
