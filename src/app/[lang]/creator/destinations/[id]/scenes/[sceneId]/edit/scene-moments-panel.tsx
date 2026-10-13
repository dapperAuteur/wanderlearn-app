"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeSceneMomentPhoto,
  setSceneMomentHeading,
  setSceneMomentPhoto,
} from "@/lib/actions/moments";
import { normalizeHeadingOffset } from "@/lib/moments/moments";
import type { Locale } from "@/lib/locales";

export type SceneMomentsDict = {
  heading: string;
  intro: string;
  videoScene: string;
  noMoments: string;
  timelineLink: string;
  noPhoto: string;
  pickLabel: string;
  pickPlaceholder: string;
  thisTourGroup: string;
  otherFilesGroup: string;
  useCta: string;
  removeCta: string;
  removeLabel: string;
  lineUpHeading: string;
  lineUpHelp: string;
  turnLabel: string;
  resetCta: string;
  resetLabel: string;
  turnedStatus: string;
  notTurnedStatus: string;
  savingLabel: string;
  genericError: string;
};

export type SceneMomentPhotoForPanel = {
  mediaId: string;
  headingOffsetDeg: number;
  displayName: string;
  thumbnailUrl: string | null;
};

type PhotoOption = { id: string; displayName: string; inThisTour: boolean };

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5";

const NUDGES = [-10, -1, 1, 10] as const;

/**
 * This scene's photo for each of the tour's moments (plans/15), and the
 * line-up turn that makes hotspots and arrows placed on the base view land on
 * the same doorway in every moment. The preview above shows the result: switch
 * it to a moment with its Time control.
 */
export function SceneMomentsPanel({
  sceneId,
  destinationId,
  lang,
  isVideo,
  moments,
  photos,
  options,
  dict,
}: {
  sceneId: string;
  destinationId: string;
  lang: Locale;
  isVideo: boolean;
  /** Non-base moments, in timeline order. */
  moments: { id: string; label: string }[];
  photos: Record<string, SceneMomentPhotoForPanel>;
  options: PhotoOption[];
  dict: SceneMomentsDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="scene-moments-heading" className="rounded-lg border border-black/10 p-6 dark:border-white/15">
      <h2 id="scene-moments-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      {isVideo ? (
        <p className="mt-2 text-sm text-muted">{dict.videoScene}</p>
      ) : moments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {dict.noMoments}{" "}
          <Link
            href={`/${lang}/creator/destinations/${destinationId}`}
            className="underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.timelineLink}
          </Link>
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">{dict.intro}</p>
          <ul className="mt-4 flex flex-col gap-4">
            {moments.map((moment) => (
              <MomentRow
                key={`${moment.id}|${photos[moment.id]?.mediaId ?? ""}|${photos[moment.id]?.headingOffsetDeg ?? ""}`}
                moment={moment}
                photo={photos[moment.id]}
                options={options}
                pending={pending}
                dict={dict}
                onUse={(mediaId) =>
                  run(() => setSceneMomentPhoto({ sceneId, momentId: moment.id, mediaId, lang }))
                }
                onRemove={() => run(() => removeSceneMomentPhoto({ sceneId, momentId: moment.id, lang }))}
                onTurn={(headingOffsetDeg) =>
                  run(() =>
                    setSceneMomentHeading({ sceneId, momentId: moment.id, headingOffsetDeg, lang }),
                  )
                }
              />
            ))}
          </ul>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function MomentRow({
  moment,
  photo,
  options,
  pending,
  dict,
  onUse,
  onRemove,
  onTurn,
}: {
  moment: { id: string; label: string };
  photo: SceneMomentPhotoForPanel | undefined;
  options: PhotoOption[];
  pending: boolean;
  dict: SceneMomentsDict;
  onUse: (mediaId: string) => void;
  onRemove: () => void;
  onTurn: (headingOffsetDeg: number) => void;
}) {
  const selectId = useId();
  const [choice, setChoice] = useState(photo?.mediaId ?? "");
  // Shown at once; the saved value catches up on refresh.
  const [turn, setTurn] = useState(photo?.headingOffsetDeg ?? 0);
  const inTour = options.filter((option) => option.inThisTour);
  const others = options.filter((option) => !option.inThisTour);

  function nudge(delta: number) {
    const next = normalizeHeadingOffset(Math.round((turn + delta) * 10) / 10);
    setTurn(next);
    onTurn(next);
  }

  return (
    <li className="rounded-md border border-black/10 p-4 dark:border-white/15">
      <h3 className="text-base font-semibold">{moment.label}</h3>

      {photo ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {photo.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.thumbnailUrl} alt="" className="h-16 w-28 rounded object-cover" />
          ) : null}
          <span className="text-sm">{photo.displayName}</span>
          <button
            type="button"
            disabled={pending}
            onClick={onRemove}
            aria-label={dict.removeLabel.replace("{moment}", moment.label)}
            className={BUTTON}
          >
            {dict.removeCta}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">{dict.noPhoto}</p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{dict.pickLabel.replace("{moment}", moment.label)}</span>
          <select
            id={selectId}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="min-h-11 max-w-full rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
          >
            <option value="">{dict.pickPlaceholder}</option>
            {inTour.length > 0 ? (
              <optgroup label={dict.thisTourGroup}>
                {inTour.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.displayName}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {others.length > 0 ? (
              <optgroup label={dict.otherFilesGroup}>
                {others.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.displayName}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !choice || choice === photo?.mediaId}
          onClick={() => onUse(choice)}
          className={BUTTON}
        >
          {pending ? dict.savingLabel : dict.useCta}
        </button>
      </div>

      {photo ? (
        <div role="group" aria-label={dict.lineUpHeading} className="mt-4">
          <p className="text-sm font-medium">{dict.lineUpHeading}</p>
          <p className="text-xs text-muted">{dict.lineUpHelp}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {NUDGES.map((delta) => (
              <button
                key={delta}
                type="button"
                disabled={pending}
                onClick={() => nudge(delta)}
                aria-label={dict.turnLabel.replace("{deg}", `${delta > 0 ? "+" : ""}${delta}`)}
                className={BUTTON}
              >
                {delta > 0 ? `+${delta}°` : `${delta}°`}
              </button>
            ))}
            {turn !== 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setTurn(0);
                  onTurn(0);
                }}
                aria-label={dict.resetLabel}
                className={BUTTON}
              >
                {dict.resetCta}
              </button>
            ) : null}
            <span aria-live="polite" className="text-sm text-muted">
              {turn ? dict.turnedStatus.replace("{deg}", String(turn)) : dict.notTurnedStatus}
            </span>
          </div>
        </div>
      ) : null}
    </li>
  );
}
