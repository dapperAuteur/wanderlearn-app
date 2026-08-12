"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ComponentProps } from "react";
import { MediaUploader } from "@/components/media/media-uploader";
import {
  setDestinationMapSource,
  setSceneMapPosition,
  setSceneMapPositions,
} from "@/lib/actions/tour-map";
import { layoutTourGraph } from "@/lib/tour-graph";
import type { Locale } from "@/lib/locales";

export type TourMapDict = {
  heading: string;
  subtitle: string;
  sourceLegend: string;
  noMapOption: string;
  templateGrid: string;
  templateBlank: string;
  uploadHeading: string;
  emptyImages: string;
  savedLabel: string;
  missingDimensionsError: string;
  genericError: string;
  mapAlt: string;
  placeByClickCta: string;
  placingHint: string;
  stopPlacingCta: string;
  notPlaced: string;
  positionLabel: string;
  xLabel: string;
  yLabel: string;
  savePositionCta: string;
  nudgeHeading: string;
  nudgeSelected: string;
  nudgeSelectedUnplaced: string;
  nudgeNoSelection: string;
  nudgeLeft: string;
  nudgeRight: string;
  nudgeUp: string;
  nudgeDown: string;
  nudgeCoarseLabel: string;
  nudgeCoarseAria: string;
  nudgeHint: string;
  prevSceneCta: string;
  nextSceneCta: string;
  removeCta: string;
  autoArrangeCta: string;
  autoArrangeConfirm: string;
  autoArrangeDone: string;
  pinAriaLabel: string;
  sceneListHeading: string;
};

type SceneRowData = { id: string; name: string };
type SourceState =
  | { kind: "none" }
  | { kind: "template"; template: "grid" | "blank" }
  | { kind: "media"; id: string };

/**
 * Creator side of the tour map. Click-to-place is a convenience layer; the
 * per-scene percent inputs are the complete keyboard-operable equivalent —
 * the explicit answer to the a11y requirement that ruled out a drag canvas.
 */
