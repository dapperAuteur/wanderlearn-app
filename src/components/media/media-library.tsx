"use client";

import { useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { MediaLibraryRow } from "./media-library-row";
import { bulkAddTags } from "@/lib/actions/media";
import type { UploadKind } from "@/lib/cloudinary-urls";
import type { Locale } from "@/lib/locales";

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
  filterByTagLabel: string;
  allTagsLabel: string;
  transcriptLabel: string;
  transcriptNoneLabel: string;
  transcriptEmpty: string;
  transcriptMissingWarning: string;
  softDeletePrompt: string;
  hardDeletePrompt: string;
  inUseHeading: string;
  inUseBody: string;
  genericError: string;
  bulkSelectLabel: string;
  bulkSelectAllLabel: string;
  bulkClearLabel: string;
  bulkSelectionLabel: string;
  bulkTagsLabel: string;
  bulkTagsPlaceholder: string;
  bulkApplyCta: string;
  bulkApplyingLabel: string;
  bulkAppliedLabel: string;
  bulkRemoveTagAria: string;
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

export function MediaLibrary({
  rows,
  dict,
  lang,
  searchActive = false,
  transcriptOptions,
}: {
  rows: MediaRow[];
  dict: MediaLibraryDict;
  lang: Locale;
  searchActive?: boolean;
  transcriptOptions: TranscriptOption[];
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const visibleSelectableIds = filteredRows.map((r) => r.id);
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
  }

  function commitTagInput() {
    const raw = tagInput.trim();
    if (!raw) return;
    const pieces = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
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

  function applyBulk() {
    const ids = Array.from(selectedIds);
    const trailing = tagInput.trim();
    const finalTags = trailing
      ? Array.from(
          new Set(
            [...pendingTags, ...trailing.split(",").map((p) => p.trim()).filter(Boolean)].map(
              (t) => t,
            ),
          ),
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
              onBlur={commitTagInput}
              placeholder={dict.bulkTagsPlaceholder}
              className="min-h-9 min-w-32 flex-1 bg-transparent px-1 text-base outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={applyBulk}
              disabled={!canApply}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {isPending ? dict.bulkApplyingLabel : dict.bulkApplyCta}
            </button>
            {bulkError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {bulkError}
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

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRows.map((row) => {
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
                row={row}
                dict={dict}
                lang={lang}
                transcriptOptions={transcriptOptions}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
