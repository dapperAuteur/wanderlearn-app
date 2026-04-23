"use client";

import { useMemo, useState } from "react";
import { MediaLibraryRow } from "./media-library-row";
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

      <div aria-live="polite" className="sr-only">
        {filteredRows.length} {filteredRows.length === 1 ? "file" : "files"}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRows.map((row) => (
          <MediaLibraryRow
            key={row.id}
            row={row}
            dict={dict}
            lang={lang}
            transcriptOptions={transcriptOptions}
          />
        ))}
      </ul>
    </section>
  );
}
