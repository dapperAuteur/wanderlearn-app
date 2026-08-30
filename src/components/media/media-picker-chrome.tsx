"use client";

import { useMemo, useState } from "react";

/**
 * Shared collapse / scope / pagination behaviour for every media picker.
 *
 * Each picker used to render its whole grid at once. That is around 120 <Image>
 * tags on this account today, which is both a wall of thumbnails and a pile of
 * image requests on a page where the picker is usually not the thing the creator
 * came to do. Two pickers had already grown their own slightly different fix; a
 * third would have guaranteed they drifted, so the behaviour lives here once.
 *
 * Pagination is deliberately client-side. The full option list is already in the
 * payload because the pickers need it for the scope counts and the current
 * selection, so paging over it costs one slice and no round trip. If a library
 * ever grows past a few thousand files this should become a server query, and
 * the seam is this hook.
 */

export type PickerChromeDict = {
  scopeThisTour: string;
  scopeAll: string;
  countLabel: string;
  showingLabel: string;
  prevCta: string;
  nextCta: string;
};

export const DEFAULT_PICKER_PAGE_SIZE = 12;

/**
 * What to call a media file, in one place.
 *
 * Three steps: the name the creator typed, else the original upload filename,
 * else a placeholder. The media library has always done this; every PICKER
 * skipped the middle step, so a file with no typed name read as
 * "elmina-courtyard.jpg" in the library and "Untitled" in every picker — the
 * same asset under two names, which makes the thing you just uploaded
 * impossible to find in a list of Untitleds.
 *
 * Lives here rather than in each picker so the rule is stated once. Six
 * components copied the two-step version; that is how the gap survived.
 */
export function mediaLabel(
  option: { displayName?: string | null; originalFilename?: string | null; fallbackName?: string | null },
  unnamed: string,
): string {
  return (
    option.displayName?.trim() ||
    option.originalFilename?.trim() ||
    option.fallbackName?.trim() ||
    unnamed
  );
}

/** Module scope: it closes over nothing, so it stays referentially stable and
 *  the memos below do not re-run on every render. */
const inTour = (o: unknown) => (o as { inThisTour?: boolean }).inThisTour === true;

/**
 * `T` is unconstrained on purpose. Constraining it to `{ inThisTour?: boolean }`
 * trips TypeScript's weak-type check for lists that legitimately have no scope
 * concept at all, like the destination library's own assigned/auto lists.
 */
export function usePagedOptions<T>({
  options,
  pageSize = DEFAULT_PICKER_PAGE_SIZE,
  initiallyOpen = false,
}: {
  options: T[];
  pageSize?: number;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  // Only offer the tour scope when something actually qualifies, and default to
  // it when it does: a replacement file is nearly always another shot of the
  // same place.
  const hasTourScope = useMemo(() => options.some(inTour), [options]);
  const [scope, setScopeState] = useState<"tour" | "all">(hasTourScope ? "tour" : "all");
  const [page, setPage] = useState(0);

  const scoped = useMemo(
    () => (scope === "tour" && hasTourScope ? options.filter(inTour) : options),
    [options, scope, hasTourScope],
  );

  const totalPages = Math.max(1, Math.ceil(scoped.length / pageSize));
  // Clamp rather than store a page that no longer exists: deleting or filtering
  // can shrink the list under the current page, which would otherwise render an
  // empty grid with no way back.
  const safePage = Math.min(page, totalPages - 1);
  const from = scoped.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(scoped.length, (safePage + 1) * pageSize);
  const pageItems = useMemo(
    () => scoped.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [scoped, safePage, pageSize],
  );

  function setScope(next: "tour" | "all") {
    setScopeState(next);
    setPage(0);
  }

  return {
    open,
    setOpen,
    scope,
    setScope,
    hasTourScope,
    page: safePage,
    setPage,
    pageItems,
    totalPages,
    total: scoped.length,
    from,
    to,
  };
}

const chipBase =
  "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

export function ScopeChips({
  scope,
  setScope,
  dict,
}: {
  scope: "tour" | "all";
  setScope: (next: "tour" | "all") => void;
  dict: PickerChromeDict;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          ["tour", dict.scopeThisTour],
          ["all", dict.scopeAll],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setScope(value)}
          aria-pressed={scope === value}
          className={`${chipBase} ${
            scope === value
              ? "bg-foreground text-background"
              : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function PickerToggle({
  open,
  setOpen,
  count,
  expandCta,
  collapseCta,
  dict,
}: {
  open: boolean;
  setOpen: (next: boolean) => void;
  count: number;
  expandCta: string;
  collapseCta: string;
  dict: PickerChromeDict;
}) {
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      className="inline-flex min-h-11 w-fit items-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
    >
      {open ? collapseCta : expandCta}{" "}
      <span className="ml-2 text-zinc-600 dark:text-zinc-400">
        {dict.countLabel.replace("{count}", String(count))}
      </span>
    </button>
  );
}

const pagerBtn =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5";

export function Pager({
  page,
  totalPages,
  from,
  to,
  total,
  setPage,
  dict,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  setPage: (next: number) => void;
  dict: PickerChromeDict;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setPage(page - 1)}
        disabled={page === 0}
        className={pagerBtn}
      >
        {dict.prevCta}
      </button>
      <button
        type="button"
        onClick={() => setPage(page + 1)}
        disabled={page >= totalPages - 1}
        className={pagerBtn}
      >
        {dict.nextCta}
      </button>
      {/* Announce the range, not just the page number: after paging, a screen
          reader user otherwise has no idea the grid contents changed. */}
      <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {dict.showingLabel
          .replace("{from}", String(from))
          .replace("{to}", String(to))
          .replace("{total}", String(total))}
      </p>
    </div>
  );
}
