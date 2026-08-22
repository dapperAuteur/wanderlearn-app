"use client";

import { useId, useState } from "react";
import { savePlaceMark } from "@/lib/actions/place-marks";

type Place = { osmId: string; displayName: string; lat: number; lng: number };

export type AddPlaceDict = Record<
  | "heading" | "intro" | "searchLabel" | "searchPlaceholder" | "searchButton" | "searching"
  | "noResults" | "rateLimited" | "searchFailed" | "resultsLabel" | "chooseLabel" | "chosenLabel"
  | "wantsToGoLabel" | "visitedLabel" | "visitedOnLabel" | "visibilityLegend"
  | "visibilityPrivate" | "visibilityPublic" | "selfDeclaredNote" | "saveButton" | "saving"
  | "saved" | "saveFailed" | "needsOneFlag" | "attributionPrefix",
  string
>;

/**
 * Add a self-declared place to the passport.
 *
 * SEARCH-ON-SUBMIT, NOT TYPE-AHEAD — and this is not a UX preference. The OSM
 * usage policy states plainly that "autocomplete is strictly forbidden", and
 * caps the entire API at one request per second. Wiring this to a keystroke
 * handler would violate the policy and burn the shared limit in seconds. If
 * you are tempted to make it feel snappier by searching as the user types:
 * don't. The fix is self-hosting or a commercial provider, not a debounce.
 *
 * The visibility choice is presented at the moment of adding rather than
 * buried in a settings page, because "only me" is the default and someone
 * choosing to share should do it deliberately.
 */
export function AddPlace({ dict, attribution }: { dict: AddPlaceDict; attribution: string }) {
  const formId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [chosen, setChosen] = useState<Place | null>(null);
  const [status, setStatus] = useState<
    "idle" | "searching" | "saving" | "saved" | "no_results" | "rate_limited" | "search_failed" | "save_failed" | "needs_flag"
  >("idle");
  const [wantsToGo, setWantsToGo] = useState(false);
  const [visited, setVisited] = useState(false);
  const [visitedOn, setVisitedOn] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  async function onSearch(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setStatus("searching");
    setResults(null);
    setChosen(null);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
      if (res.status === 429) return setStatus("rate_limited");
      if (!res.ok) return setStatus("search_failed");
      const body = (await res.json()) as { places: Place[] };
      setResults(body.places);
      setStatus(body.places.length === 0 ? "no_results" : "idle");
    } catch {
      setStatus("search_failed");
    }
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen) return;
    if (!wantsToGo && !visited) return setStatus("needs_flag");
    setStatus("saving");
    const result = await savePlaceMark({
      destinationId: null,
      place: chosen,
      wantsToGo,
      visitedInPerson: visited,
      visitedOn: visited && visitedOn ? visitedOn : null,
      isPublic,
    });
    if (!result.ok) return setStatus("save_failed");
    setStatus("saved");
    setChosen(null);
    setResults(null);
    setQuery("");
    setWantsToGo(false);
    setVisited(false);
    setVisitedOn("");
    setIsPublic(false);
  }

  const message =
    status === "no_results" ? dict.noResults
    : status === "rate_limited" ? dict.rateLimited
    : status === "search_failed" ? dict.searchFailed
    : status === "save_failed" ? dict.saveFailed
    : status === "needs_flag" ? dict.needsOneFlag
    : status === "saved" ? dict.saved
    : "";

  return (
    <section className="rounded-lg border border-line p-4 sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight">{dict.heading}</h2>
      <p className="mt-1 text-sm text-muted">{dict.intro}</p>

      <form onSubmit={onSearch} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label htmlFor={`${formId}-q`} className="text-sm font-medium">
            {dict.searchLabel}
          </label>
          <input
            id={`${formId}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.searchPlaceholder}
            className="min-h-11 rounded-md border border-line bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          />
        </div>
        <button
          type="submit"
          disabled={status === "searching" || query.trim().length < 2}
          className="min-h-11 rounded-md border-2 border-brand-text bg-brand px-4 text-sm font-bold text-on-brand disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {status === "searching" ? dict.searching : dict.searchButton}
        </button>
      </form>

      {/* One live region for every outcome. Polite: the visitor pressed a
          button and is already looking at the result. */}
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-muted">
        {message}
      </p>

      {results && results.length > 0 ? (
        <>
          <h3 className="mt-3 text-sm font-medium">{dict.resultsLabel}</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {results.map((place) => {
              const isChosen = chosen?.osmId === place.osmId;
              return (
                <li key={place.osmId}>
                  <button
                    type="button"
                    onClick={() => setChosen(place)}
                    aria-pressed={isChosen}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                      isChosen ? "border-brand-text font-semibold" : "border-line"
                    }`}
                  >
                    {place.displayName}
                    {/* The state is in aria-pressed for assistive tech and in
                        the word here for everyone else — never colour alone. */}
                    {isChosen ? <span className="ml-2 text-xs">({dict.chosenLabel})</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {/* ODbL requires attribution wherever the data is displayed. */}
          <p className="mt-2 text-xs text-muted">
            {dict.attributionPrefix} {attribution}
          </p>
        </>
      ) : null}

      {chosen ? (
        <form onSubmit={onSave} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-sm font-medium">{chosen.displayName}</p>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wantsToGo} onChange={(e) => setWantsToGo(e.target.checked)} className="size-5" />
            {dict.wantsToGoLabel}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={visited} onChange={(e) => setVisited(e.target.checked)} className="size-5" />
            {dict.visitedLabel}
          </label>

          {visited ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${formId}-on`} className="text-sm">
                {dict.visitedOnLabel}
              </label>
              <input
                id={`${formId}-on`}
                type="date"
                value={visitedOn}
                // A visit cannot be in the future; the action rejects it too,
                // but the picker should not offer it in the first place.
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setVisitedOn(e.target.value)}
                className="min-h-11 max-w-[14rem] rounded-md border border-line bg-transparent px-3 text-base"
              />
            </div>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{dict.visibilityLegend}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name={`${formId}-vis`} checked={!isPublic} onChange={() => setIsPublic(false)} className="size-5" />
              {dict.visibilityPrivate}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name={`${formId}-vis`} checked={isPublic} onChange={() => setIsPublic(true)} className="size-5" />
              {dict.visibilityPublic}
            </label>
          </fieldset>

          <p className="text-xs text-muted">{dict.selfDeclaredNote}</p>

          <button
            type="submit"
            disabled={status === "saving"}
            className="min-h-11 self-start rounded-md border-2 border-brand-text bg-brand px-4 text-sm font-bold text-on-brand disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {status === "saving" ? dict.saving : dict.saveButton}
          </button>
        </form>
      ) : null}
    </section>
  );
}
