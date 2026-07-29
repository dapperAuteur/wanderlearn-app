"use client";

import { useId, useMemo, useState } from "react";

/**
 * Comma-separated tag input with suggestions from the owner's existing tags.
 *
 * A native <datalist> cannot re-trigger per comma-separated token, so this
 * renders filtered suggestion BUTTONS under the field instead: as the user
 * types the current token, matching existing tags appear and a click (or
 * Tab+Enter — they are real buttons) appends the canonical spelling. That is
 * the whole point per BAM's ask: steer people onto existing tags instead of
 * minting "chocolate" next to "Chocolate" next to "chocolates".
 *
 * Purely additive around a plain input: keyboard users can ignore the
 * suggestions entirely and keep typing, and the value stays a normal
 * comma-separated string for the existing parseTags server path.
 */
export function TagInput({
  id,
  value,
  onChange,
  knownTags,
  placeholder,
  suggestionsLabel,
  className,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  knownTags: string[];
  placeholder?: string;
  suggestionsLabel: string;
  className?: string;
}) {
  const listId = useId();
  const [focused, setFocused] = useState(false);

  // Current token = text after the last comma; committed = everything before.
  const lastComma = value.lastIndexOf(",");
  const committed = lastComma >= 0 ? value.slice(0, lastComma + 1) : "";
  const currentToken = (lastComma >= 0 ? value.slice(lastComma + 1) : value).trim();

  const suggestions = useMemo(() => {
    if (currentToken.length === 0) return [];
    const needle = currentToken.toLowerCase();
    const already = new Set(
      value
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    );
    return knownTags
      .filter((t) => t.toLowerCase().includes(needle) && !already.has(t.toLowerCase()))
      .slice(0, 8);
  }, [currentToken, knownTags, value]);

  function applySuggestion(tag: string) {
    onChange(`${committed}${committed ? " " : ""}${tag}, `);
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        // Delayed so a click on a suggestion button lands before the list hides.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        maxLength={500}
        aria-describedby={suggestions.length > 0 ? listId : undefined}
        className={
          className ??
          "min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        }
      />
      {focused && suggestions.length > 0 ? (
        <div id={listId} role="group" aria-label={suggestionsLabel}>
          <span className="sr-only">{suggestionsLabel}</span>
          <ul className="flex flex-wrap gap-1">
            {suggestions.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => applySuggestion(tag)}
                  className="inline-flex min-h-9 items-center rounded-full bg-black/5 px-3 text-sm hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-white/10 dark:hover:bg-white/15"
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
