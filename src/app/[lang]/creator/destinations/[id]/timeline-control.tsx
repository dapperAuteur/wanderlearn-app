"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addTourMoment,
  deleteTourMoment,
  reorderTourMoments,
  setOfflineIncludeMoments,
  updateTourMoment,
} from "@/lib/actions/moments";
import type { Locale } from "@/lib/locales";
import type { Moment } from "@/lib/moments/types";

export type TimelineDict = {
  heading: string;
  intro: string;
  emptyState: string;
  baseBadge: string;
  baseNote: string;
  baseDefaultLabel: string;
  labelLabel: string;
  dateLabel: string;
  saveCta: string;
  savingLabel: string;
  savedLabel: string;
  earlierCta: string;
  laterCta: string;
  earlierLabel: string;
  laterLabel: string;
  deleteCta: string;
  deleteLabel: string;
  deleteConfirm: string;
  confirmDeleteCta: string;
  cancelCta: string;
  addHeading: string;
  addCta: string;
  offlineLabel: string;
  offlineNote: string;
  genericError: string;
};

const INPUT =
  "min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20";
const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5";

/**
 * A tour's timeline: the moments a visitor can switch between (plans/15).
 * Moments are added here; each scene gets its photo for a moment on the
 * scene's own page.
 */
export function TimelineControl({
  destinationId,
  lang,
  moments,
  offlineIncludeMoments,
  dict,
}: {
  destinationId: string;
  lang: Locale;
  moments: Moment[];
  offlineIncludeMoments: boolean;
  dict: TimelineDict;
}) {
  const router = useRouter();
  const baseId = useId();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState("");

  function run(action: () => Promise<{ ok: boolean }>, after?: () => void) {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      after?.();
      setNotice(dict.savedLabel);
      router.refresh();
    });
  }

  function move(index: number, delta: -1 | 1) {
    const ids = moments.map((moment) => moment.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => reorderTourMoments({ destinationId, orderedIds: ids, lang }));
  }

  return (
    <section className="rounded-lg border border-black/15 p-4 dark:border-white/20">
      <h3 className="text-base font-semibold">{dict.heading}</h3>
      <p className="mt-1 text-sm text-muted">{dict.intro}</p>

      {moments.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{dict.emptyState}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {moments.map((moment, index) => (
            <MomentRow
              key={`${moment.id}|${moment.label}|${moment.occurredOn ?? ""}`}
              moment={moment}
              first={index === 0}
              last={index === moments.length - 1}
              pending={pending}
              confirming={confirmingDelete === moment.id}
              dict={dict}
              onSave={(label, occurredOn) =>
                run(() => updateTourMoment({ id: moment.id, label, occurredOn, lang }))
              }
              onMove={(delta) => move(index, delta)}
              onAskDelete={() => setConfirmingDelete(moment.id)}
              onCancelDelete={() => setConfirmingDelete(null)}
              onDelete={() =>
                run(
                  () => deleteTourMoment({ id: moment.id, lang }),
                  () => setConfirmingDelete(null),
                )
              }
            />
          ))}
        </ol>
      )}

      <form
        className="mt-4 flex flex-col gap-2 rounded-md border border-dashed border-black/15 p-3 dark:border-white/20"
        onSubmit={(event) => {
          event.preventDefault();
          if (!newLabel.trim()) return;
          run(
            () =>
              addTourMoment({
                destinationId,
                label: newLabel,
                occurredOn: newDate || null,
                baseLabel: dict.baseDefaultLabel,
                lang,
              }),
            () => {
              setNewLabel("");
              setNewDate("");
            },
          );
        }}
      >
        <h4 className="text-sm font-semibold">{dict.addHeading}</h4>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm" htmlFor={`${baseId}-new-label`}>
            <span className="font-medium">{dict.labelLabel}</span>
            <input
              id={`${baseId}-new-label`}
              value={newLabel}
              maxLength={40}
              required
              onChange={(event) => setNewLabel(event.target.value)}
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm" htmlFor={`${baseId}-new-date`}>
            <span className="font-medium">{dict.dateLabel}</span>
            <input
              id={`${baseId}-new-date`}
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              className={INPUT}
            />
          </label>
          <button type="submit" disabled={pending || !newLabel.trim()} className={BUTTON}>
            {pending ? dict.savingLabel : dict.addCta}
          </button>
        </div>
      </form>

      {/* Applies when a learner saves a course that shows this tour for
          offline use. Back since fix/offline-pack-served made saved packs
          include tours and get served (plans/app-improvements/39). */}
      {moments.length > 0 ? (
        <div className="mt-4">
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              defaultChecked={offlineIncludeMoments}
              disabled={pending}
              onChange={(event) =>
                run(() =>
                  setOfflineIncludeMoments({ destinationId, include: event.target.checked, lang }),
                )
              }
              className="size-5"
            />
            {dict.offlineLabel}
          </label>
          <p className="text-xs text-muted">{dict.offlineNote}</p>
        </div>
      ) : null}

      <div role="status" aria-live="polite">
        {notice ? <p className="mt-2 text-sm">{notice}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function MomentRow({
  moment,
  first,
  last,
  pending,
  confirming,
  dict,
  onSave,
  onMove,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  moment: Moment;
  first: boolean;
  last: boolean;
  pending: boolean;
  confirming: boolean;
  dict: TimelineDict;
  onSave: (label: string, occurredOn: string | null) => void;
  onMove: (delta: -1 | 1) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const id = useId();
  const [label, setLabel] = useState(moment.label);
  const [date, setDate] = useState(moment.occurredOn ?? "");
  const changed = label.trim() !== moment.label || (date || null) !== moment.occurredOn;

  return (
    <li className="rounded-md border border-black/10 p-3 dark:border-white/15">
      {moment.isBase ? (
        <p className="mb-2 text-xs">
          <span className="rounded-full border border-line-strong px-2 py-0.5 font-semibold">
            {dict.baseBadge}
          </span>{" "}
          <span className="text-muted">{dict.baseNote}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-label`}>
          <span className="font-medium">{dict.labelLabel}</span>
          <input
            id={`${id}-label`}
            value={label}
            maxLength={40}
            onChange={(event) => setLabel(event.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-date`}>
          <span className="font-medium">{dict.dateLabel}</span>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={INPUT}
          />
        </label>
        <button
          type="button"
          disabled={pending || !changed || !label.trim()}
          onClick={() => onSave(label, date || null)}
          className={BUTTON}
        >
          {dict.saveCta}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || first}
          onClick={() => onMove(-1)}
          aria-label={dict.earlierLabel.replace("{label}", moment.label)}
          className={BUTTON}
        >
          {dict.earlierCta}
        </button>
        <button
          type="button"
          disabled={pending || last}
          onClick={() => onMove(1)}
          aria-label={dict.laterLabel.replace("{label}", moment.label)}
          className={BUTTON}
        >
          {dict.laterCta}
        </button>
        {!moment.isBase ? (
          <button
            type="button"
            disabled={pending}
            onClick={onAskDelete}
            aria-label={dict.deleteLabel.replace("{label}", moment.label)}
            className={BUTTON}
          >
            {dict.deleteCta}
          </button>
        ) : null}
      </div>
      {confirming ? (
        <div role="alert" className="mt-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <p>{dict.deleteConfirm.replace("{label}", moment.label)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={onDelete} className={BUTTON}>
              {dict.confirmDeleteCta}
            </button>
            <button type="button" onClick={onCancelDelete} className={BUTTON}>
              {dict.cancelCta}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
