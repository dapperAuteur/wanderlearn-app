import { describe, expect, it } from "vitest";
import { httpUrlSchema, isHttpUrl } from "./http-url";

describe("httpUrlSchema / isHttpUrl", () => {
  const good = ["https://example.org/donate", "http://example.org", "https://ex.org/a?b=c#d"];
  const bad = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "ftp://example.org",
    "mailto:a@example.org",
    "not a url",
  ];

  it.each(good)("accepts %s", (url) => {
    expect(httpUrlSchema.safeParse(url).success).toBe(true);
    expect(isHttpUrl(url)).toBe(true);
  });

  it.each(bad)("rejects %s", (url) => {
    expect(httpUrlSchema.safeParse(url).success).toBe(false);
    expect(isHttpUrl(url)).toBe(false);
  });

  it("caps the length at 500", () => {
    expect(httpUrlSchema.safeParse(`https://example.org/${"a".repeat(500)}`).success).toBe(false);
  });
});
