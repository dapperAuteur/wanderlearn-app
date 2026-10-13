"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isHttpUrl } from "@/lib/http-url";
import { splitTourLinks, type TourLink } from "@/lib/tour-links";

export type TourLinksLabels = {
  /** Landmark name for the group, e.g. "Tour links". */
  group: string;
  /** Button text when a featured link sits beside it. */
  more: string;
  /** Button text when nothing is featured. */
  links: string;
  /** Appended for screen readers to every link: they all open a new tab. */
  opensInNewTab: string;
};

const LINK_CLASS =
  "flex min-h-11 items-center whitespace-nowrap rounded px-3 text-sm hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

/**
 * A tour's donate / tickets / site links, pinned to the top-right corner of the
 * viewer on every scene.
 *
 * Rendered (through a portal) INSIDE the element PSV sends fullscreen, unlike
 * the other React overlays, so the links stay put in fullscreen too. Not in
 * PSV's navbar: its buttons are fixed at 40px and are divs without a button
 * role, and this needs real links at 44px.
 */
export function TourLinksOverlay({ links, labels }: { links: TourLink[]; labels: TourLinksLabels }) {
  const safe = links.filter((link) => isHttpUrl(link.url));
  const { featured, others } = splitTourLinks(safe);
  const listed = featured ? others : safe;
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  if (safe.length === 0) return null;

  return (
    <nav
      ref={rootRef}
      aria-label={labels.group}
      className="absolute right-2 top-2 z-[95] flex max-w-[calc(100%-1rem)] flex-col items-end gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Same rule as the header menus: only close when focus lands elsewhere
        // on the page; a null relatedTarget is a click the pointer listener handles.
        const next = event.relatedTarget as Node | null;
        if (next && !rootRef.current?.contains(next)) setOpen(false);
      }}
    >
      <div className="flex flex-wrap justify-end gap-2">
        {featured ? (
          <a
            href={featured.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-full border-2 border-brand-text bg-brand px-4 text-sm font-bold text-on-brand shadow-lg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {featured.label}
            <span className="sr-only"> ({labels.opensInNewTab})</span>
          </a>
        ) : null}
        {listed.length > 0 ? (
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full bg-black/70 px-4 text-sm font-semibold text-white shadow-lg backdrop-blur hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {featured ? labels.more : labels.links}
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
              fill="currentColor"
            >
              <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        ) : null}
      </div>
      <ul
        id={listId}
        hidden={!open}
        className="min-w-48 max-w-full rounded-md bg-black/85 p-1 text-white shadow-lg backdrop-blur"
      >
        {listed.map((link) => (
          <li key={`${link.label}|${link.url}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={LINK_CLASS}
            >
              <span className="truncate">{link.label}</span>
              <span className="sr-only"> ({labels.opensInNewTab})</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
