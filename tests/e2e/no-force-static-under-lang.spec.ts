import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";

// Source-level guard, not a browser test. It needs no server, no seed, and no
// auth state — it reads the app source directly.
//
// Every page under src/app/[lang] renders the shared AppHeader, which calls
// getSession(). `export const dynamic = "force-static"` makes headers() empty at
// build time, so the signed-out header — "Sign in" button, no account link — gets
// baked into the prerendered HTML and served to signed-in users. That shipped on
// /help, /docs, /privacy, /terms, and /accessibility and was reported in the
// 2026-07-26 support thread; see plans/bugs/19.
//
// Re-verify by hand with: pnpm build | grep '/\[lang\]/help'
// Correct output is `ƒ` (dynamic). A `●` means this regressed.

test("no page under [lang] opts into force-static while the layout renders session state", () => {
  const langDir = join(process.cwd(), "src", "app", "[lang]");
  const pages = globSync("**/page.tsx", { cwd: langDir });
  expect(pages.length).toBeGreaterThan(10);

  const offenders = pages.filter((rel) =>
    /export\s+const\s+dynamic\s*=\s*["']force-static["']/.test(
      readFileSync(join(langDir, rel), "utf8"),
    ),
  );

  expect(
    offenders,
    `These pages export dynamic = "force-static" but render AppHeader, so they will ` +
      `serve a signed-out header to signed-in users:\n  ${offenders.join("\n  ")}`,
  ).toEqual([]);
});
