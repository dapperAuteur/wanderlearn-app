import { defineConfig, devices } from "@playwright/test";

// Dedicated port so the Playwright-spawned Next.js server can't collide
// with another project's dev server (you often have several running).
const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/a11y",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_NO_WEB_SERVER
    ? undefined
    : {
        command: `pnpm exec next dev --port ${port}`,
        url: baseURL,
        // Only reuse if a Wanderlearn server already happens to be on this
        // port. We picked 3100 specifically so nothing else usually is.
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
