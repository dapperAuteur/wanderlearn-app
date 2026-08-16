import { test, expect } from "@playwright/test";

// Post-deploy smoke (@smoke): the production workflow job runs ONLY tests tagged @smoke, so keep
// this file to checks that are safe and meaningful against live production. /api/health really
// opens a database connection and returns 503 fast when it's unreachable (see
// src/app/api/health/route.ts), so a green here means "deployed AND serving real data", which is
// the whole point of the gate.
test("@smoke health endpoint answers ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Exact contract from src/app/api/health/route.ts: 200 {"ok":true,"checks":{"db":"ok"}}.
  expect(body.ok).toBe(true);
  expect(body.checks?.db).toBe("ok");
});

test("@smoke homepage serves", async ({ page }) => {
  await page.goto("/");
  // "/" locale-negotiates and redirects to /en or /es (src/app/page.tsx). Assert the landed URL
  // pattern, not a hardcoded locale — the runner's Accept-Language decides which one we get.
  await expect(page).toHaveURL(/\/(en|es)(\/|$|\?)/);
  await expect(page.locator("h1").first()).toBeVisible();
});
