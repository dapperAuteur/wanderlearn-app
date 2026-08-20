/**
 * Capture a still-image record of the UI, for before/after comparison.
 *
 * Written for the Wanderlearn -> Wanderlust rename: run it once on the
 * pre-rename commit (tag `v0-wanderlearn-ui`) to freeze the old look, then
 * again after the rebrand lands. The two sets are what BAM films against.
 *
 * This is deliberately NOT a Playwright spec. It is not a test, it has no
 * assertions, and it must never gate CI — a marketing capture failing a
 * build would be absurd. It drives Playwright directly instead.
 *
 * Output: ui-archive/<label>/<viewport>/<theme>/<route-slug>.png  (gitignored)
 *
 * Capture against a PRODUCTION BUILD, not `next dev`:
 *
 *   pnpm build && pnpm exec next start --port 3100
 *   pnpm capture:ui --base-url http://localhost:3100 --label before
 *
 * Dev mode compiles each route on first request, which is slow, triggers the
 * dev server's memory-threshold restart partway through a full sweep, and
 * renders with dev-only overlays and unoptimized images. None of that belongs
 * in a record you are going to film against.
 *
 * Other usage:
 *   pnpm capture:ui --base-url http://localhost:3100 --label after
 *   pnpm capture:ui --base-url http://localhost:3100 --only home   # one route
 *   pnpm capture:ui --base-url https://wanderlust.witus.online --label after
 *
 * --base-url is REQUIRED and has no default. BAM runs several ecosystem apps
 * side by side, so guessing a port would happily photograph a different app.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";

type Viewport = { name: string; width: number; height: number };
type Theme = "light" | "dark";

/**
 * The smallest supported viewport comes first because it is the one the
 * style guide designs against; the desktop pass is the secondary record.
 */
const VIEWPORTS: Viewport[] = [
  { name: "mobile-375x667", width: 375, height: 667 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
];

const THEMES: Theme[] = ["light", "dark"];

/**
 * Locale-prefixed paths, captured in `en` only — the point is the visual
 * system, and `es` renders the same components. Seeded routes are listed
 * separately so a run against an unseeded database still produces a set
 * rather than dying halfway through.
 */
const PUBLIC_PATHS = [
  "",
  "/how-it-works",
  "/help",
  "/docs/transcripts",
  "/help/upload-media",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/tours",
  "/courses",
  "/privacy",
  "/terms",
  "/accessibility",
];

/** Only meaningful against a seeded database. Missing pages are skipped, not fatal. */
const SEEDED_PATHS = [
  "/courses/mucho-museo-del-chocolate",
  "/tours/mucho-museo-del-chocolate",
];

/** Requires a signed-in session, which this script does not establish. Listed for the manual pass. */
const AUTHED_PATHS = ["/account"];

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function slugForPath(routePath: string): string {
  const trimmed = routePath.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "home" : trimmed.replace(/\//g, "__");
}

/**
 * `next dev` recycles itself when it approaches its memory threshold, which it
 * reliably does partway through a 50-route sweep of cold routes. The restart
 * takes a second or two and refuses connections while it happens. Retrying is
 * the difference between a complete set and losing the back half of the run.
 *
 * Only connection-level failures are retried — an HTTP error is a real result
 * and gets reported as one.
 */
async function gotoWithRetry(page: Page, url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const transient =
        message.includes("ERR_CONNECTION_REFUSED") ||
        message.includes("ERR_CONNECTION_RESET") ||
        message.includes("ERR_EMPTY_RESPONSE");
      if (!transient || attempt === attempts) throw error;
      process.stdout.write(`    ...  server unavailable, retry ${attempt}/${attempts - 1}\n`);
      await page.waitForTimeout(5_000);
    }
  }
  throw lastError;
}

