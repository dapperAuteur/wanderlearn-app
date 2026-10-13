"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDestinationTourLinks } from "@/lib/actions/destinations";
import { isHttpUrl } from "@/lib/http-url";
import type { Locale } from "@/lib/locales";
import { MAX_TOUR_LINKS, TOUR_LINK_LABEL_MAX, type TourLink } from "@/lib/tour-links";

export type TourLinksDict = {
  heading: string;
  intro: string;
  rowLegend: string;
  labelLabel: string;
  labelHint: string;
  urlLabel: string;
  urlHint: string;
  featuredLegend: string;
  noFeatureLabel: string;
  addCta: string;
  removeCta: string;
  removeLabel: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  incompleteError: string;
  genericError: string;
  emptyState: string;
};

type Row = { key: number; label: string; url: string };

const INPUT =
  "min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20";
const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5";

/**
 * Tour-wide links (donate, tickets, the venue's site), set once and shown in
 * the same corner of every scene. Composed and then saved with a button,
 * unlike the save-on-change panels: a half-typed address is not a state worth
 * saving.
 */
export function TourLinksControl({
  destinationId,
  lang,
  initialLinks,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  initialLinks: TourLink[];
  dict: TourLinksDict;
}) {
  const router = useRouter();
  const baseId = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    initialLinks.map((link, index) => ({ key: index, label: link.label, url: link.url })),
  );
  const [nextKey, setNextKey] = useState(initialLinks.length);
  // Index into `rows`, or null for "no featured link".
  const [featuredKey, setFeaturedKey] = useState<number | null>(() => {
    const index = initialLinks.findIndex((link) => link.featured);
    return index === -1 ? null : index;
  });
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error" | "incomplete">("idle");

  function update(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setStatus("idle");
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey, label: "", url: "" }]);
    setNextKey((key) => key + 1);
    setStatus("idle");
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
    if (featuredKey === key) setFeaturedKey(null);
    setStatus("idle");
  }

  function save() {
    // A row left completely empty is simply dropped; a half-filled one is a mistake to report.
    const filled = rows
      .map((row) => ({ ...row, label: row.label.trim(), url: row.url.trim() }))
      .filter((row) => row.label || row.url);
    if (filled.some((row) => !row.label || !isHttpUrl(row.url))) {
      setStatus("incomplete");
      return;
    }
    const links: TourLink[] = filled.map((row) => ({
      label: row.label,
      url: row.url,
      featured: row.key === featuredKey,
    }));
    setStatus("idle");
    startTransition(async () => {
      const result = await saveDestinationTourLinks({ destinationId, links, lang });
      setStatus(result.ok ? "saved" : "error");
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-black/15 p-4 dark:border-white/20">
      <h3 className="text-base font-semibold">{dict.heading}</h3>
      <p className="mt-1 text-sm text-muted">{dict.intro}</p>

      {rows.length === 0 ? <p className="mt-4 text-sm text-muted">{dict.emptyState}</p> : null}

      <div className="mt-4 flex flex-col gap-4">
        {rows.map((row, index) => {
          const n = String(index + 1);
          const labelId = `${baseId}-label-${row.key}`;
          const urlId = `${baseId}-url-${row.key}`;
          return (
            <fieldset key={row.key} className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/15" disabled={pending}>
              <legend className="px-1 text-sm font-medium">{dict.rowLegend.replace("{n}", n)}</legend>
              <label htmlFor={labelId} className="text-sm font-medium">
                {dict.labelLabel}
              </label>
              <input
                id={labelId}
                value={row.label}
                maxLength={TOUR_LINK_LABEL_MAX}
                onChange={(event) => update(row.key, { label: event.target.value })}
                aria-describedby={`${labelId}-hint`}
                className={INPUT}
              />
              <p id={`${labelId}-hint`} className="text-xs text-muted">
                {dict.labelHint}
              </p>
              <label htmlFor={urlId} className="text-sm font-medium">
                {dict.urlLabel}
              </label>
              <input
                id={urlId}
                type="url"
                inputMode="url"
                pattern="https?://.+"
                maxLength={500}
                placeholder="https://"
                value={row.url}
                onChange={(event) => update(row.key, { url: event.target.value })}
                aria-describedby={`${urlId}-hint`}
                className={INPUT}
              />
              <p id={`${urlId}-hint`} className="text-xs text-muted">
                {dict.urlHint}
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  aria-label={dict.removeLabel.replace("{n}", n)}
                  className={BUTTON}
                >
                  {dict.removeCta}
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>

      {rows.length > 0 ? (
        <fieldset className="mt-4 flex flex-col gap-2" disabled={pending}>
          <legend className="text-sm font-medium">{dict.featuredLegend}</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${baseId}-featured`}
              checked={featuredKey === null}
              onChange={() => setFeaturedKey(null)}
              className="size-5"
            />
            {dict.noFeatureLabel}
          </label>
          {rows.map((row, index) => (
            <label key={row.key} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${baseId}-featured`}
                checked={featuredKey === row.key}
                onChange={() => setFeaturedKey(row.key)}
                className="size-5"
              />
              {row.label.trim() || dict.rowLegend.replace("{n}", String(index + 1))}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {rows.length < MAX_TOUR_LINKS ? (
          <button type="button" onClick={addRow} disabled={pending} className={BUTTON}>
            {dict.addCta}
          </button>
        ) : null}
        <button type="button" onClick={save} disabled={pending} className={BUTTON}>
          {pending ? dict.savingLabel : dict.saveCta}
        </button>
      </div>

      <div role="status" aria-live="polite">
        {status === "saved" ? <p className="mt-2 text-sm">{dict.savedLabel}</p> : null}
      </div>
      {status === "incomplete" || status === "error" ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {status === "incomplete" ? dict.incompleteError : dict.genericError}
        </p>
      ) : null}
    </section>
  );
}
