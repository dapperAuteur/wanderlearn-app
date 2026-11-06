import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Error pages keep the app shell (witus docs/shared-ui-ux-dx.md). A path with no valid locale
 * prefix renders the ROOT not-found, outside the [lang] layout, so it must render the real
 * AppHeader (Sign in) and AppFooter itself; global-error must carry home and Sign in links.
 */
const read = (rel: string) => readFileSync(join(__dirname, rel), "utf-8");

describe("error pages keep the app shell", () => {
  it("the root 404 renders AppHeader, AppFooter, one h1 and a home link", () => {
    const src = read("not-found.tsx");
    expect(src).toMatch(/<AppHeader dict=\{dict\.nav\}/);
    expect(src).toMatch(/<AppFooter dict=\{dict\.footer\}/);
    expect(src.match(/<h1/g)).toHaveLength(1);
    expect(src).toMatch(/href=\{`\/\$\{defaultLocale\}`\}/);
  });

  it("global-error carries its own home and Sign in links", () => {
    const src = read("global-error.tsx");
    expect(src).toMatch(/href="\/"/);
    expect(src).toMatch(/href="\/en\/sign-in"[^>]*>\s*Sign in\s*</);
  });
});
