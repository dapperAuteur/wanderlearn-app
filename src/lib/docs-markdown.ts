import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sanitizeHtml from "sanitize-html";
import { marked } from "marked";

// Broader allow-list than markdown.ts — docs pages need tables for the
// block-type and troubleshooting references. Headings + tables + links +
// code are the expected surface; no HTML injection, no inline styles.
const DOCS_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "del",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowProtocolRelative: false,
};

// Rewrite or strip links that only make sense inside the repo. The docs/ MD
// files are also viewed by engineers in VS Code / GitHub where these paths
// resolve; on the public web they need to be either rerouted or de-linked.
function rewriteInternalLinks(md: string, lang: string): string {
  return (
    md
      // Sibling doc → public route
      .replace(/\]\(CREATOR_GUIDE\.md(?:#[^)]+)?\)/g, `](/${lang}/docs/creator)`)
      .replace(/\]\(ADMIN_GUIDE\.md(?:#[^)]+)?\)/g, `](/${lang}/docs/admin)`)
      // Engineering-only references — keep the text, drop the link
      .replace(/\[([^\]]+)\]\(\.\.\/plans\/[^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\(\.\.\/scripts\/[^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\(\.\.\/src\/[^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\(CLOUDINARY_[A-Z_]+\.md[^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\(INFRA\.md[^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\(NEON_SETUP\.md[^)]*\)/g, "$1")
  );
}

function docsDir(): string {
  return join(process.cwd(), "docs");
}

export type DocId = "creator" | "admin" | "embed-tours";

const DOC_FILENAMES: Record<DocId, string> = {
  creator: "CREATOR_GUIDE.md",
  admin: "ADMIN_GUIDE.md",
  "embed-tours": "EMBED_TOURS.md",
};

export function readDocSource(id: DocId): string {
  return readFileSync(join(docsDir(), DOC_FILENAMES[id]), "utf8");
}

export async function renderDocHtml(id: DocId, lang: string): Promise<string> {
  const source = readDocSource(id);
  const rewritten = rewriteInternalLinks(source, lang);
  const raw = await marked.parse(rewritten, { async: true });
  return sanitizeHtml(raw, DOCS_SANITIZE_OPTIONS);
}
