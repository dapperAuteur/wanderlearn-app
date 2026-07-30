import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit-test runner for PURE modules. Playwright still owns anything that needs a browser
// (tests/a11y, tests/e2e); this exists for the logic that has no business booting one -- the Sentry
// scrubber, and the description sanitizer next (see plans/future/06).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      // Mirrors the tsconfig `@/*` -> `./src/*` path mapping.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is provided by the Next compiler and does not resolve outside a Next build,
      // which is what blocked the first two attempts at unit-testing an app module. Stubbing it here
      // means app modules import cleanly under Vitest.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
