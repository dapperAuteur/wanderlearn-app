# E2E tests

Full-flow Playwright tests beyond the `tests/a11y/` axe checks. These
hit authenticated learner paths (enroll, lesson player, certificate
download) and need one-time setup before they can run.

## Prerequisites

1. **Seeded MUCHO course** — the spec hits `/en/courses/mucho-museo-del-chocolate`.
   Run `pnpm db:seed` against whichever DB `.env.local` points at.

2. **Saved learner session** at `tests/e2e/.auth/user.json` (gitignored).
   One-time setup: sign in as a learner in a dev server, then save the
   browser storage state to that file.

## Saving a session once

Pick whichever workflow is easier. Both produce the same JSON file.

### Option A — Playwright codegen UI

1. Start the dev server: `pnpm dev` (or `pnpm exec next dev --port 3100`
   to match the default Playwright config port).
2. In another terminal:
   ```bash
   pnpm exec playwright codegen http://localhost:3100
   ```
3. A Playwright-launched browser opens. Sign in through the normal
   magic-link or passkey flow. Land on any authenticated page.
4. In the codegen inspector that opened alongside the browser, click
   **"Save storage state"** → save to `tests/e2e/.auth/user.json`.

### Option B — manual script

Add this to a scratch file and run it once:

```ts
// save-auth.ts
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("http://localhost:3100/en/sign-in");
// pause so you can sign in manually
await page.pause();
await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
await browser.close();
```

Run with `pnpm exec tsx save-auth.ts`. Sign in, close the inspector.

## Running the tests

```bash
# Seeded DB required:
PLAYWRIGHT_SEEDED=1 pnpm exec playwright test tests/e2e
```

If either prerequisite is missing, tests in this directory self-skip —
they won't break CI, they just won't run.

## What's tested

- `enroll-to-certificate.spec.ts` — land on MUCHO course → enroll free
  (idempotent, skips if already enrolled) → walk every lesson →
  mark complete → download the PDF certificate and verify it's a
  non-empty PDF response.

## What's NOT tested (yet)

- **Paid checkout** — needs Stripe test-card flow + webhook simulation;
  covered manually in the user-task 01 §10 "Stripe smoke" run.
- **Support-chat flow** — separate E2E when there's demand.
- **Creator surfaces** — out of scope for learner happy-path spec.
- **Offline mode** — Serwist behavior + outbox replay deserve a
  dedicated spec; not here.
