import "server-only";
import sanitizeHtml from "sanitize-html";
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
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
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowProtocolRelative: false,
};

export async function renderMarkdown(source: string): Promise<string> {
  const raw = await marked.parse(source, { async: true });
  return sanitizeHtml(raw, SANITIZE_OPTIONS);
}
