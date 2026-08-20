import { defineConfig, devices } from "@playwright/test";

// Deployment E2E + a11y gate (witus plan 30 Phase 2), ported from witus feat/30-playwright-ci.
//
// This is a SEPARATE config from playwright.config.ts on purpose: that one owns the local
// suites (tests/a11y, tests/e2e) and spawns a dev server on :3100. This one owns e2e/ and
// never spawns a server — it always points at an already-running app:
//   PLAYWRIGHT_BASE_URL=https://<deploy-url> pnpm exec playwright test --config playwright.deploy.config.ts   ← CI (Vercel preview/prod)
//   pnpm exec playwright test --config playwright.deploy.config.ts                                            ← local, expects dev server on :3000
// No webServer block on purpose: the dev server needs real env (DATABASE_URL, BETTER_AUTH_*,
// Cloudinary, Mailgun) that CI doesn't have. CI always runs against a deployed URL instead.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Vercel Deployment Protection: if the target deployment is protected, set
// VERCEL_AUTOMATION_BYPASS_SECRET (Vercel → Project → Deployment Protection → Protection Bypass
// for Automation) as a GitHub Actions secret. Read from the project's own dashboard — value is
// per-project. Unset = no header sent, which is correct for public deployments.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Failure-only, same reasoning as playwright.config.ts. It matters more
    // here: this suite runs against a deployed URL, so a failure often cannot
    // be reproduced locally and the artifact is the only evidence. CI already
    // uploads playwright-report/ on failure (.github/workflows/e2e.yml).
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      // Tags every request this suite makes as synthetic, ecosystem-wide convention. The OTel
      // layer maps it to the `witus.origin_test` span attribute (src/otel.config.ts), so Honeycomb
      // queries can include/exclude test traffic; analytics and logs can filter on it too.
      "x-witus-origin-test": "playwright-synthetic",
      ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
    },
  },
  projects: [
    {
      name: "desktop",
      // Playwright's bundled chromium does not support macOS 13, so local runs drive the installed
      // Google Chrome; CI (ubuntu) uses the bundled browser.
      use: { ...devices["Desktop Chrome"], ...(process.env.CI ? {} : { channel: "chrome" }) },
    },
    {
      // Mobile-first launch gate: STYLE_GUIDE mandates no horizontal scroll at any width >= 320px,
      // and tests/a11y/no-horizontal-scroll.spec.ts samples the full band locally. Here one small
      // viewport is enough — a flow that only works on desktop is a failing flow. Same specs.
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 360, height: 740 },
        ...(process.env.CI ? {} : { channel: "chrome" }),
      },
    },
  ],
});
