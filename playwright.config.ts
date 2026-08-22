import { defineConfig, devices } from "@playwright/test";

// Dedicated port so the Playwright-spawned Next.js server can't collide
// with another project's dev server (you often have several running).
const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

/**
 * The theme states the a11y gate checks, beyond the default project.
 *
 * `os` is what the browser reports for `prefers-color-scheme`; `choice` is
 * what the viewer picked in the theme toggle (null = left on System). The
 * interesting cases are the two where they disagree — those are the ones
 * that regress, because they are the ones a developer on a matching OS
 * never sees by accident.
 */
const THEME_STATES = [
  { name: "dark-os-system", os: "dark", choice: null },
  { name: "dark-os-light-choice", os: "dark", choice: "light" },
  { name: "light-os-dark-choice", os: "light", choice: "dark" },
] as const;

export default defineConfig({
  // Picks up both tests/a11y/**/*.spec.ts and tests/e2e/**/*.spec.ts.
  // E2E specs self-skip when their prerequisites (seeded DB + saved
  // auth state) aren't in place, so they don't break CI runs that only
  // want the a11y gate.
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // Full enroll-to-cert flow clicks through every lesson, so 30s isn't
  // always enough. Bumped modestly; a11y specs finish in seconds.
  timeout: 60_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    // A trace alone means opening the trace viewer to see what a failure
    // looked like. The screenshot answers that at a glance, and the video
    // answers "what did it do before it broke" — which is the expensive
    // question for the enroll-to-certificate flow. Both are failure-only,
    // so a green run writes nothing. Artifacts land in the gitignored
    // test-results/; deliberate marketing captures go to ui-archive/
    // via `pnpm capture:ui` instead.
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // The a11y gate re-run in the three theme states the default project
    // does NOT cover. Desktop Chrome reports a light OS and stamps no
    // explicit choice, so before these existed the gate only ever saw one
    // of four possible states — and it happened to be a clean one.
    //
    // That is not a theoretical gap. `dark:` utilities and the colour
    // tokens were wired to two different switches, and the two states
    // where the OS and the explicit choice DISAGREE had 333 and 352
    // contrast failures respectively. The gate was green throughout.
    //
    // Scoped to tests/a11y so the slower e2e flows still run once.
    ...THEME_STATES.map((state) => ({
      name: `a11y-${state.name}`,
      testMatch: /tests\/a11y\/.*\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: state.os,
        // The theme toggle persists to localStorage under `wl.theme`, and
        // the anti-flash script in layout.tsx reads it before first paint.
        // storageState seeds it declaratively, which is why this needs no
        // per-spec setup.
        ...(state.choice
          ? {
              storageState: {
                cookies: [],
                origins: [
                  {
                    origin: baseURL,
                    localStorage: [{ name: "wl.theme", value: state.choice }],
                  },
                ],
              },
            }
          : {}),
      },
    })),
  ],
  webServer: process.env.PLAYWRIGHT_NO_WEB_SERVER
    ? undefined
    : {
        // `--webpack` is required: Next 16 defaults `next dev` to Turbopack,
        // but the Serwist plugin injects a webpack config, so a bare
        // `next dev` aborts ("using Turbopack, with a webpack config and no
        // turbopack config"). The package.json dev/build scripts already
        // pass --webpack; the Playwright-spawned server must match.
        command: `pnpm exec next dev --webpack --port ${port}`,
        url: baseURL,
        // Only reuse if a Wanderlust server already happens to be on this
        // port. We picked 3100 specifically so nothing else usually is.
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
