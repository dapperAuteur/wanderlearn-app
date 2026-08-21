"use client";

import { useEffect, useRef } from "react";
import type { TourScene } from "./types";

export type TourStopRailDict = {
  /** Accessible name for the rail's nav landmark. */
  regionLabel: string;
  /** "Stop {n} of {total}" — mirrors the hunt runner's existing counter copy. */
  stopOf: string;
  /** "{n} left" — what remains after the current scene. */
  remaining: string;
  /** Announced when the scene changes, e.g. "Now in {name}". */
  nowIn: string;
  /** Marks an already-visited stop for screen readers. */
  visitedLabel: string;
  /** Marks the stop currently on screen. */
  currentLabel: string;
  /** Shown when every stop has been seen. */
  allSeen: string;
};

interface TourStopRailProps {
  scenes: TourScene[];
  currentSceneId: string | null;
  visitedSceneIds: ReadonlySet<string>;
  onSelect: (sceneId: string) => void;
  dict: TourStopRailDict;
}

/**
 * The persistent "where am I / what's left" rail under a tour.
 *
 * This exists because getting lost is the single most-documented reason people
 * abandon a 360° tour: studies of virtual museums report a mismatch between
 * what visitors expect navigation to do and what it does, and people stop
 * exploring before they finish. Link arrows alone never answer "how much is
 * left", so nothing in the tour told a visitor they were two rooms from the
 * end.
 *
 * Two deliberate choices:
 *
 * - **Counts are real.** "Stop 3 of 14" comes from the actual scene list, and
 *   the remaining count is the genuine number of unvisited scenes. The
 *   goal-gradient research that says visible progress lifts completion is just
 *   as clear that a padded or invented denominator destroys trust in every
 *   other number on the page — and this app shows partners its numbers.
 * - **Every stop is reachable.** The rail jumps rather than walking the link
 *   graph, so a visitor is never trapped in a dead-end scene. That is the
 *   whole point of an orientation aid.
 *
 * `scenes` arrives already in visit order — the creator's explicit sequence
 * where they set one, otherwise a walk outward from the start scene. That
 * ordering happens once in assembleTour so every surface agrees; this
 * component renders the list it is given and does not re-sort.
 */
export function TourStopRail({
  scenes,
  currentSceneId,
  visitedSceneIds,
  onSelect,
  dict,
}: TourStopRailProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const currentIndex = scenes.findIndex((scene) => scene.id === currentSceneId);
  const total = scenes.length;

  // Keep the active stop in view as the visitor walks the tour with the arrows.
  // `block: "nearest"` so a horizontally-scrolling rail never yanks the PAGE
  // vertically — that would move the panorama out from under someone mid-look.
  useEffect(() => {
    if (currentIndex < 0) return;
    const node = listRef.current?.children[currentIndex];
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentIndex]);

  if (total <= 1) return null;

  const remaining = scenes.filter((scene) => !visitedSceneIds.has(scene.id)).length;
  const currentScene = currentIndex >= 0 ? scenes[currentIndex] : null;
  const positionLabel = dict.stopOf
    .replace("{n}", String(currentIndex >= 0 ? currentIndex + 1 : 1))
    .replace("{total}", String(total));

  return (
    <nav aria-label={dict.regionLabel} className="mt-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-xs tracking-wider text-muted uppercase">{positionLabel}</p>
        <p className="text-xs text-muted">
          {remaining === 0 ? dict.allSeen : dict.remaining.replace("{n}", String(remaining))}
        </p>
      </div>

      {/*
        A single polite live region carrying only the current scene name. The
        list items are buttons and would otherwise announce nothing on a jump,
        because focus stays on the button the visitor pressed while the content
        that changed is the panorama. Mirrors the aria-live wrapper the creator
        scene preview already uses.
      */}
      <p aria-live="polite" className="sr-only">
        {currentScene ? dict.nowIn.replace("{name}", currentScene.name) : ""}
      </p>

      {/*
        Horizontal scroll is confined to this container, never the page body —
        the layout gate forbids page-level horizontal scroll at any width down
        to 320px, and a 14-stop rail cannot fit a phone otherwise.
      */}
      <ol
        ref={listRef}
        className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]"
      >
        {scenes.map((scene, index) => {
          const isCurrent = scene.id === currentSceneId;
          const isVisited = visitedSceneIds.has(scene.id);

          return (
            <li key={scene.id} className="flex-none">
              <button
                type="button"
                onClick={() => onSelect(scene.id)}
                aria-current={isCurrent ? "step" : undefined}
                // State is carried in the accessible name, not by colour alone.
                aria-label={`${index + 1}. ${scene.name}${
                  isCurrent ? ` — ${dict.currentLabel}` : isVisited ? ` — ${dict.visitedLabel}` : ""
                }`}
                className={[
                  "flex min-h-11 w-32 flex-col items-start gap-1 rounded-md border-2 px-2.5 py-2 text-left",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
                  isCurrent
                    ? "border-brand-text bg-brand text-on-brand"
                    : isVisited
                      ? "border-line-strong bg-surface text-foreground"
                      : "border-dashed border-line-strong bg-transparent text-muted",
                ].join(" ")}
              >
                <span className="font-mono text-[0.625rem] tracking-wider uppercase opacity-80">
                  {index + 1}
                  {/* Redundant with the border style on purpose: a checkmark
                      survives greyscale, high-contrast mode, and colour
                      blindness, where a border weight might not. */}
                  {isVisited && !isCurrent ? " ✓" : ""}
                </span>
                <span className="line-clamp-2 text-xs leading-snug font-semibold">
                  {scene.name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
