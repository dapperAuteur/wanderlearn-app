import "server-only";
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

export async function renderMarkdown(source: string): Promise<string> {
  const raw = await marked.parse(source, { async: true });
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
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
    ALLOWED_ATTR: ["href", "title", "target", "rel", "src", "alt"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/|#)/i,
  });
}
