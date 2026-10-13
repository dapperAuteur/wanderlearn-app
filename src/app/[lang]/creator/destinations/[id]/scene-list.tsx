"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { bulkSetSceneStatus } from "@/lib/actions/scenes";
import type { Locale } from "@/lib/locales";
import type { SceneStatus } from "@/lib/scene-status";

export type SceneListItem = {
  id: string;
  name: string;
  caption: string | null;
  status: SceneStatus;
  /** Whether this user may change the scene; another creator's scene can't be selected. */
  editable: boolean;
};

export type SceneBulkStatusDict = {
  toolbarLabel: string;
  selectAllLabel: string;
  selectSceneLabel: string;
  selectionLabel: string;
  clearLabel: string;
  publishSelectedCta: string;
  unpublishSelectedCta: string;
  savingLabel: string;
  notYoursLabel: string;
  publishedResult: string;
  unpublishedResult: string;
  alreadyLiveResult: string;
  alreadyHiddenResult: string;
  skippedResult: string;
  errorResult: string;
  confirmUnpublishAll: string;
  confirmUnpublishAllCta: string;
  cancelCta: string;
};

const STATUS_TONE: Record<SceneStatus, string> = {
  published:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300",
  unpublished:
    "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:border-amber-400/40 dark:text-amber-200",
  draft:
    "border-zinc-400/40 bg-zinc-400/10 text-zinc-700 dark:border-zinc-300/40 dark:text-zinc-200",
};

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5";

/**
 * The tour's scene list, with checkboxes so several scenes can be published or
 * unpublished at once instead of opening each scene's page in turn.
 */
export function SceneList({
  lang,
  destinationId,
  isPublic,
  scenes,
  statusLabels,
  dict,
}: {
  lang: Locale;
  destinationId: string;
  isPublic: boolean;
  scenes: SceneListItem[];
  statusLabels: Record<SceneStatus, string>;
  dict: SceneBulkStatusDict;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingUnpublishAll, setConfirmingUnpublishAll] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const editableIds = scenes.filter((scene) => scene.editable).map((scene) => scene.id);
  const allSelected = editableIds.length > 0 && editableIds.every((id) => selected.has(id));

  useEffect(() => {
    // Move focus into the confirmation so a keyboard or screen-reader user
    // lands on the choice rather than behind it.
    if (confirmingUnpublishAll) cancelRef.current?.focus();
  }, [confirmingUnpublishAll]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmingUnpublishAll(false);
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(editableIds));
    setConfirmingUnpublishAll(false);
  }

  function apply(target: "published" | "unpublished", confirmed = false) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    // Unpublishing every live scene of a public tour leaves its page empty.
    // That's allowed, but only on purpose.
    if (target === "unpublished" && isPublic && !confirmed) {
      const liveIds = scenes.filter((scene) => scene.status === "published").map((scene) => scene.id);
      if (liveIds.length > 0 && liveIds.every((id) => selected.has(id))) {
        setConfirmingUnpublishAll(true);
        return;
      }
    }

    setConfirmingUnpublishAll(false);
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await bulkSetSceneStatus({
        sceneIds: ids,
        destinationId,
        status: target,
        lang,
      });
      if (!result.ok) {
        setError(dict.errorResult);
        return;
      }
      const { updated, unchanged, skipped } = result.data;
      // Report every outcome, not just the successes, so nobody is left
      // guessing why a scene they ticked didn't change.
      const parts = [
        (target === "published" ? dict.publishedResult : dict.unpublishedResult).replace(
          "{count}",
          String(updated),
        ),
      ];
      if (unchanged > 0) {
        parts.push(
          (target === "published" ? dict.alreadyLiveResult : dict.alreadyHiddenResult).replace(
            "{count}",
            String(unchanged),
          ),
        );
      }
      if (skipped > 0) parts.push(dict.skippedResult.replace("{count}", String(skipped)));
      setNotice(parts.join(" "));
      setSelected(new Set());
      router.refresh();
    });
  }

  const nothingSelected = selected.size === 0;

  return (
    <div className="mt-6">
      {editableIds.length > 0 ? (
        <div
          role="group"
          aria-label={dict.toolbarLabel}
          className="flex flex-wrap items-center gap-3 border-b border-black/10 pb-3 dark:border-white/15"
        >
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-5 w-5"
            />
            {dict.selectAllLabel}
          </label>
          <span aria-live="polite" className="text-sm text-muted">
            {dict.selectionLabel.replace("{count}", String(selected.size))}
          </span>
          <button
            type="button"
            disabled={nothingSelected || pending}
            onClick={() => apply("published")}
            className={BUTTON}
          >
            {pending ? dict.savingLabel : dict.publishSelectedCta}
          </button>
          <button
            type="button"
            disabled={nothingSelected || pending}
            onClick={() => apply("unpublished")}
            className={BUTTON}
          >
            {pending ? dict.savingLabel : dict.unpublishSelectedCta}
          </button>
          {!nothingSelected ? (
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setConfirmingUnpublishAll(false);
              }}
              className={BUTTON}
            >
              {dict.clearLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {confirmingUnpublishAll ? (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100"
        >
          <p>{dict.confirmUnpublishAll}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => apply("unpublished", true)} className={BUTTON}>
              {dict.confirmUnpublishAllCta}
            </button>
            <button
              ref={cancelRef}
              type="button"
              onClick={() => setConfirmingUnpublishAll(false)}
              className={BUTTON}
            >
              {dict.cancelCta}
            </button>
          </div>
        </div>
      ) : null}

      {/* The live region stays mounted; only its content changes, which is
          what screen readers announce. */}
      <div role="status" aria-live="polite">
        {notice ? <p className="mt-3 text-sm">{notice}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {scenes.map((scene) => (
          <li
            key={scene.id}
            className="flex items-start gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <label className="-m-2 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center has-disabled:cursor-not-allowed">
              <input
                type="checkbox"
                checked={selected.has(scene.id)}
                disabled={!scene.editable || pending}
                onChange={() => toggle(scene.id)}
                className="h-5 w-5"
              />
              <span className="sr-only">
                {dict.selectSceneLabel.replace("{name}", scene.name)}
              </span>
            </label>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/${lang}/creator/destinations/${destinationId}/scenes/${scene.id}`}
                  className="text-base font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {scene.name}
                </Link>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[scene.status]}`}
                >
                  {statusLabels[scene.status]}
                </span>
              </div>
              {scene.caption ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{scene.caption}</p>
              ) : null}
              {!scene.editable ? <p className="mt-1 text-xs text-muted">{dict.notYoursLabel}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
