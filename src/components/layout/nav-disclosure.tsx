"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export type NavLinkItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  /** Stable key; also what the group is found by in tests. */
  id: string;
  /** The trigger's text when the group has two or more links. */
  label: string;
  items: NavLinkItem[];
  /**
   * The link text when the group collapses to a single link. A signed-out
   * visitor's Tours group holds only "Browse tours", and a one-item dropdown is
   * a click that tells them nothing, so it renders as a plain "Tours" link.
   */
  soloLabel?: string;
};

export function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * One header category: a button that shows and hides a list of links.
 *
 * This is the WAI-ARIA disclosure navigation pattern, not `role="menu"`. Menus
 * promise application-style arrow-key behaviour that site navigation doesn't
 * need, and screen readers announce them as something other than links. A
 * disclosure keeps every item a plain link in the normal Tab order.
 */
export function NavDisclosure({ label, items }: { label: string; items: NavLinkItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const groupActive = items.some((item) => isActiveHref(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Only close when focus lands somewhere else on the page. A null
        // relatedTarget is a click on something unfocusable (Safari doesn't
        // focus links on click), and closing then would hide the panel before
        // the click on its link registers. The outside-pointer listener above
        // covers those clicks.
        const next = event.relatedTarget as Node | null;
        if (next && !rootRef.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-md px-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
          groupActive ? "font-semibold" : ""
        }`}
      >
        {label}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
        >
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="absolute left-0 top-full z-40 mt-1 min-w-48 rounded-md border border-line bg-surface p-1 shadow-lg"
      >
        {items.map((item) => {
          const current = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center whitespace-nowrap rounded px-3 hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                  isActiveHref(pathname, item.href) ? "font-semibold" : ""
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
