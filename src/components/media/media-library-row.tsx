"use client";

import Link from "next/link";
import Image from "next/image";
import { useId, useState, useTransition } from "react";
import { posterUrlFor } from "@/lib/cloudinary-urls";
import { deleteScene } from "@/lib/actions/scenes";
import type { Locale } from "@/lib/locales";
import {
  changeMediaKind,
  deleteMedia,
  linkTranscript,
  updateMedia,
  type MediaBlocker,
} from "@/lib/actions/media";
import { getKindFamily, type ChangeableKind } from "@/lib/media-kind-families";
import type { MediaLibraryDict, MediaRow, TranscriptOption } from "./media-library";
import { MediaPreviewDialog } from "./media-preview-dialog";
import { MissingTranscriptNotice } from "./missing-transcript-notice";
import { TagInput } from "./tag-input";

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
  knownTags,
}: {
  row: MediaRow;
  dict: MediaLibraryDict;
  lang: Locale;
  transcriptOptions: TranscriptOption[];
  knownTags: string[];
}) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  // Seeded with the original filename rather than blank: a name you can edit
  // beats an empty box, and it means "the filename is the default display name"
  // without a migration backfilling every existing row.
  const [name, setName] = useState(row.displayName ?? row.fallbackName ?? "");
  const [description, setDescription] = useState(row.description ?? "");
  const [tagInput, setTagInput] = useState(row.tags.join(", "));
  const [transcriptSelection, setTranscriptSelection] = useState<string>(
    row.transcriptMediaId ?? "",
  );
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [kindError, setKindError] = useState<string | null>(null);
  const kindFamily = getKindFamily(row.kind);
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
    setName(row.displayName ?? row.fallbackName ?? "");
    setDescription(row.description ?? "");
    setTagInput(row.tags.join(", "));
    setSaveError(null);
    setEditing(false);
  }

  function onKindChange(newKind: ChangeableKind) {
    if (newKind === row.kind) return;
    setKindError(null);
    startTransition(async () => {
      const result = await changeMediaKind({ id: row.id, newKind, lang });
      if (!result.ok) {
        setKindError(dict.genericError);
      }
    });
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

  // Removing the blocking scene from here, then retrying the delete, is the
  // whole point of surfacing the blocker: otherwise the message is a dead end.
  function runDeleteScene(sceneId: string, destinationId: string) {
    const fd = new FormData();
    fd.set("id", sceneId);
    fd.set("lang", lang);
    // deleteScene requires it, and scenes.destination_id is nullable, so the
    // button that calls this is gated on the id existing.
    fd.set("destinationId", destinationId);
    startTransition(async () => {
      const result = await deleteScene(fd);
      if (!result.ok) {
        setDeleteState({ kind: "error", message: dict.genericError });
        return;
      }
      setDeleteState({ kind: "idle" });
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
    <article className="flex h-full flex-col gap-3 rounded-lg border border-black/10 p-3 dark:border-white/15">
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
          <TagInput
            id={`${fieldId}-tags`}
            value={tagInput}
            onChange={setTagInput}
            knownTags={knownTags}
            placeholder={dict.tagsPlaceholder}
            suggestionsLabel={dict.tagSuggestionsLabel}
          />
          {kindFamily && kindFamily.length > 1 ? (
            <>
              <label htmlFor={`${fieldId}-kind`} className="text-sm font-medium">
                {dict.kindEditLabel}
              </label>
              <select
                id={`${fieldId}-kind`}
                value={row.kind}
                onChange={(e) => onKindChange(e.target.value as ChangeableKind)}
                disabled={isPending}
                aria-describedby={`${fieldId}-kind-help`}
                className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base disabled:opacity-60 dark:border-white/20"
              >
                {kindFamily.map((k) => (
                  <option key={k} value={k}>
                    {dict.kinds[k]}
                  </option>
                ))}
              </select>
              <p id={`${fieldId}-kind-help`} className="text-xs text-zinc-600 dark:text-zinc-400">
                {dict.kindEditHelp}
              </p>
              {kindError ? (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {kindError}
                </p>
              ) : null}
            </>
          ) : null}
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
        {/* Original filename stays visible after a rename: it is how a creator
            matches a library row back to the file on their own disk. */}
        {row.fallbackName ? (
          <>
            <dt className="text-zinc-500">{dict.originalFilenameLabel}</dt>
            <dd className="break-all font-mono text-xs">{row.fallbackName}</dd>
          </>
        ) : null}
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
          {/* Distinct from transcriptMissing above, which means "the attached
              transcript row has since been deleted". This is the far more common
              case: none was ever attached. */}
          {!transcriptSelection ? (
            <MissingTranscriptNotice
              lang={lang}
              dict={dict.noTranscriptNotice}
              className="mt-1"
            />
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
          <MediaPreviewDialog
            media={{
              id: row.id,
              kind: row.kind,
              status: row.status,
              cloudinaryPublicId: row.cloudinaryPublicId,
              cloudinarySecureUrl: row.cloudinarySecureUrl,
              displayName: displayedName,
            }}
            dict={dict.preview}
          />
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
            <ul className="flex flex-col gap-2 pl-0">
              {deleteState.blockers.map((b) => {
                const connected = b.connections && b.connections.length > 0;
                return (
                  <li key={`${b.type}:${b.id}`} className="rounded-md bg-black/5 p-2 dark:bg-white/10">
                    <p className="font-medium">
                      {b.type === "scene" && b.usedAs
                        ? dict.inUseScene
                            .replace("{scene}", b.name)
                            .replace("{usedAs}", dict.usedAs[b.usedAs])
                        : `${b.type}: ${b.name}`}
                    </p>

                    {/* A connected scene cannot just be deleted: removing it would
                        strand the arrows pointing at it. Name them, so the fix is a
                        list of things to do rather than a hunt. */}
                    {b.type === "scene" && connected ? (
                      <>
                        <p className="mt-1">
                          {dict.inUseSceneConnected.replace(
                            "{count}",
                            String(b.connections!.length),
                          )}
                        </p>
                        <ul className="mt-1 list-disc pl-5">
                          {b.connections!.map((c, i) => (
                            <li key={`${c.direction}:${c.otherSceneName}:${i}`}>
                              {(c.direction === "out"
                                ? dict.connectionOut
                                : dict.connectionIn
                              )
                                .replace("{scene}", b.name)
                                .replace("{other}", c.otherSceneName)}
                            </li>
                          ))}
                        </ul>
                        {b.destinationId ? (
                          <Link
                            href={`/${lang}/creator/destinations/${b.destinationId}/connections`}
                            className="mt-2 inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
                          >
                            {dict.openConnectionsCta}
                          </Link>
                        ) : null}
                      </>
                    ) : null}

                    {/* Nothing points at it, so offering to remove it here saves a
                        trip to the scene page for what is otherwise a dead end. */}
                    {b.type === "scene" && !connected && b.destinationId ? (
                      <button
                        type="button"
                        onClick={() => runDeleteScene(b.id, b.destinationId!)}
                        disabled={busy}
                        className="mt-2 inline-flex min-h-11 items-center rounded-md border border-red-500/40 px-3 text-sm font-semibold text-red-700 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:text-red-400"
                      >
                        {dict.deleteSceneCta.replace("{scene}", b.name)}
                      </button>
                    ) : null}
                  </li>
                );
              })}
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
    </article>
  );
}
