import { renderDescriptionMarkdown } from "@/lib/description-markdown";

/**
 * Renders a destination/course description written in the markdown subset.
 *
 * Server component: the sanitizing renderer is `server-only`, so the HTML is
 * produced and cleaned on the server and never assembled in the browser.
 *
 * Tailwind's preflight strips list markers and margins, and this project has no
 * typography plugin, so the element styles are spelled out here. Keeping them in one
 * component is the point — four call sites rendering their own <ul> styling is how
 * descriptions end up looking different on the tour page than on the course page.
 */
export async function DescriptionProse({
  source,
  className = "",
}: {
  source: string;
  className?: string;
}) {
  const html = await renderDescriptionMarkdown(source);

  return (
    <div
      className={[
        "max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-200",
        "[&_p]:mb-3 [&_p:last-child]:mb-0",
        "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:mb-1",
        "[&_strong]:font-semibold [&_em]:italic",
        "[&_a]:underline [&_a]:underline-offset-2 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-current",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      // Safe: renderDescriptionMarkdown runs sanitize-html with a closed allowlist
      // (p, br, strong, em, ul, ol, li, a) and rewrites every anchor to
      // rel="noopener noreferrer". Never pass unsanitized HTML here.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
