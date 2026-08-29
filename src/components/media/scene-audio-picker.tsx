"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";
import { updateSceneAudio } from "@/lib/actions/scenes";
import {
  Pager,
  PickerToggle,
  ScopeChips,
  usePagedOptions,
  type PickerChromeDict,
} from "./media-picker-chrome";

export type AudioOption = {
  id: string;
  displayName: string | null;
  /** Original upload filename, shown when no display name was typed. */
  fallbackName?: string | null;
  url: string | null;
  durationSeconds: number | null;
  inThisTour?: boolean;
};

export type AudioPickerDict = {
  heading: string;
  subtitle: string;
  currentLabel: string;
  noneLabel: string;
  emptyState: string;
  emptyStateCta: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  clearCta: string;
  genericError: string;
  unnamedLabel: string;
  expandCta: string;
  collapseCta: string;
  previewLabel: string;
  loopNote: string;
  loopLegend: string;
  loopOnLabel: string;
  loopOnceLabel: string;
  descriptionLabel: string;
  descriptionHint: string;
  descriptionPlaceholder: string;
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Picks the looping ambient bed for one scene.
 *
 * Deliberately a list with an audio element per row rather than a thumbnail
 * grid: sound has nothing to look at, and the only way to know whether a file
 * is the right room tone is to hear it. Each row carries a native <audio
 * controls>, which is keyboard operable and screen-reader labelled for free.
 */
/**
 * What to call a file.
 *
 * Three steps, matching the media library exactly
 * (media-library-row.tsx): a typed display name, else the original filename,
 * else a placeholder. The picker used to skip the middle step, so a file with
 * no display name read as its filename in the library and "Untitled" here —
 * the same asset, two names, which makes it impossible to find the thing you
 * just uploaded.
 */
function nameFor(
  option: { displayName: string | null; fallbackName?: string | null },
  unnamed: string,
): string {
  return option.displayName?.trim() || option.fallbackName?.trim() || unnamed;
}

export function SceneAudioPicker({
  sceneId,
  destinationId,
  lang,
  currentAudioId,
  currentAudioLoop,
  currentAudioDescription,
  options,
  mediaLibraryHref,
  dict,
  chromeDict,
}: {
  sceneId: string;
  destinationId: string;
  lang: Locale;
  currentAudioId: string | null;
  /** Whether the bed currently loops. True for every scene before the column existed. */
  currentAudioLoop: boolean;
  /** Existing text alternative for the ambient bed, or null. */
  currentAudioDescription: string | null;
  options: AudioOption[];
  mediaLibraryHref: string;
  dict: AudioPickerDict;
  chromeDict: PickerChromeDict;
}) {
  const fieldId = useId();
  const [selection, setSelection] = useState<string | null>(currentAudioId);
  const [loop, setLoop] = useState<boolean>(currentAudioLoop);
  const [description, setDescription] = useState<string>(currentAudioDescription ?? "");
  const paged = usePagedOptions({ options });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = selection !== currentAudioId;
  const currentOption = options.find((o) => o.id === currentAudioId) ?? null;

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("sceneId", sceneId);
    fd.set("destinationId", destinationId);
    fd.set("lang", lang);
    if (selection) fd.set("audioMediaId", selection);
    // Always sent, never omitted: the action treats a missing field as "loop"
    // for backwards compatibility, so silence here would quietly ignore the
    // creator turning looping off.
    fd.set("audioLoop", loop ? "true" : "false");
    fd.set("audioDescription", description);
    startTransition(async () => {
      const result = await updateSceneAudio(fd);
      if (!result.ok) setError(dict.genericError);
    });
  }

  return (
    <section
      aria-labelledby={`${fieldId}-heading`}
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 id={`${fieldId}-heading`} className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.subtitle}</p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{dict.loopNote}</p>

      {/*
        Loop or play once. Offered as radios rather than a checkbox because
        "play once and stop" is a real editorial choice, not the absence of
        looping — a bell, a passing train, or a single spoken line should not
        repeat, and a checkbox labelled "loop" makes the alternative read as
        switching something off.
      */}
      <fieldset className="mt-3 flex flex-col gap-1">
        <legend className="text-sm font-medium">{dict.loopLegend}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={`${fieldId}-loop`}
            checked={loop}
            onChange={() => setLoop(true)}
            className="size-4"
          />
          {dict.loopOnLabel}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={`${fieldId}-loop`}
            checked={!loop}
            onChange={() => setLoop(false)}
            className="size-4"
          />
          {dict.loopOnceLabel}
        </label>
      </fieldset>

      {/*
        The text alternative, sitting with the sound it describes rather than in
        a separate accessibility panel — a field you have to go looking for is a
        field that stays empty.
      
        A DESCRIPTION, not a transcript: a room tone has no words to transcribe,
        and "distant traffic, birdsong from the courtyard" is what actually helps.
        Spoken hotspot audio is the other case and has its own contentHtml.
      */}
      <div className="mt-3 flex flex-col gap-1">
        <label htmlFor={`${fieldId}-desc`} className="text-sm font-medium">
          {dict.descriptionLabel}
        </label>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{dict.descriptionHint}</p>
        <textarea
          id={`${fieldId}-desc`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={dict.descriptionPlaceholder}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
        />
      </div>

      <p className="mt-3 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">{dict.currentLabel}: </span>
        <span className="font-medium">
          {currentOption
            ? nameFor(currentOption, dict.unnamedLabel)
            : dict.noneLabel}
        </span>
      </p>

      {options.length === 0 ? (
        <>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{dict.emptyState}</p>
          <Link
            href={mediaLibraryHref}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.emptyStateCta}
          </Link>
        </>
      ) : (
        <>
          <div className="mt-4">
            <PickerToggle
              open={paged.open}
              setOpen={paged.setOpen}
              count={options.length}
              expandCta={dict.expandCta}
              collapseCta={dict.collapseCta}
              dict={chromeDict}
            />
          </div>

          {paged.open ? (
            <>
              {paged.hasTourScope ? (
                <div className="mt-3">
                  <ScopeChips scope={paged.scope} setScope={paged.setScope} dict={chromeDict} />
                </div>
              ) : null}

              <ul className="mt-4 flex flex-col gap-2">
                {paged.pageItems.map((option) => {
                  const selected = selection === option.id;
                  return (
                    <li
                      key={option.id}
                      className={`flex flex-wrap items-center gap-3 rounded-md border p-2 ${
                        selected
                          ? "border-foreground bg-foreground/5"
                          : "border-black/15 dark:border-white/20"
                      }`}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name={`${fieldId}-audio`}
                          value={option.id}
                          checked={selected}
                          onChange={() => setSelection(option.id)}
                          className="h-4 w-4"
                        />
                        <span className="min-w-0 truncate text-sm font-medium">
                          {nameFor(option, dict.unnamedLabel)}
                        </span>
                        {option.durationSeconds !== null ? (
                          <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
                            {formatDuration(option.durationSeconds)}
                          </span>
                        ) : null}
                      </label>
                      {option.url ? (
                        <audio
                          controls
                          preload="none"
                          src={option.url}
                          aria-label={`${dict.previewLabel}: ${nameFor(option, dict.unnamedLabel)}`}
                          className="h-9 max-w-full"
                        />
                      ) : null}
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
            </>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={pending || !dirty}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {pending ? dict.savingLabel : dict.saveCta}
            </button>
            <button
              type="button"
              onClick={() => setSelection(null)}
              disabled={pending || selection === null}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.clearCta}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelection(currentAudioId);
                setError(null);
              }}
              disabled={pending || !dirty}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.cancelCta}
            </button>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