async function capture(
  page: Page,
  baseUrl: string,
  routePath: string,
  outFile: string,
): Promise<"ok" | "skipped" | "failed"> {
  const url = `${baseUrl}/en${routePath}`;
  try {
    const response = await gotoWithRetry(page, url);

    const status = response?.status() ?? 0;
    if (status >= 400) {
      console.log(`    skip  ${routePath || "/"}  (HTTP ${status})`);
      return "skipped";
    }

    // The globe (react-globe.gl) and Photo Sphere Viewer mount after hydration,
    // fetch textures, then draw to a WebGL canvas. Without a settle window the
    // capture catches an empty black box where the globe should be. Wait for
    // any canvas to have actually painted, then give textures a beat longer.
    // Short probe on purpose: a canvas that is going to mount is in the tree
    // within a beat of hydration, and the long wait afterwards is for texture
    // loading, not mounting. A generous probe here would instead cost its full
    // timeout on each of the ~11 routes that have no canvas at all.
    const hasCanvas = await page
      .locator("canvas")
      .first()
      .waitFor({ state: "visible", timeout: 2_000 })
      .then(() => true)
      .catch(() => false);

    await page.waitForTimeout(hasCanvas ? 4_000 : 800);

    await mkdir(path.dirname(outFile), { recursive: true });
    await page.screenshot({ path: outFile, fullPage: true });
    console.log(`    ok    ${routePath || "/"}`);
    return "ok";
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    console.log(`    FAIL  ${routePath || "/"}  ${message}`);
    return "failed";
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = args.get("base-url");
  if (!baseUrl) {
    console.error(
      [
        "capture-ui: --base-url is required.",
        "",
        "  pnpm capture:ui --base-url http://localhost:3100",
        "",
        "No default is assumed on purpose: several WitUS apps run side by side",
        "in development, and a wrong port silently photographs the wrong app.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const label = args.get("label") ?? "before";
  const includeSeeded = args.get("seeded") === "true";
  const outRoot = path.join(process.cwd(), "ui-archive", label);

  // --only narrows the sweep to matching routes, so re-capturing one page after
  // a tweak doesn't mean re-shooting all 52.
  const only = args.get("only");
  const allPaths = [...PUBLIC_PATHS, ...(includeSeeded ? SEEDED_PATHS : [])];
  const paths = only
    ? allPaths.filter((p) => (p === "" ? "home" : p).includes(only))
    : allPaths;

  if (paths.length === 0) {
    console.error(`capture-ui: --only "${only}" matched no routes.`);
    process.exit(1);
  }

  console.log(`capture-ui`);
  console.log(`  base url : ${normalizedBase}`);
  console.log(`  label    : ${label}`);
  console.log(`  routes   : ${paths.length}${includeSeeded ? " (incl. seeded)" : ""}`);
  console.log(`  output   : ${outRoot}`);
  console.log("");

  let browser: Browser | undefined;
  const tally = { ok: 0, skipped: 0, failed: 0 };

  try {
    browser = await chromium.launch();

    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        console.log(`  ${viewport.name} / ${theme}`);
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: theme,
          deviceScaleFactor: 2,
          // Screenshots of animated heroes are non-deterministic otherwise, and
          // the style guide requires the reduced-motion path to look right too.
          reducedMotion: "reduce",
        });
        const page = await context.newPage();

        for (const routePath of paths) {
          const outFile = path.join(
            outRoot,
            viewport.name,
            theme,
            `${slugForPath(routePath)}.png`,
          );
          const result = await capture(page, normalizedBase, routePath, outFile);
          tally[result] += 1;
        }

        await context.close();
      }
    }

    // A manifest makes the set self-describing six months from now, when
    // "which commit was this?" is the only question that matters. Skipped on a
    // filtered run — writing a partial route list over a full one would make
    // the archive claim less coverage than it has.
    if (!only) {
      const manifest = {
        label,
        baseUrl: normalizedBase,
        capturedAt: new Date().toISOString(),
        gitRef: process.env.CAPTURE_GIT_REF ?? null,
        viewports: VIEWPORTS,
        themes: THEMES,
        paths,
        authedPathsNotCaptured: AUTHED_PATHS,
        tally,
      };
      await mkdir(outRoot, { recursive: true });
      await writeFile(
        path.join(outRoot, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
      );
    }
  } finally {
    await browser?.close();
  }

  console.log("");
  console.log(`  captured ${tally.ok}, skipped ${tally.skipped}, failed ${tally.failed}`);
  if (!includeSeeded) {
    console.log(`  seeded routes not captured — re-run with --seeded true against a seeded DB`);
  }
  console.log(`  ${AUTHED_PATHS.join(", ")} needs a signed-in session; capture by hand`);

  // Exit non-zero only on a hard failure, so a missing seeded route never
  // looks like a broken run.
  if (tally.failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
