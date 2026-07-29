"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import type { HelpAudience } from "@/lib/help-articles";

export interface HelpSearchEntry {
  slug: string;
  shortTitle: string;
  title: string;
  summary: string;
  audience: HelpAudience;
  /** Lowercased short title + title + summary + steps, precomputed server-side. */
  haystack: string;
}

export interface HelpSearchLabels {
  searchLabel: string;
  searchPlaceholder: string;
  resultCountOne: string;
  resultCountMany: string;
  noResults: string;
  audienceLabels: Record<HelpAudience, string>;
}

const AUDIENCE_ORDER: HelpAudience[] = ["creator", "partner", "learner"];

/**
 * Client-side searchable list of Help Center articles, grouped by audience.
 * Case-insensitive substring filter over title + summary + steps.
 */
export function HelpSearch({
  lang,
  entries,
  labels,
}: {
  lang: string;
  entries: HelpSearchEntry[];
  labels: HelpSearchLabels;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? entries.filter((e) => e.haystack.includes(q))
      : entries;
    return AUDIENCE_ORDER.map((audience) => ({
      audience,
      articles: matched.filter((e) => e.audience === audience),
    })).filter((g) => g.articles.length > 0);
  }, [entries, query]);

  const count = groups.reduce((n, g) => n + g.articles.length, 0);
  const countText =
    count === 1
      ? labels.resultCountOne
      : labels.resultCountMany.replace("{count}", String(count));

  return (
    <div>
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="sr-only">
          {labels.searchLabel}
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className="min-h-11 w-full rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
      >
        {countText}
      </p>

      {count === 0 ? (
        <p className="mt-8 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {labels.noResults}
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.audience}>
              <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {labels.audienceLabels[group.audience]}
              </h2>
              <ul className="mt-4 flex flex-col gap-4">
                {group.articles.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/${lang}/help/${article.slug}`}
                      className="flex min-h-11 flex-col gap-2 rounded-lg border border-black/10 p-5 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:bg-white/5"
                    >
                      {/* Short label leads. It is what someone scanning the list reads
                          first, and what they searched for. The descriptive title
                          becomes the second line rather than disappearing — it still
                          says what the article actually covers. */}
                      <span className="text-lg font-semibold">
                        {article.shortTitle}
                      </span>
                      <span className="text-base font-medium text-zinc-700 dark:text-zinc-200">
                        {article.title}
                      </span>
                      <span className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
                        {article.summary}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
