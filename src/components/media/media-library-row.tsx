"use client";

import Image from "next/image";
import { useId, useState, useTransition } from "react";
import { posterUrlFor } from "@/lib/cloudinary-urls";
import type { Locale } from "@/lib/locales";
import { deleteMedia, linkTranscript, updateMedia, type MediaBlocker } from "@/lib/actions/media";
import type { MediaLibraryDict, MediaRow, TranscriptOption } from "./media-library";

const VIDEO_KINDS = new Set([
  "standard_video",
  "video_360",
  "drone_video",
  "screen_recording",
]);

type DeleteState =
  | { kind: "idle" }
  | { kind: "confirming_soft" }
  | { kind: "confirming_hard" }
  | { kind: "blocked"; blockers: MediaBlocker[] }
  | { kind: "error"; message: string };

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MediaLibraryRow({
  row,
  dict,
  lang,
  transcriptOptions,
}: {
  row: MediaRow;
  dict: MediaLibraryDict;
  lang: Locale;
  transcriptOptions: TranscriptOption[];
}) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.displayName ?? "");
  const [description, setDescription] = useState(row.description ?? "");
  const [tagInput, setTagInput] = useState(row.tags.join(", "));
  const [transcriptSelection, setTranscriptSelection] = useState<string>(
    row.transcriptMediaId ?? "",
  );
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isVideo = VIDEO_KINDS.has(row.kind);
  const linkedTranscript = transcriptOptions.find((t) => t.id === row.transcriptMediaId) ?? null;
  const transcriptMissing = isVideo && row.transcriptMediaId !== null && linkedTranscript === null;
  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const thumb =
    row.status === "ready" && row.cloudinaryPublicId
      ? posterUrlFor(row.kind, row.cloudinaryPublicId, 480)
      : null;

  const displayedName = row.displayName ?? row.fallbackName ?? dict.namePlaceholder;

  function onSave() {
    setSaveError(null);
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("displayName", name);
    fd.set("description", description);
    fd.set("tags", tagInput);
    fd.set("lang", lang);
    startTransition(async () => {
      const result = await updateMedia(fd);
      if (!result.ok) {
        setSaveError(dict.genericError);
        return;
      }
      setEditing(false);
    });
  }

  function onCancel() {
    setName(row.displayName ?? "");
    setDescription(row.description ?? "");
    setTagInput(row.tags.join(", "));
    setSaveError(null);
    setEditing(false);
  }

  function onTranscriptChange(newId: string) {
    setTranscriptSelection(newId);
    setTranscriptError(null);
    const fd = new FormData();
    fd.set("videoId", row.id);
    fd.set("transcriptId", newId);
    fd.set("lang", lang);
    startTransition(async () => {
      const result = await linkTranscript(fd);
      if (!result.ok) {
        setTranscriptError(dict.genericError);
        setTranscriptSelection(row.transcriptMediaId ?? "");
      }
    });
  }

  function runDelete(hardDelete: boolean) {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("hardDelete", hardDelete ? "1" : "0");
    fd.set("lang", lang);
    startTransition(async () => {
      const result = await deleteMedia(fd);
      if (result.ok) {
        setDeleteState({ kind: "idle" });
        return;
      }
      if (result.code === "in_use" && "blockers" in result && result.blockers) {
        setDeleteState({ kind: "blocked", blockers: result.blockers });
        return;
      }
      setDeleteState({ kind: "error", message: dict.genericError });
    });
  }

  const busy = isPending;
  const statusId = `${fieldId}-status`;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-black/10 p-3 dark:border-white/15">
      {thumb ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black/5 dark:bg-white/5">
          <Image
            src={thumb}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div
          className="flex aspect-video w-full items-center justify-center rounded-md bg-black/5 text-xs text-zinc-500 dark:bg-white/5"
          aria-hidden="true"
        >
          {dict.statuses[row.status]}
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${fieldId}-name`} className="text-sm font-medium">
            {dict.nameLabel}
          </label>
          <input
            id={`${fieldId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={dict.namePlaceholder}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
            maxLength={200}
          />
          <label htmlFor={`${fieldId}-desc`} className="text-sm font-medium">
            {dict.descriptionLabel}
          </label>
          <textarea
            id={`${fieldId}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={dict.descriptionPlaceholder}
            rows={3}
            className="min-h-24 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
            maxLength={1000}
          />
          <label htmlFor={`${fieldId}-tags`} className="text-sm font-medium">
            {dict.tagsLabel}
          </label>
          <input
            id={`${fieldId}-tags`}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder={dict.tagsPlaceholder}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {busy ? dict.savingLabel : dict.saveCta}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.cancelCta}
            </button>
          </div>
          {saveError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {saveError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold wrap-break-word">{displayedName}</p>
          {row.description ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{row.description}</p>
          ) : null}
          {row.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {row.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-700 dark:bg-white/10 dark:text-zinc-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-zinc-500">{dict.kindLabel}</dt>
        <dd>{dict.kinds[row.kind]}</dd>
        <dt className="text-zinc-500">{dict.statusLabel}</dt>
        <dd>{dict.statuses[row.status]}</dd>
        <dt className="text-zinc-500">{dict.sizeLabel}</dt>
        <dd>{formatSize(row.sizeBytes)}</dd>
        <dt className="text-zinc-500">{dict.createdLabel}</dt>
        <dd>{row.createdAt.toLocaleDateString()}</dd>
      </dl>

      {isVideo && !editing ? (
        <div className="flex flex-col gap-1 border-t border-black/5 pt-2 dark:border-white/10">
          <label htmlFor={`${fieldId}-transcript`} className="text-sm font-medium">
            {dict.transcriptLabel}
          </label>
          {transcriptOptions.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{dict.transcriptEmpty}</p>
          ) : (
            <select
              id={`${fieldId}-transcript`}
              value={transcriptSelection}
              onChange={(e) => onTranscriptChange(e.target.value)}
              disabled={isPending}
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base disabled:opacity-60 dark:border-white/20"
            >
              <option value="">{dict.transcriptNoneLabel}</option>
              {transcriptOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName ?? t.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
          {transcriptMissing ? (
            <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
              {dict.transcriptMissingWarning}
            </p>
          ) : null}
          {transcriptError ? (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {transcriptError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!editing ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.editCta}
          </button>
          <button
            type="button"
            onClick={() => setDeleteState({ kind: "confirming_soft" })}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-600/30 px-4 text-sm font-semibold text-red-700 hover:bg-red-600/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-400/10"
          >
            {dict.deleteCta}
          </button>
        </div>
      ) : null}

      <div id={statusId} aria-live="polite" className="min-h-0">
        {deleteState.kind === "confirming_soft" ? (
          <div className="mt-2 flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <p>{dict.softDeletePrompt}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runDelete(false)}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
              >
                {busy ? dict.deletingLabel : dict.deleteCta}
              </button>
              <button
                type="button"
                onClick={() => setDeleteState({ kind: "confirming_hard" })}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-600/40 px-4 text-sm font-semibold text-red-700 hover:bg-red-600/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-red-400/40 dark:text-red-300"
              >
                {dict.hardDeletePrompt}
              </button>
              <button
                type="button"
                onClick={() => setDeleteState({ kind: "idle" })}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
              >
                {dict.cancelCta}
              </button>
            </div>
          </div>
        ) : null}

        {deleteState.kind === "confirming_hard" ? (
          <div className="mt-2 flex flex-col gap-2 rounded-md border border-red-600/40 bg-red-600/10 p-3 text-sm">
            <p>{dict.hardDeletePrompt}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runDelete(true)}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
              >
                {busy ? dict.deletingLabel : dict.deleteCta}
              </button>
              <button
                type="button"
                onClick={() => setDeleteState({ kind: "idle" })}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
              >
                {dict.cancelCta}
              </button>
            </div>
          </div>
        ) : null}

        {deleteState.kind === "blocked" ? (
          <div
            role="alert"
            className="mt-2 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            <p className="font-semibold">{dict.inUseHeading}</p>
            <p>{dict.inUseBody}</p>
            <ul className="list-disc pl-5">
              {deleteState.blockers.map((b) => (
                <li key={`${b.type}:${b.id}`}>
                  <span className="text-zinc-500">{b.type}:</span> {b.name}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setDeleteState({ kind: "idle" })}
              className="self-start inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.cancelCta}
            </button>
          </div>
        ) : null}

        {deleteState.kind === "error" ? (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {deleteState.message}
          </p>
        ) : null}
      </div>
    </li>
  );
}
