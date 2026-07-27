/**
 * Sanitizer checks for the description markdown subset.
 *
 * Run with: pnpm check:sanitizer
 *
 * Not a Playwright spec: Playwright's runner transforms specs to CJS and `marked`
 * is ESM-only, so importing the renderer there fails with "Cannot use import
 * statement outside a module". tsx handles the ESM graph natively. This repo has no
 * unit-test runner yet (STYLE_GUIDE names Vitest as the default stack but it is not
 * installed) — see plans/future/06. Until then this is the gate for the riskiest code
 * in the feature, and it must be run by hand before merging changes to
 * description-markdown-core.ts.
 *
 * Why it matters: descriptions are partner-authored and rendered inside iframes on
 * partner museum domains, so a sanitizer bypass is stored XSS on someone else's site.
 */
import {
  renderDescriptionMarkdown,
  descriptionPlainText,
  truncateForCard,
} from "../src/lib/description-markdown-core";

let failures = 0;
function check(condition: boolean, label: string): void {
  console.log(`${condition ? "  PASS  " : "  FAIL  "}${label}`);
  if (!condition) failures++;
}

async function main(): Promise<void> {
  console.log("allowed subset renders:");
  const allowed = await renderDescriptionMarkdown(
    "A **bold** and *italic* intro.\n\n- first\n- second\n\n[Visit us](https://example.com)",
  );
  check(allowed.includes("<strong>bold</strong>"), "bold");
  check(allowed.includes("<em>italic</em>"), "italic");
  check(allowed.includes("<ul>") && allowed.includes("<li>first</li>"), "unordered list");
  check(allowed.includes('href="https://example.com"'), "link href preserved");
  check(allowed.includes('rel="noopener noreferrer"'), "link rel hardened");

  console.log("everything outside the subset is stripped:");
  const wide = await renderDescriptionMarkdown(
    "# Heading\n\n![i](https://e.com/x.jpg)\n\n> quote\n\n`code`\n\n| a |\n| - |\n| 1 |",
  );
  for (const tag of ["<h1", "<h2", "<img", "<blockquote", "<code", "<table", "<pre"]) {
    check(!wide.includes(tag), `${tag} removed`);
  }

  console.log("injection attempts neutralized:");
  const hostile = await renderDescriptionMarkdown(
    [
      '<script>alert("xss")</script>',
      '<img src=x onerror="alert(1)">',
      '<a href="javascript:alert(1)">click</a>',
      '<div onclick="alert(1)">hi</div>',
      "[legit looking](javascript:alert(1))",
      '<iframe src="https://evil.example"></iframe>',
      "<style>body{display:none}</style>",
    ].join("\n\n"),
  );
  for (const bad of ["<script", "<iframe", "<style", "onerror", "onclick", "javascript:"]) {
    check(!hostile.includes(bad), `${bad} blocked`);
  }

  console.log("plain-text projection for meta/OG:");
  const text = await descriptionPlainText(
    "A **bold** intro with a [link](https://example.com).\n\n- one\n- two",
  );
  check(!text.includes("**") && !text.includes("](") && !text.includes("<"), "syntax stripped");
  check(text.includes("bold") && text.includes("link"), "words preserved");
  check(!text.includes("\n"), "collapsed to one line");
  console.log(`         -> ${JSON.stringify(text)}`);

  console.log("card truncation:");
  check(truncateForCard("short text", 180) === "short text", "short text passes through");
  const cut = truncateForCard("word ".repeat(60).trim(), 50);
  check(cut.length <= 51 && cut.endsWith("…"), "truncated with ellipsis");
  check(!/wor…$/.test(cut), "cuts on a word boundary");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
