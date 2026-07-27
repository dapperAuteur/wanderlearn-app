import "server-only";

/**
 * Server-only re-export of the description markdown helpers.
 *
 * App code imports this module; the implementation lives in
 * ./description-markdown-core so that tests and scripts can import the same
 * functions without Next's `server-only` guard, which does not resolve outside a
 * Next build. The guard stays here so marked + sanitize-html can never be pulled
 * into a client bundle by an accidental import from a "use client" file.
 */
export {
  renderDescriptionMarkdown,
  descriptionPlainText,
  truncateForCard,
} from "./description-markdown-core";
