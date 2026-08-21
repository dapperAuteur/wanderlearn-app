import { test, expect, type Page } from "@playwright/test";

/**
 * Regression cover for social preview images.
 *
 * WHY. On 2026-08-21 both the tour and course `opengraph-image` routes were
 * found rendering their "not found" fallback for EVERY tour and EVERY course.
 * `params` is a Promise in this Next version; the hand-written type said it
 * was a plain object, so destructuring it synchronously produced undefined and
 * every lookup missed.
 *
 * It had been that way indefinitely, and nothing caught it, because the
 * failure is silent AND successful: HTTP 200, a valid PNG, right dimensions,
 * right brand colours — just the wrong picture. Every link anyone shared to a
 * tour or a course previewed as a blank card reading "not found". For a
 * product whose growth model is people sharing places, that is close to the
 * worst possible failure to have gone unnoticed.
 *
 * The homepage route takes no params and always worked, so any casual "do our
 * previews work?" check came back fine.
 *
 * HOW. An image cannot be asserted on without reading pixels, so instead the
 * fallback SAYS it is the fallback: it sets `x-og-fallback: 1`. These tests
 * assert a real slug does not produce that header — and that a nonsense slug
 * does, so the detector itself is proven rather than assumed.
 */

test.skip(
  !process.env.PLAYWRIGHT_SEEDED,
  "OG image tests need a database with at least one published tour and course.",
);

async function firstSlugUnder(page: Page, section: "tours" | "courses"): Promise<string | null> {
  await page.goto(`/en/${section}`, { waitUntil: "load" });
  const href = await page
    .locator(`a[href^="/en/${section}/"]`)
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (!href) return null;
  const slug = href.split(`/en/${section}/`)[1]?.split(/[?#]/)[0];
  return slug && slug.length > 0 ? slug : null;
}

for (const section of ["tours", "courses"] as const) {
  test(`the ${section} OG image renders real content, not the fallback`, async ({ page, request }) => {
    const slug = await firstSlugUnder(page, section);
    test.skip(!slug, `No published ${section} in this database.`);

    const response = await request.get(`/en/${section}/${slug}/opengraph-image`);

    expect(response.status(), `OG route for /${section}/${slug} did not return 200`).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");

    expect(
      response.headers()["x-og-fallback"],
      `The OG image for /en/${section}/${slug} rendered the "not found" fallback. ` +
        "Every shared link to it will preview as a blank card. The usual cause is `params` " +
        "being read without awaiting it — see plans/app-improvements/27.",
    ).toBeUndefined();

    // A fallback card is a few words on a flat background and compresses to
    // almost nothing. Real content is a headline, a location, a description and
    // often a photograph. This is a loose sanity floor, not a pixel assertion.
    const body = await response.body();
    expect(
      body.byteLength,
      `OG image for /en/${section}/${slug} is suspiciously small (${body.byteLength} bytes), ` +
        "which usually means it rendered almost nothing.",
    ).toBeGreaterThan(30_000);
  });
}

test("the fallback marker is real — a nonsense slug does set it", async ({ request }) => {
  // Proves the assertions above can actually fail. A detector nobody has seen
  // trip is a guess, and this one is the whole basis of the tests.
  const response = await request.get(
    "/en/tours/definitely-not-a-real-tour-slug-9f3a2b/opengraph-image",
  );
  expect(response.status()).toBe(200);
  expect(
    response.headers()["x-og-fallback"],
    "A nonexistent tour should render the fallback and mark it. If this is missing, the " +
      "other tests in this file prove nothing.",
  ).toBe("1");
});
