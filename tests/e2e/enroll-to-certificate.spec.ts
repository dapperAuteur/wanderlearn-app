import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Happy-path E2E: enroll in MUCHO (free) → take each lesson → mark
// complete → download certificate.
//
// Requires two prerequisites. The test self-skips if either is missing:
//
// 1. Seeded MUCHO course on whichever DB the dev server points at.
//    `pnpm db:seed` against the target DATABASE_URL.
//
// 2. A saved auth cookie at `tests/e2e/.auth/user.json`. One-time setup:
//    - Run `pnpm dev` (port 3000 or whatever your config uses)
//    - Sign in manually as a learner user (magic-link or passkey)
//    - In DevTools → Application → Cookies → export the session cookie
//      for your dev host, OR run:
//        pnpm exec playwright codegen http://localhost:3100
//      sign in in the launched browser, then use "Save storage state"
//      from the inspector to write tests/e2e/.auth/user.json
//    - Check that file exists; it's gitignored.

const authStatePath = path.join(process.cwd(), "tests/e2e/.auth/user.json");
const hasAuth = existsSync(authStatePath);
const seeded = Boolean(process.env.PLAYWRIGHT_SEEDED);

test.describe("enroll-to-certificate happy path", () => {
  test.skip(
    !hasAuth,
    "Requires tests/e2e/.auth/user.json — see spec comment for setup.",
  );
  test.skip(
    !seeded,
    "Requires PLAYWRIGHT_SEEDED=1 and a seeded MUCHO course.",
  );

  test.use({ storageState: authStatePath });

  test("learner enrolls in MUCHO, completes every lesson, downloads certificate", async ({
    page,
  }) => {
    const courseSlug = "mucho-museo-del-chocolate";
    const coursePath = `/en/courses/${courseSlug}`;

    // --- Step 1: land on the course detail page.
    await page.goto(coursePath, { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { level: 1 }),
      "course H1 should render",
    ).toBeVisible();

    // --- Step 2: enroll free (idempotent — if already enrolled, the
    // button reads "Resume where you left off" and we just click through
    // to the first lesson).
    const enrollButton = page.getByRole("button", { name: /enroll free/i });
    const resumeLink = page.getByRole("link", { name: /resume/i });
    if (await enrollButton.isVisible().catch(() => false)) {
      await enrollButton.click();
      await page.waitForURL(new RegExp(`${courseSlug}.*`), { timeout: 10_000 });
    }

    // --- Step 3: open the first lesson. Could be via "Start course",
    // "Resume", or a direct lesson link in the sidebar.
    const startLink = page
      .getByRole("link", { name: /start course/i })
      .or(resumeLink)
      .first();
    if (await startLink.isVisible().catch(() => false)) {
      await startLink.click();
    } else {
      // Fallback: click the first lesson link in the lessons list.
      await page
        .getByRole("link")
        .filter({ hasText: /01|Lesson 1|Visiting/i })
        .first()
        .click();
    }
    await page.waitForURL(/\/learn\//);

    // --- Step 4: walk every lesson. MUCHO has 4 text lessons today; we
    // keep looping until "Back to course" shows up without a "Next lesson"
    // button — that's the end of the course.
    let safetyCap = 20; // hard cap so a broken "next" loop can't spin forever
    while (safetyCap-- > 0) {
      await expect(
        page.getByRole("heading", { level: 1 }),
        "each lesson should render an H1",
      ).toBeVisible();

      const completeButton = page.getByRole("button", {
        name: /mark lesson complete/i,
      });
      if (await completeButton.isEnabled().catch(() => false)) {
        await completeButton.click();
        // Wait for either the next-lesson nav or the back-to-course nav.
        await page.waitForLoadState("load");
      }

      const nextLesson = page.getByRole("link", { name: /next/i });
      if (await nextLesson.isVisible().catch(() => false)) {
        await nextLesson.click();
        await page.waitForURL(/\/learn\//);
        continue;
      }
      // No next lesson — we're done.
      break;
    }
    expect(safetyCap, "next-lesson loop should terminate").toBeGreaterThan(0);

    // --- Step 5: back on the course detail page, certificate link should
    // be available now that all lessons are complete.
    await page.goto(coursePath, { waitUntil: "load" });
    const certLink = page.getByRole("link", { name: /download certificate/i });
    await expect(certLink, "certificate link visible after completion").toBeVisible();

    // --- Step 6: trigger a download and assert the PDF comes back. We
    // don't save the file; we just confirm the response body is a PDF.
    const certHref = await certLink.getAttribute("href");
    expect(certHref, "certificate link should have an href").toBeTruthy();
    const response = await page.request.get(certHref!);
    expect(response.status(), "certificate route 200s").toBe(200);
    expect(response.headers()["content-type"]).toMatch(/application\/pdf/i);
    const bytes = await response.body();
    expect(bytes.length, "PDF body has content").toBeGreaterThan(1024);
  });
});
