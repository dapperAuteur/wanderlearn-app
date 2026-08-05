"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import type { HuntProblem, UnlockKind } from "@/lib/hunts";
import {
  deleteHunt,
  deleteHuntStop,
  moveHuntStop,
  saveHuntStop,
  setHuntPublished,
  setSceneGeo,
  updateHunt,
} from "@/lib/actions/hunts";

// The hunt authoring surface. LIST-BASED AND KEYBOARD-OPERABLE by design, not by accident: plan 08
// killed the drag-to-connect canvas because it could not be made accessible, and a hunt builder is
// the same problem. Every action here is a real <button> in document order, reorder included.

type StopView = {
  id: string;
  sceneId: string;
  sceneName: string;
  sortOrder: number;
  title: string;
  clue: string | null;
  reveal: string | null;
  unlockKind: UnlockKind;
  answers: string[];
  requiredKeys: string[];
  grantsKey: string | null;
  unlockRadiusM: number;
  hasGeo: boolean;
};

type SceneView = { id: string; name: string; lat: string | null; lng: string | null };

type Dict = Record<string, string>;

const INPUT =
  "mt-1 min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "min-h-11 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700";

export function HuntEditor({
  lang,
  destinationId,
  hunt,
  stops,
  scenes,
  problems,
  dict: t,
}: {
  lang: Locale;
  destinationId: string;
  hunt: {
    id: string;
    title: string;
    intro: string | null;
    status: "draft" | "published";
    mode: "virtual" | "onsite";
    allowRemoteFallback: boolean;
  };
  stops: StopView[];
  scenes: SceneView[];
  problems: HuntProblem[];
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingStop, setEditingStop] = useState<string | "new" | null>(null);

  const errors = problems.filter((p) => p.level === "error");
  const warnings = problems.filter((p) => p.level === "warning");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  function fd(entries: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    f.set("lang", lang);
    return f;
  }

  return (
    <div className="mt-6 space-y-10">
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {/* ── Health ─────────────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="health">
        <h2 id="health" className="text-lg font-semibold">
          {t.healthHeading}
        </h2>
        {problems.length === 0 ? (
          <p className="mt-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {t.healthClean}
          </p>
        ) : (
          <>
            {errors.length > 0 ? (
              <div className="mt-2 rounded-md bg-red-50 p-3 dark:bg-red-950/40">
                <p className="text-sm font-medium text-red-900 dark:text-red-300">
                  {t.healthErrors.replace("{n}", String(errors.length))}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900 dark:text-red-300">
                  {errors.map((p, i) => (
                    <li key={`e${i}`}>{p.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <div className="mt-2 rounded-md bg-amber-50 p-3 dark:bg-amber-950/40">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {t.healthWarnings.replace("{n}", String(warnings.length))}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
                  {warnings.map((p, i) => (
                    <li key={`w${i}`}>{p.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN}
            disabled={pending || (hunt.status !== "published" && errors.length > 0)}
            onClick={() =>
              run(() =>
                setHuntPublished(
                  fd({ id: hunt.id, publish: String(hunt.status !== "published") }),
                ),
              )
            }
          >
            {hunt.status === "published" ? t.unpublishCta : t.publishCta}
          </button>
        </div>
      </section>

      {/* ── Settings ───────────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="settings">
        <h2 id="settings" className="text-lg font-semibold">
          {t.settingsHeading}
        </h2>
        <form
          className="mt-3 space-y-4"
          action={(form) => {
            form.set("id", hunt.id);
            form.set("lang", lang);
            run(() => updateHunt(form));
          }}
        >
          <div>
            <label htmlFor="h-title" className="block text-sm font-medium">
              {t.titleLabel}
            </label>
            <input id="h-title" name="title" defaultValue={hunt.title} required maxLength={120} className={INPUT} />
          </div>
          <div>
            <label htmlFor="h-intro" className="block text-sm font-medium">
              {t.introLabel}
            </label>
            <textarea
              id="h-intro"
              name="intro"
              defaultValue={hunt.intro ?? ""}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
          <div className="flex items-start gap-2">
            <input
              id="h-fallback"
              name="allowRemoteFallback"
              type="checkbox"
              defaultChecked={hunt.allowRemoteFallback}
              className="mt-1 h-5 w-5"
            />
            <label htmlFor="h-fallback" className="text-sm">
              <span className="font-medium">{t.remoteFallbackLabel}</span>
              <span className="mt-1 block text-neutral-600 dark:text-neutral-400">
                {t.remoteFallbackHelp}
              </span>
            </label>
          </div>
          <button type="submit" className={BTN} disabled={pending}>
            {t.saveCta}
          </button>
        </form>
      </section>

      {/* ── Stops ──────────────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="stops">
        <h2 id="stops" className="text-lg font-semibold">
          {t.stopsHeading}
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t.stopsIntro}</p>

        <ol className="mt-4 space-y-3">
          {stops.map((s, i) => (
            <li key={s.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">
                  {i + 1}. {s.title}
                </h3>
                <span className="text-xs text-neutral-500">
                  {s.sceneName} · {labelForKind(s.unlockKind, t)}
                  {s.unlockKind === "geo" && !s.hasGeo ? ` · ${t.geoUnset}` : ""}
                </span>
              </div>
              {s.clue ? (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{s.clue}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BTN}
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveHuntStop(fd({ stopId: s.id, huntId: hunt.id, direction: "up" })))}
                >
                  {t.moveUp}
                </button>
                <button
                  type="button"
                  className={BTN}
                  disabled={pending || i === stops.length - 1}
                  onClick={() => run(() => moveHuntStop(fd({ stopId: s.id, huntId: hunt.id, direction: "down" })))}
                >
                  {t.moveDown}
                </button>
                <button
                  type="button"
                  className={BTN}
                  onClick={() => setEditingStop(editingStop === s.id ? null : s.id)}
                  aria-expanded={editingStop === s.id}
                >
                  {t.editStopCta}
                </button>
                <button
                  type="button"
                  className={BTN}
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(t.deleteStopConfirm)) return;
                    run(() => deleteHuntStop(fd({ stopId: s.id, huntId: hunt.id })));
                  }}
                >
                  {t.deleteStop}
                </button>
              </div>
              {editingStop === s.id ? (
                <StopForm
                  lang={lang}
                  huntId={hunt.id}
                  stop={s}
                  scenes={scenes}
                  dict={t}
                  pending={pending}
                  onSubmit={(form) => {
                    run(() => saveHuntStop(form));
                    setEditingStop(null);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ol>

        <button
          type="button"
          className={`${BTN} mt-4`}
          onClick={() => setEditingStop(editingStop === "new" ? null : "new")}
          aria-expanded={editingStop === "new"}
        >
          {t.addStopCta}
        </button>
        {editingStop === "new" ? (
          <div className="mt-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <StopForm
              lang={lang}
              huntId={hunt.id}
              stop={null}
              scenes={scenes}
              dict={t}
              pending={pending}
              onSubmit={(form) => {
                run(() => saveHuntStop(form));
                setEditingStop(null);
              }}
            />
          </div>
        ) : null}
      </section>

      {/* ── Scene positions ────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="geo">
        <h2 id="geo" className="text-lg font-semibold">
          {t.geoHeading}
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t.geoIntro}</p>
        <ul className="mt-4 space-y-3">
          {scenes.map((s) => (
            <li key={s.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <form
                className="flex flex-wrap items-end gap-3"
                action={(form) => {
                  form.set("sceneId", s.id);
                  form.set("lang", lang);
                  run(() => setSceneGeo(form));
                }}
              >
                <span className="w-full text-sm font-medium">{s.name}</span>
                <div className="min-w-32 flex-1">
                  <label htmlFor={`lat-${s.id}`} className="block text-xs font-medium">
                    {t.latLabel}
                  </label>
                  <input
                    id={`lat-${s.id}`}
                    name="lat"
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    defaultValue={s.lat ?? ""}
                    className={INPUT}
                  />
                </div>
                <div className="min-w-32 flex-1">
                  <label htmlFor={`lng-${s.id}`} className="block text-xs font-medium">
                    {t.lngLabel}
                  </label>
                  <input
                    id={`lng-${s.id}`}
                    name="lng"
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    defaultValue={s.lng ?? ""}
                    className={INPUT}
                  />
                </div>
                <button type="submit" className={BTN} disabled={pending}>
                  {t.geoSave}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <button
          type="button"
          className={`${BTN} border-red-300 text-red-700 dark:border-red-800 dark:text-red-400`}
          disabled={pending}
          onClick={() => {
            if (!confirm(t.deleteConfirm)) return;
            startTransition(async () => {
              const r = await deleteHunt(fd({ id: hunt.id }));
              if (!r.ok) setError(r.error);
              else router.push(`/${lang}/creator/destinations/${destinationId}/hunts`);
            });
          }}
        >
          {t.deleteCta}
        </button>
      </section>
    </div>
  );
}

function labelForKind(kind: UnlockKind, t: Dict): string {
  if (kind === "answer") return t.unlockAnswer;
  if (kind === "keys") return t.unlockKeys;
  if (kind === "geo") return t.unlockGeo;
  return t.unlockOpen;
}

function StopForm({
  lang,
  huntId,
  stop,
  scenes,
  dict: t,
  pending,
  onSubmit,
}: {
  lang: Locale;
  huntId: string;
  stop: StopView | null;
  scenes: SceneView[];
  dict: Dict;
  pending: boolean;
  onSubmit: (form: FormData) => void;
}) {
  // Local state only so the conditional fields can show/hide as the creator picks a kind. The values
  // still submit as a plain form, so this works without JS beyond the toggle.
  const [kind, setKind] = useState<UnlockKind>(stop?.unlockKind ?? "open");
  const idp = stop?.id ?? "new";

  return (
    <form
      className="mt-4 space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-800"
      action={(form) => {
        form.set("huntId", huntId);
        form.set("lang", lang);
        if (stop) form.set("stopId", stop.id);
        onSubmit(form);
      }}
    >
      <div>
        <label htmlFor={`st-${idp}`} className="block text-sm font-medium">
          {t.stopTitleLabel}
        </label>
        <input id={`st-${idp}`} name="title" defaultValue={stop?.title ?? ""} required maxLength={160} className={INPUT} />
      </div>
      <div>
        <label htmlFor={`sc-${idp}`} className="block text-sm font-medium">
          {t.sceneLabel}
        </label>
        <select id={`sc-${idp}`} name="sceneId" defaultValue={stop?.sceneId ?? scenes[0]?.id ?? ""} required className={INPUT}>
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.lat == null ? ` (${t.geoUnset})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`cl-${idp}`} className="block text-sm font-medium">
          {t.clueLabel}
        </label>
        <textarea
          id={`cl-${idp}`}
          name="clue"
          defaultValue={stop?.clue ?? ""}
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <div>
        <label htmlFor={`rv-${idp}`} className="block text-sm font-medium">
          {t.revealLabel}
        </label>
        <textarea
          id={`rv-${idp}`}
          name="reveal"
          defaultValue={stop?.reveal ?? ""}
          rows={3}
          maxLength={4000}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">{t.unlockLabel}</legend>
        <select
          name="unlockKind"
          value={kind}
          onChange={(e) => setKind(e.target.value as UnlockKind)}
          className={INPUT}
          aria-label={t.unlockLabel}
        >
          <option value="open">{t.unlockOpen}</option>
          <option value="answer">{t.unlockAnswer}</option>
          <option value="keys">{t.unlockKeys}</option>
          <option value="geo">{t.unlockGeo}</option>
        </select>
      </fieldset>

      {kind === "answer" ? (
        <div>
          <label htmlFor={`an-${idp}`} className="block text-sm font-medium">
            {t.answersLabel}
          </label>
          <input id={`an-${idp}`} name="answers" defaultValue={(stop?.answers ?? []).join(", ")} className={INPUT} />
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{t.answersHelp}</p>
        </div>
      ) : null}

      {kind === "keys" ? (
        <div>
          <label htmlFor={`rk-${idp}`} className="block text-sm font-medium">
            {t.requiredKeysLabel}
          </label>
          <input id={`rk-${idp}`} name="requiredKeys" defaultValue={(stop?.requiredKeys ?? []).join(", ")} className={INPUT} />
        </div>
      ) : null}

      {kind === "geo" ? (
        <div>
          <label htmlFor={`rd-${idp}`} className="block text-sm font-medium">
            {t.radiusLabel}
          </label>
          <input
            id={`rd-${idp}`}
            name="unlockRadiusM"
            type="number"
            min={5}
            max={2000}
            defaultValue={stop?.unlockRadiusM ?? 40}
            className={INPUT}
          />
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{t.radiusHelp}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor={`gk-${idp}`} className="block text-sm font-medium">
          {t.grantsKeyLabel}
        </label>
        <input id={`gk-${idp}`} name="grantsKey" defaultValue={stop?.grantsKey ?? ""} maxLength={40} className={INPUT} />
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{t.keysHelp}</p>
      </div>

      {/* Radius always submits so a stop switched away from geo and back keeps its value. */}
      {kind !== "geo" ? (
        <input type="hidden" name="unlockRadiusM" value={stop?.unlockRadiusM ?? 40} />
      ) : null}

      <button type="submit" className={BTN} disabled={pending}>
        {t.saveCta}
      </button>
    </form>
  );
}
