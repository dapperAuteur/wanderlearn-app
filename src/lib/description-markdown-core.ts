import sanitizeHtml from "sanitize-html";
import { marked } from "marked";

/**
 * Pure implementation. Kept free of `server-only` so the sanitizer can actually be
 * exercised by tests and scripts; app code should import ./description-markdown
 * instead, which adds the server-only guard.
 *
 * Third and narrowest markdown tier in this repo:
 *
 *   docs-markdown.ts  — widest. Headings, tables, code, images. For /docs pages.
 *   markdown.ts       — middle. Headings, images, blockquote, pre. For lesson blocks.
 *   this file         — narrowest. Emphasis, links, lists, line breaks. Nothing else.
 *
 * Descriptions are chrome, not content: they sit on catalog cards, tour pages, and
 * course pages that already own their heading hierarchy. Allowing h1-h6 here would
 * let a creator inject a heading that outranks the page's own <h1> and wreck both the
 * visual rhythm and the document outline that screen readers navigate by. Images are
 * excluded for the same reason plus layout — a card is not a place to drop a 4 MB JPG.
 *
 * The threat model is not hypothetical: tours are embedded via iframe into partner
 * museum sites, so anything rendered from a description executes on someone else's
 * domain. Everything goes through sanitize-html with a closed allowlist; marked never
 * emits raw HTML to the page unfiltered.
 */
const DESCRIPTION_ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "a"];

const DESCRIPTION_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: DESCRIPTION_ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "rel", "target"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  // Every surviving link is treated as hostile-adjacent: it may be authored by a
  // partner and rendered inside another partner's iframe. noopener/noreferrer stops
  // window.opener access back into the embedding page.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer",
    }),
  },
};

/** Renders the description subset to sanitized HTML. */
export async function renderDescriptionMarkdown(source: string): Promise<string> {
  // Scoped options rather than marked.setOptions(): that call is global, and
  // markdown.ts already sets breaks/gfm process-wide. Passing them per-parse keeps
  // this tier from depending on whichever module happened to load first.
  const raw = await marked.parse(source, { async: true, breaks: true, gfm: true });
  return sanitizeHtml(raw, DESCRIPTION_SANITIZE_OPTIONS);
}

/**
 * Markdown stripped back to readable plain text.
 *
 * Needed anywhere the description is consumed as a string rather than rendered:
 * <meta name="description">, OpenGraph, JSON-LD, and catalog cards that must stay a
 * uniform height. Without this, raw `**asterisks**` and `[link](url)` syntax leaks
 * into search results and social previews.
 */
export async function descriptionPlainText(source: string): Promise<string> {
  const raw = await marked.parse(source, { async: true, breaks: true, gfm: true });
  const text = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
  // sanitize-html leaves entities encoded and block tags become newlines; collapse
  // to a single spaced line for meta/card use.
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncates on a word boundary, for card blurbs. Assumes plain text input. */
export function truncateForCard(text: string, max = 180): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
