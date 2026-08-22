"use client";

import { useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { MediaLibraryRow } from "./media-library-row";
import {
  Pager,
  usePagedOptions,
  type PickerChromeDict,
} from "./media-picker-chrome";
import { bulkAddTags, bulkDeleteMedia, bulkRemoveTags } from "@/lib/actions/media";
import { parseTagEntry } from "@/lib/tags";
import { bulkAssignMediaToDestination } from "@/lib/actions/destination-media";
import type { UploadKind } from "@/lib/cloudinary-urls";
import type { Locale } from "@/lib/locales";
import type { MissingTranscriptDict } from "./missing-transcript-notice";

export type MediaRow = {
  id: string;
  kind: UploadKind;
  status: "uploading" | "processing" | "ready" | "failed" | "deleted";
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  displayName: string | null;
  description: string | null;
  tags: string[];
  transcriptMediaId: string | null;
  fallbackName: string | null;
  createdAt: Date;
  /** Version token. Used as part of the row key so a row that changed on the
   *  server remounts and drops stale editor state — see plans/bugs/21. */
  updatedAt: Date;
};

export type TranscriptOption = {
  id: string;
  displayName: string | null;
};

export type MediaLibraryDict = {
  title: string;
  emptyState: string;
  noResults: string;
  searchPlaceholder: string;
  statusLabel: string;
  kindLabel: string;
  sizeLabel: string;
  createdLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  originalFilenameLabel: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  editCta: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  deleteCta: string;
  deletingLabel: string;
  tagsLabel: string;
  tagsPlaceholder: string;
  kindEditLabel: string;
  kindEditHelp: string;
  filterByTagLabel: string;
  allTagsLabel: string;
  transcriptLabel: string;
  transcriptNoneLabel: string;
  transcriptEmpty: string;
  transcriptMissingWarning: string;
  noTranscriptNotice: MissingTranscriptDict;
  softDeletePrompt: string;
  hardDeletePrompt: string;
  inUseHeading: string;
  inUseScene: string;
  usedAs: Record<"panorama" | "poster" | "sound", string>;
  inUseSceneConnected: string;
  connectionOut: string;
  connectionIn: string;
  openConnectionsCta: string;
  deleteSceneCta: string;
  sceneDeletedNotice: string;
  dismissNoticeCta: string;
  deletedWithSceneNotice: string;
  inUseBody: string;
  genericError: string;
  bulkSelectLabel: string;
  bulkSelectAllLabel: string;
  bulkClearLabel: string;
  bulkSelectionLabel: string;
  bulkTagsLabel: string;
  bulkTagsPlaceholder: string;
  tagSuggestionsLabel: string;
  bulkApplyCta: string;
  bulkApplyingLabel: string;
  bulkAppliedLabel: string;
  bulkRemoveTagAria: string;
  destinationFilterLabel: string;
  allDestinationsLabel: string;
  unassignedLabel: string;
  bulkAssignLabel: string;
  bulkAssignSelectLabel: string;
  bulkAssignCta: string;
  bulkAssigningLabel: string;
  bulkAssignedLabel: string;
  bulkAssignSkippedLabel: string;
  bulkRemoveTagsCta: string;
  bulkRemovingLabel: string;
  bulkRemovedLabel: string;
  bulkDeleteCta: string;
  bulkDeleteConfirmTitle: string;
  bulkDeleteConfirmBody: string;
  bulkDeleteConfirmCta: string;
  bulkDeleteCancelCta: string;
  bulkDeletingLabel: string;
  bulkDeletedLabel: string;
  bulkDeleteBlockedLabel: string;
  bulkDeleteSkippedLabel: string;
  bulkDeleteFailed: string;
  autoAssignCta: string;
  autoAssignHelp: string;
  autoAssignDoneLabel: string;
  autoAssignNoneLabel: string;
  statuses: Record<MediaRow["status"], string>;
  kinds: Record<UploadKind, string>;
  preview: {
    openCta: string;
    closeCta: string;
    unavailableTitle: string;
    unavailableBody: string;
    transcriptPreviewHint: string;
  };
};

export type DestinationOption = {
  id: string;
  name: string;
};

export function MediaLibrary({
  rows,
  dict,
  chromeDict,
  lang,
  searchActive = false,
  transcriptOptions,
  destinations,
  knownTags,
}: {
  rows: MediaRow[];
  dict: MediaLibraryDict;
  chromeDict: PickerChromeDict;
  lang: Locale;
  searchActive?: boolean;
  transcriptOptions: TranscriptOption[];
  /** When provided, the bulk toolbar offers "add selected to a tour". */
  destinations?: DestinationOption[];
  /** Distinct existing tags across the owner's media, for suggestions. */
  knownTags?: string[];
}) {
  const router = useRouter();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const suggestionsRef = useRef<HTMLUListElement>(null);
  // Two-step, because this one destroys work. The confirm carries the count so
  // the question names what is about to happen rather than asking "are you
  // sure?" about nothing in particular.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<number | null>(null);
  const [assignDestinationId, setAssignDestinationId] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<{ count: number; skipped: number; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  // Survives a row unmounting. Deleting a file removes its row, so a message
  // rendered inside that row disappears at the exact moment it matters most.
  const [rowNotice, setRowNotice] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const row of rows) {
      for (const tag of row.tags) tagSet.add(tag);
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = activeTag
    ? rows.filter((row) => row.tags.includes(activeTag))
    : rows;

  // 24 rather than the picker default: this page IS the library, so a bigger
  // page means less paging, and the rows are compact text rows rather than a
  // thumbnail grid.
  const paged = usePagedOptions({ options: filteredRows, pageSize: 24, initiallyOpen: true });

  // "Select all visible" now means the current page, which is the only honest
  // reading once the list is paged -- and it stops one click from silently
  // selecting every file in the library.
  const visibleSelectableIds = paged.pageItems.map((r) => r.id);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selectedIds.has(id));

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkSuccess(null);
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const id of visibleSelectableIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of visibleSelectableIds) next.add(id);
      return next;
    });
    setBulkSuccess(null);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setPendingTags([]);
    setTagInput("");
    setBulkError(null);
    setBulkSuccess(null);
    setAssignError(null);
    setAssignSuccess(null);
  }

  function applyAssign() {
    const ids = Array.from(selectedIds);
    const destination = (destinations ?? []).find((d) => d.id === assignDestinationId);
    if (ids.length === 0 || !destination) return;
    setAssignError(null);
    setAssignSuccess(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("destinationId", destination.id);
      formData.set("mediaAssetIds", JSON.stringify(ids));
      formData.set("lang", lang);
      const result = await bulkAssignMediaToDestination(formData);
      if (!result.ok) {
        setAssignError(result.error);
        return;
      }
      // Keep the selection so the toolbar (and this success message)
      // stays mounted — clearing it would unmount the region before
      // the user reads the confirmation.
      setAssignSuccess({
        count: result.data.assigned,
        skipped: result.data.skipped,
        name: destination.name,
      });
      router.refresh();
    });
  }

  function commitTagInput() {
    const raw = tagInput.trim();
    if (!raw) return;
    // Canonicalised against the vocabulary that already exists, so typing
    // "ghana" and pressing Enter yields the existing "Ghana" rather than a
    // second tag that sorts elsewhere and splits every future search.
    // Prefixes are deliberately NOT expanded — see canonicaliseTag.
    const pieces = parseTagEntry(raw, knownTags ?? []);
    if (pieces.length === 0) return;
    setPendingTags((prev) => {
      const seen = new Set(prev.map((t) => t.toLowerCase()));
      const next = [...prev];
      for (const p of pieces) {
        const key = p.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(p);
      }
      return next;
    });
    setTagInput("");
    setBulkError(null);
  }

  function onTagKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitTagInput();
    } else if (event.key === "Backspace" && tagInput === "" && pendingTags.length > 0) {
      setPendingTags((prev) => prev.slice(0, -1));
    }
  }

  function removeChip(tag: string) {
    setPendingTags((prev) => prev.filter((t) => t !== tag));
  }

  function applyRemoveTags() {
    const ids = Array.from(selectedIds);
    const tags = [...pendingTags, ...parseTagEntry(tagInput, knownTags ?? [])];
    if (ids.length === 0 || tags.length === 0) return;
    setBulkError(null);
    setBulkNotice(null);
    startTransition(async () => {
      const result = await bulkRemoveTags({ ids, removeTags: tags, lang });
      if (!result.ok) {
        setBulkError(result.error);
        return;
      }
      setBulkNotice(dict.bulkRemovedLabel.replace("{count}", String(result.data.updated)));
      setPendingTags([]);
      setTagInput("");
      router.refresh();
    });
  }

  function applyBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkError(null);
    setBulkNotice(null);
    startTransition(async () => {
      const result = await bulkDeleteMedia({ ids, lang });
      if (!result.ok) {
        setBulkError(dict.bulkDeleteFailed);
        return;
      }
      const { deleted, blocked, skipped } = result.data;
      // Every outcome is reported. A result that says only how many succeeded
      // leaves the creator guessing which ones did not.
      const parts = [dict.bulkDeletedLabel.replace("{count}", String(deleted.length))];
      if (blocked.length > 0) {
        parts.push(dict.bulkDeleteBlockedLabel.replace("{count}", String(blocked.length)));
      }
      if (skipped.length > 0) {
        parts.push(dict.bulkDeleteSkippedLabel.replace("{count}", String(skipped.length)));
      }
      setBulkNotice(parts.join(" "));
      setConfirmDelete(false);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  function applyBulk() {
    const ids = Array.from(selectedIds);
    // Text still sitting in the box when Apply is pressed counts — losing what
    // someone typed would be its own bug — but it goes through the same
    // canonicalisation as a committed chip, so Apply cannot mint a
    // near-duplicate of a tag that already exists.
    const trailing = parseTagEntry(tagInput, knownTags ?? []);
    const finalTags = trailing.length
      ? Array.from(
          new Map(
            [...pendingTags, ...trailing].map((t) => [t.toLowerCase(), t] as const),
          ).values(),
        )
      : pendingTags;
    if (ids.length === 0 || finalTags.length === 0) return;
    setBulkError(null);
    setBulkSuccess(null);
    startTransition(async () => {
      const result = await bulkAddTags({ ids, addTags: finalTags, lang });
      if (!result.ok) {
        setBulkError(result.error);
        return;
      }
      setBulkSuccess(result.data.updated);
      setPendingTags([]);
      setTagInput("");
      setSelectedIds(new Set());
    });
  }

  if (rows.length === 0) {
    return (
      <section aria-labelledby="media-library-heading" className="flex flex-col gap-4">
        <h2 id="media-library-heading" className="text-xl font-semibold">
          {dict.title}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {searchActive ? dict.noResults : dict.emptyState}
        </p>
      </section>
    );
  }

  const hasTrailingInput = tagInput.trim().length > 0;
  const canApply =
    selectedIds.size > 0 && (pendingTags.length > 0 || hasTrailingInput) && !isPending;

  return (
    <section aria-labelledby="media-library-heading" className="flex flex-col gap-4">
      <h2 id="media-library-heading" className="text-xl font-semibold">
        {dict.title}
      </h2>

      {allTags.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {dict.filterByTagLabel}
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={dict.filterByTagLabel}>
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                activeTag === null
                  ? "bg-foreground text-background"
                  : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
              }`}
            >
              {dict.allTagsLabel}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                  activeTag === tag
                    ? "bg-foreground text-background"
                    : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-b border-black/10 pb-3 dark:border-white/15">
        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="h-4 w-4"
          />
          {dict.bulkSelectAllLabel}
        </label>
        <span aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          {dict.bulkSelectionLabel.replace("{count}", String(selectedIds.size))}
        </span>
        {selectedIds.size > 0 ? (
          <button
            type="button"
            onClick={clearSelection}
            className="min-h-9 rounded border border-black/15 px-3 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            {dict.bulkClearLabel}
          </button>
        ) : null}
      </div>

      {selectedIds.size > 0 && destinations && destinations.length > 0 ? (
        <div
          role="region"
          aria-label={dict.bulkAssignLabel}
          className="flex flex-col gap-2 rounded-md border border-black/15 bg-background/95 p-3 shadow-sm backdrop-blur dark:border-white/20"
        >
          <label htmlFor="bulk-assign-destination" className="text-sm font-medium">
            {dict.bulkAssignLabel}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="bulk-assign-destination"
              value={assignDestinationId}
              onChange={(e) => {
                setAssignDestinationId(e.target.value);
                setAssignSuccess(null);
              }}
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
            >
              <option value="">{dict.bulkAssignSelectLabel}</option>
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyAssign}
              disabled={isPending || !assignDestinationId}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {isPending ? dict.bulkAssigningLabel : dict.bulkAssignCta}
            </button>
            {assignError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {assignError}
              </p>
            ) : null}
            {assignSuccess !== null ? (
              <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                {dict.bulkAssignedLabel
                  .replace("{count}", String(assignSuccess.count))
                  .replace("{name}", assignSuccess.name)}
                {assignSuccess.skipped > 0
                  ? ` ${dict.bulkAssignSkippedLabel.replace("{count}", String(assignSuccess.skipped))}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedIds.size > 0 ? (
        <div
          role="region"
          aria-label={dict.bulkTagsLabel}
          className="sticky top-2 z-10 flex flex-col gap-2 rounded-md border border-black/15 bg-background/95 p-3 shadow-sm backdrop-blur dark:border-white/20"
        >
          <label htmlFor="bulk-tag-input" className="text-sm font-medium">
            {dict.bulkTagsLabel}
          </label>
          <div className="flex flex-wrap items-center gap-2 rounded border border-black/15 px-2 py-1 dark:border-white/20">
            {pendingTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-sm dark:bg-white/10"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeChip(tag)}
                  aria-label={dict.bulkRemoveTagAria.replace("{tag}", tag)}
                  className="text-zinc-500 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="bulk-tag-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={(event) => {
                // Do NOT commit if focus is moving into the suggestion list.
                //
                // This is the bug BAM hit: type "Gha", click "Ghana", get
                // "Gha". Blur fires BEFORE click, so committing here wrote the
                // half-typed token as a chip and emptied the input — which
                // made `tagInput.trim().length > 0` false and unmounted the
                // suggestion list before the click could ever land. The
                // canonical tag was never applied, and nothing errored.
                //
                // relatedTarget is the element receiving focus, which covers
                // tabbing to a suggestion. Mouse clicks are handled by the
                // preventDefault on the suggestion's onMouseDown, because a
                // mousedown-driven blur reports relatedTarget as null in some
                // browsers.
                if (
                  event.relatedTarget instanceof Node &&
                  suggestionsRef.current?.contains(event.relatedTarget)
                ) {
                  return;
                }
                commitTagInput();
              }}
              placeholder={dict.bulkTagsPlaceholder}
              className="min-h-9 min-w-32 flex-1 bg-transparent px-1 text-base outline-none"
            />
          </div>
          {/* Suggestions for the token being typed: clicking one commits the
              CANONICAL spelling as a chip, steering everyone onto existing
              tags instead of minting near-duplicates. */}
          {tagInput.trim().length > 0 ? (
            <ul
              ref={suggestionsRef}
              className="flex flex-wrap gap-1"
              aria-label={dict.tagSuggestionsLabel}
            >
              {(knownTags ?? [])
                .filter((t: string) => {
                  const needle = tagInput.trim().toLowerCase();
                  const have = new Set(pendingTags.map((x) => x.toLowerCase()));
                  return t.toLowerCase().includes(needle) && !have.has(t.toLowerCase());
                })
                .slice(0, 8)
                .map((tag: string) => (
                  <li key={tag}>
                    <button
                      type="button"
                      // Keeps focus in the input, so no blur fires and the
                      // list survives long enough for onClick to run.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setTagInput(tag);
                        // Reuse the exact commit path the Enter key uses.
                        setPendingTags((prev) => {
                          const seen = new Set(prev.map((x) => x.toLowerCase()));
                          return seen.has(tag.toLowerCase()) ? prev : [...prev, tag];
                        });
                        setTagInput("");
                      }}
                      className="inline-flex min-h-9 items-center rounded-full bg-black/5 px-3 text-sm hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-white/10 dark:hover:bg-white/15"
                    >
                      {tag}
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={applyBulk}
              disabled={!canApply}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {isPending ? dict.bulkApplyingLabel : dict.bulkApplyCta}
            </button>

            {/* The counterpart to adding. Same inputs, opposite direction —
                so a mis-applied bulk tag can be undone the same way it was
                made, rather than file by file. */}
            <button
              type="button"
              onClick={applyRemoveTags}
              disabled={!canApply}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/20 px-4 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/25 dark:hover:bg-white/10"
            >
              {isPending ? dict.bulkRemovingLabel : dict.bulkRemoveTagsCta}
            </button>

            {/* Destructive, so it is two steps and visually separated from the
                tag actions it sits beside. */}
            {confirmDelete ? (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-md border-2 border-red-600 px-3 py-2 dark:border-red-400">
                <span className="text-sm font-semibold">
                  {dict.bulkDeleteConfirmTitle.replace("{count}", String(selectedIds.size))}
                </span>
                <span className="text-sm text-muted">{dict.bulkDeleteConfirmBody}</span>
                <button
                  type="button"
                  onClick={applyBulkDelete}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center rounded-md bg-red-700 px-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
                >
                  {isPending ? dict.bulkDeletingLabel : dict.bulkDeleteConfirmCta}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex min-h-11 items-center rounded-md border border-black/20 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/25 dark:hover:bg-white/10"
                >
                  {dict.bulkDeleteCancelCta}
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={selectedIds.size === 0 || isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-600 px-4 text-base font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {dict.bulkDeleteCta}
              </button>
            )}
            {bulkError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {bulkError}
              </p>
            ) : null}
            {bulkNotice ? (
              <p role="status" className="text-sm">
                {bulkNotice}
              </p>
            ) : null}
            {bulkSuccess !== null ? (
              <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                {dict.bulkAppliedLabel.replace("{count}", String(bulkSuccess))}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {filteredRows.length} {filteredRows.length === 1 ? "file" : "files"}
      </div>

      {rowNotice ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-300"
        >
          {rowNotice}
          <button
            type="button"
            onClick={() => setRowNotice(null)}
            className="ml-auto inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.dismissNoticeCta}
          </button>
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paged.pageItems.map((row) => {
          const checked = selectedIds.has(row.id);
          return (
            <li key={row.id} className="relative">
              <label
                className="absolute left-3 top-3 z-10 inline-flex cursor-pointer items-center gap-1 rounded bg-background/90 px-1.5 py-1 text-xs font-medium shadow-sm backdrop-blur"
                aria-label={dict.bulkSelectLabel}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRow(row.id)}
                  className="h-4 w-4"
                />
                <span className="sr-only">{dict.bulkSelectLabel}</span>
              </label>
              <MediaLibraryRow
                // Keyed on updatedAt, not just id. MediaLibraryRow seeds its editor
                // state with useState(row.…), which only runs on mount. Without this
                // a row edited elsewhere (bulk tagging) kept its stale tag string and
                // silently wrote it back over the new tags on the next save.
                key={`${row.id}-${row.updatedAt.getTime()}`}
                row={row}
                dict={dict}
                lang={lang}
                onNotice={setRowNotice}
                transcriptOptions={transcriptOptions}
                knownTags={knownTags ?? []}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <Pager
          page={paged.page}
          totalPages={paged.totalPages}
          from={paged.from}
          to={paged.to}
          total={paged.total}
          setPage={paged.setPage}
          dict={chromeDict}
        />
      </div>
    </section>
  );
}