export function TourMapEditor({
  lang,
  destinationId,
  scenes,
  positions,
  links,
  startSceneId,
  source,
  displayUrl,
  imageOptions,
  uploaderDict,
  userRole,
  dict,
}: {
  lang: Locale;
  destinationId: string;
  scenes: SceneRowData[];
  positions: Record<string, { x: number; y: number } | undefined>;
  links: { fromSceneId: string; toSceneId: string }[];
  startSceneId: string | null;
  source: SourceState;
  /** Resolved URL of the current map background, when one is set. */
  displayUrl: string | null;
  imageOptions: { id: string; label: string; thumbUrl: string | null }[];
  uploaderDict: ComponentProps<typeof MediaUploader>["dict"];
  userRole: string;
  dict: TourMapDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ kind: "status" | "alert"; text: string } | null>(
    null,
  );
  const [placingSceneId, setPlacingSceneId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Local echo of per-scene percent inputs, keyed by scene, seeded from props.
  const [fields, setFields] = useState<Record<string, { x: string; y: string }>>({});

  // Which pin the arrow controls move. Separate from placingSceneId on purpose:
  // selecting a pin to nudge it must not arm the click-to-place mode, or every
  // stray click on the map would teleport the scene you were adjusting.
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  // Optimistic positions so a held arrow key moves the pin at input speed. The
  // server sees one write per pause, not one per keypress.
  const [nudged, setNudged] = useState<Record<string, { x: number; y: number }>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const livePositions: Record<string, { x: number; y: number } | undefined> = {
    ...positions,
    ...nudged,
  };

  const hasMap = source.kind !== "none" && displayUrl !== null;
  const placedCount = scenes.filter((s) => livePositions[s.id]).length;
  const selectedScene = scenes.find((s) => s.id === selectedSceneId) ?? null;
  const selectedIndex = scenes.findIndex((s) => s.id === selectedSceneId);
  const selectedPos = selectedSceneId ? livePositions[selectedSceneId] : undefined;

  /**
   * Move the selected pin by a percentage step.
   *
   * Steps rather than dragging is the whole point: a drag surface cannot be
   * operated from a keyboard, which is why the drag-to-connect builder was
   * rejected, and on a hand-drawn plan discrete steps are faster anyway because
   * the drawing does not deserve pixel precision.
   */
  function nudge(dxPercent: number, dyPercent: number) {
    if (!selectedSceneId) return;
    const current = livePositions[selectedSceneId];
    if (!current) return;
    const next = {
      x: Math.min(1, Math.max(0, current.x + dxPercent / 100)),
      y: Math.min(1, Math.max(0, current.y + dyPercent / 100)),
    };
    setNudged((prev) => ({ ...prev, [selectedSceneId]: next }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePosition(
        selectedSceneId,
        Math.round(next.x * 10000) / 10000,
        Math.round(next.y * 10000) / 10000,
      );
    }, 500);
  }

  // A debounced save is in flight while the creator is still pressing; drop it
  // rather than setting state on an unmounted component.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  function selectByOffset(delta: number) {
    if (scenes.length === 0) return;
    const base = selectedIndex >= 0 ? selectedIndex : -1;
    const next = (base + delta + scenes.length) % scenes.length;
    setSelectedSceneId(scenes[next].id);
  }

  function saveSource(next: SourceState) {
    setBanner(null);
    const form = new FormData();
    form.set("id", destinationId);
    form.set("mapMediaId", next.kind === "media" ? next.id : "");
    form.set("mapTemplate", next.kind === "template" ? next.template : "");
    form.set("lang", lang);
    startTransition(async () => {
      const result = await setDestinationMapSource(form);
      if (!result.ok) {
        setBanner({
          kind: "alert",
          text:
            result.code === "media_missing_dimensions"
              ? dict.missingDimensionsError
              : dict.genericError,
        });
        return;
      }
      setBanner({ kind: "status", text: dict.savedLabel });
      router.refresh();
    });
  }

  function savePosition(sceneId: string, x: number | null, y: number | null) {
    setBanner(null);
    const form = new FormData();
    form.set("sceneId", sceneId);
    form.set("destinationId", destinationId);
    form.set("x", x === null ? "" : String(x));
    form.set("y", y === null ? "" : String(y));
    form.set("lang", lang);
    startTransition(async () => {
      const result = await setSceneMapPosition(form);
      if (!result.ok) {
        setBanner({ kind: "alert", text: dict.genericError });
        return;
      }
      setBanner({ kind: "status", text: dict.savedLabel });
      setFields((prev) => ({ ...prev, [sceneId]: undefined as never }));
      // Drop the optimistic override now the server holds the same value, so a
      // later click-to-place or percent entry is not shadowed by a stale nudge.
      setNudged((prev) => {
        const next = { ...prev };
        delete next[sceneId];
        return next;
      });
      router.refresh();
    });
  }

  function onStageClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!placingSceneId || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const sceneId = placingSceneId;
    setPlacingSceneId(null);
    savePosition(sceneId, Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000);
  }

  function autoArrange() {
    if (placedCount > 0 && !window.confirm(dict.autoArrangeConfirm)) return;
    const layout = layoutTourGraph({
      sceneIds: scenes.map((s) => s.id),
      links: links.map((l) => ({ ...l, placed: true })),
      startSceneId,
    });
    setBanner(null);
    startTransition(async () => {
      const result = await setSceneMapPositions({
        destinationId,
        positions: scenes
          .map((s) => {
            const pos = layout.get(s.id);
            return pos ? { sceneId: s.id, x: pos.x, y: pos.y } : null;
          })
          .filter((p): p is { sceneId: string; x: number; y: number } => p !== null),
        lang,
      });
      if (!result.ok) {
        setBanner({ kind: "alert", text: dict.genericError });
        return;
      }
      setBanner({
        kind: "status",
        text: dict.autoArrangeDone.replace("{count}", String(result.data.updated)),
      });
      router.refresh();
    });
  }

  const radioClasses =
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-black/10 p-2 hover:bg-black/5 has-[:checked]:border-current dark:border-white/15 dark:hover:bg-white/5";

  return (
    <section aria-labelledby="tour-map-heading" className="mt-10">
      <h2 id="tour-map-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
        {dict.subtitle}
      </p>

      {banner ? (
        <p
          role={banner.kind}
          aria-live={banner.kind === "status" ? "polite" : undefined}
          className={
            banner.kind === "status"
              ? "mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-300"
              : "mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-400"
          }
        >
          {banner.text}
        </p>
      ) : null}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">{dict.sourceLegend}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className={radioClasses}>
            <input
              type="radio"
              name="map-source"
              checked={source.kind === "none"}
              onChange={() => saveSource({ kind: "none" })}
              disabled={pending}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">{dict.noMapOption}</span>
          </label>
          <label className={radioClasses}>
            <input
              type="radio"
              name="map-source"
              checked={source.kind === "template" && source.template === "grid"}
              onChange={() => saveSource({ kind: "template", template: "grid" })}
              disabled={pending}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">{dict.templateGrid}</span>
          </label>
          <label className={radioClasses}>
            <input
              type="radio"
              name="map-source"
              checked={source.kind === "template" && source.template === "blank"}
              onChange={() => saveSource({ kind: "template", template: "blank" })}
              disabled={pending}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">{dict.templateBlank}</span>
          </label>
          {imageOptions.map((option) => (
            <label key={option.id} className={radioClasses}>
              <input
                type="radio"
                name="map-source"
                checked={source.kind === "media" && source.id === option.id}
                onChange={() => saveSource({ kind: "media", id: option.id })}
                disabled={pending}
                className="h-4 w-4"
              />
              {option.thumbUrl ? (
                <Image
                  src={option.thumbUrl}
                  alt=""
                  width={64}
                  height={36}
                  className="h-9 w-16 shrink-0 rounded object-cover"
                  unoptimized
                />
              ) : null}
              <span className="min-w-0 truncate text-sm font-medium">{option.label}</span>
            </label>
          ))}
        </div>
        {imageOptions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{dict.emptyImages}</p>
        ) : null}
      </fieldset>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">{dict.uploadHeading}</h3>
        <div className="mt-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
          {/* Locked to images: a floor plan is a flat picture, and the .insp
              auto-switch must not turn it into a 360 upload. */}
          <MediaUploader dict={uploaderDict} userRole={userRole} lockKind="image" />
        </div>
      </div>

      {hasMap ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={autoArrange}
              disabled={pending || scenes.length === 0}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.autoArrangeCta}
            </button>
            {placingSceneId ? (
              <p role="status" className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {dict.placingHint.replace(
                  "{scene}",
                  scenes.find((s) => s.id === placingSceneId)?.name ?? "",
                )}
              </p>
            ) : null}
          </div>


          {/* Arrow-button placement. Works for pointer, keyboard and touch with
              the same control, so there is no pointer-only path to placing a pin. */}
          <div className="mt-3 rounded-md border border-black/10 p-3 dark:border-white/15">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{dict.nudgeHeading}</span>
              <button
                type="button"
                onClick={() => selectByOffset(-1)}
                className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
              >
                {dict.prevSceneCta}
              </button>
              <button
                type="button"
                onClick={() => selectByOffset(1)}
                className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
              >
                {dict.nextSceneCta}
              </button>
              <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
                {selectedScene
                  ? selectedPos
                    ? dict.nudgeSelected
                        .replace("{number}", String(selectedIndex + 1))
                        .replace("{scene}", selectedScene.name)
                        .replace("{x}", String(Math.round(selectedPos.x * 100)))
                        .replace("{y}", String(Math.round(selectedPos.y * 100)))
                    : dict.nudgeSelectedUnplaced
                        .replace("{number}", String(selectedIndex + 1))
                        .replace("{scene}", selectedScene.name)
                  : dict.nudgeNoSelection}
              </p>
            </div>

            {selectedScene && selectedPos ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    [dict.nudgeLeft, -1, 0],
                    [dict.nudgeRight, 1, 0],
                    [dict.nudgeUp, 0, -1],
                    [dict.nudgeDown, 0, 1],
                  ] as const
                ).map(([label, dx, dy]) => (
                  <span key={label} className="inline-flex overflow-hidden rounded-md border border-black/15 dark:border-white/20">
                    <button
                      type="button"
                      onClick={() => nudge(dx, dy)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/5"
                    >
                      {label}
                    </button>
                    <button
                      type="button"
                      onClick={() => nudge(dx * 5, dy * 5)}
                      aria-label={dict.nudgeCoarseAria.replace("{direction}", label)}
                      className="inline-flex min-h-11 items-center justify-center border-l border-black/15 px-2 text-xs hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
                    >
                      {dict.nudgeCoarseLabel}
                    </button>
                  </span>
                ))}
                <span className="text-xs text-zinc-600 dark:text-zinc-400">{dict.nudgeHint}</span>
              </div>
            ) : null}
          </div>

          <div
            ref={stageRef}
            onClick={onStageClick}
            className={`relative mt-3 w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/15 ${placingSceneId ? "cursor-crosshair ring-2 ring-amber-500" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic
                aspect ratio must come from the file itself for pin math */}
            <img src={displayUrl!} alt={dict.mapAlt} className="block h-auto w-full" />
            {scenes.map((scene, index) => {
              const pos = livePositions[scene.id];
              if (!pos) return null;
              const isSelected = selectedSceneId === scene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSceneId(scene.id);
                  }}
                  onKeyDown={(e) => {
                    // Arrow keys move the focused pin directly. Shift is the
                    // coarse step, for crossing the map rather than tuning.
                    const step = e.shiftKey ? 5 : 1;
                    const moves: Record<string, [number, number]> = {
                      ArrowLeft: [-step, 0],
                      ArrowRight: [step, 0],
                      ArrowUp: [0, -step],
                      ArrowDown: [0, step],
                    };
                    const move = moves[e.key];
                    if (!move) return;
                    e.preventDefault();
                    setSelectedSceneId(scene.id);
                    nudge(move[0], move[1]);
                  }}
                  aria-label={dict.pinAriaLabel
                    .replace("{scene}", scene.name)
                    .replace("{x}", String(Math.round(pos.x * 100)))
                    .replace("{y}", String(Math.round(pos.y * 100)))}
                  aria-pressed={isSelected}
                  style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                  className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                    isSelected
                      ? "border-amber-300 bg-amber-600 ring-2 ring-amber-500"
                      : "border-white bg-emerald-700"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <h3 className="mt-6 text-sm font-semibold">{dict.sceneListHeading}</h3>
          <ol className="mt-2 flex flex-col gap-2">
            {scenes.map((scene, index) => {
              const pos = livePositions[scene.id];
              const field = fields[scene.id] ?? {
                x: pos ? String(Math.round(pos.x * 100)) : "",
                y: pos ? String(Math.round(pos.y * 100)) : "",
              };
              return (
                <li
                  key={scene.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/10 text-xs font-bold dark:bg-white/15">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {scene.name}
                  </span>
                  {!pos ? (
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      {dict.notPlaced}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setPlacingSceneId(placingSceneId === scene.id ? null : scene.id)
                    }
                    aria-pressed={placingSceneId === scene.id}
                    className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
                  >
                    {placingSceneId === scene.id ? dict.stopPlacingCta : dict.placeByClickCta}
                  </button>
                  {/* The keyboard path: exact percent entry, no pointer needed. */}
                  <span className="flex items-center gap-2" aria-label={dict.positionLabel}>
                    <label className="flex items-center gap-1 text-xs">
                      {dict.xLabel}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={field.x}
                        onChange={(e) =>
                          setFields((prev) => ({
                            ...prev,
                            [scene.id]: { ...field, x: e.target.value },
                          }))
                        }
                        className="min-h-11 w-16 rounded-md border border-black/15 bg-transparent px-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      {dict.yLabel}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={field.y}
                        onChange={(e) =>
                          setFields((prev) => ({
                            ...prev,
                            [scene.id]: { ...field, y: e.target.value },
                          }))
                        }
                        className="min-h-11 w-16 rounded-md border border-black/15 bg-transparent px-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={pending || field.x === "" || field.y === ""}
                      onClick={() =>
                        savePosition(
                          scene.id,
                          Number(field.x) / 100,
                          Number(field.y) / 100,
                        )
                      }
                      className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
                    >
                      {dict.savePositionCta}
                    </button>
                  </span>
                  {pos ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => savePosition(scene.id, null, null)}
                      className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
                    >
                      {dict.removeCta}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </section>
  );
}
