"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/locales";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import {
  VirtualTour,
  type PositionClick,
  type TexturePosition,
  type ViewerHandle,
  type ViewerOverlay,
  type VirtualTourViewerApi,
} from "@/components/virtual-tour/virtual-tour";
import {
  PRIVACY_DEFAULT_BOX,
  PRIVACY_MAX_BOXES,
  bottomOutline,
  boxContains,
  boxHandlePoints,
  boxOutline,
  emptyPrivacyRecipe,
  moveBoxTo,
  resizeBoxFromCorner,
  type BoxCorner,
  type PrivacyRecipe,
} from "@/lib/privacy-edit";
import { ViewLimitControls, type ViewLimitDict } from "./view-limit-controls";
import { ImageEditPanel, type PreviewState } from "./image-edit-panel";
import type { ClickMode, ImageEditSetup, PrivacyEditDict } from "./privacy-types";

const toolbarButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5";

let boxCounter = 0;
function newBoxId(): string {
  boxCounter += 1;
  return `b${Date.now().toString(36)}${boxCounter}`;
}

/**
 * The working surface of the "Hide people and gear" page: one viewer, and the controls
 * that act on it.
 *
 * A single-scene tour on purpose. The creator is fixing THIS photograph, and a viewer
 * they could walk out of would let a saved setting land on a scene they were not looking
 * at (the wrong-target bug the scene page once had).
 */
export function PrivacyWorkspace({
  tour,
  sceneId,
  destinationId,
  lang,
  initialMinPitchDeg,
  viewLimitDict,
  edit,
  editDict,
}: {
  tour: VirtualTourType;
  sceneId: string;
  destinationId: string;
  lang: Locale;
  initialMinPitchDeg: number | null;
  viewLimitDict: ViewLimitDict;
  /** Null for a 360 video scene: Cloudinary's face and region effects are images only. */
  edit: ImageEditSetup | null;
  editDict: PrivacyEditDict;
}) {
  const apiRef = useRef<VirtualTourViewerApi | null>(null);
  const [recipe, setRecipe] = useState<PrivacyRecipe>(edit?.initialRecipe ?? emptyPrivacyRecipe());
  const [clickMode, setClickMode] = useState<ClickMode>({ kind: "idle" });
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showOutlines, setShowOutlines] = useState(true);
  // What the last drag or nudge left a box at, for the status line. Kept with the box's
  // id so it goes quiet once another box is selected.
  const [sizeNote, setSizeNote] = useState<{ boxId: string; text: string } | null>(null);

  // Read inside the click handler, which must stay referentially stable: the viewer
  // rebuilds (reloading the panorama) whenever its click callback changes identity.
  // Synced after commit, which is always before the next click can arrive.
  const modeRef = useRef(clickMode);
  const recipeRef = useRef(recipe);
  useEffect(() => {
    modeRef.current = clickMode;
  }, [clickMode]);
  useEffect(() => {
    recipeRef.current = recipe;
  }, [recipe]);

  const handleClick = useCallback((position: PositionClick) => {

    const t = position.texture;
    if (!t) return;
    const mode = modeRef.current;
    if (mode.kind === "add") {
      if (recipeRef.current.boxes.length >= PRIVACY_MAX_BOXES) return;
      const id = newBoxId();
      setRecipe((r) => ({ ...r, boxes: [...r.boxes, { id, u: t.u, v: t.v, ...PRIVACY_DEFAULT_BOX }] }));
      setSelectedBoxId(id);
      return;
    }
    if (mode.kind === "move") {
      setRecipe((r) => ({
        ...r,
        boxes: r.boxes.map((b) => (b.id === mode.boxId ? { ...b, u: t.u, v: t.v } : b)),
      }));
      setSelectedBoxId(mode.boxId);
      setClickMode({ kind: "idle" });
      return;
    }
    // Idle: a click on a box selects it, so its controls are easy to find in the list.
    const hit = [...recipeRef.current.boxes].reverse().find((b) => boxContains(b, t));
    if (hit) setSelectedBoxId(hit.id);
  }, []);

  /** Add a box where the screen is centred: the keyboard route to the same result. */
  const addBoxAtCenter = useCallback(() => {
    const t = apiRef.current?.getViewCenterTexture();
    if (!t || recipeRef.current.boxes.length >= PRIVACY_MAX_BOXES) return;
    const id = newBoxId();
    setRecipe((r) => ({ ...r, boxes: [...r.boxes, { id, u: t.u, v: t.v, ...PRIVACY_DEFAULT_BOX }] }));
    setSelectedBoxId(id);
  }, []);

  const moveBoxToCenter = useCallback((boxId: string) => {
    const t = apiRef.current?.getViewCenterTexture();
    if (!t) return;
    setRecipe((r) => ({
      ...r,
      boxes: r.boxes.map((b) => (b.id === boxId ? { ...b, u: t.u, v: t.v } : b)),
    }));
    setSelectedBoxId(boxId);
  }, []);

  // The preview is a different panorama URL for the same scene. Swapping it in rebuilds
  // the viewer, which keeps the heading (same scene id) and redraws the outlines.
  const displayTour = useMemo<VirtualTourType>(() => {
    if (!preview || !showPreview) return tour;
    return { ...tour, scenes: tour.scenes.map((s) => ({ ...s, panorama: preview.url })) };
  }, [tour, preview, showPreview]);

  const overlays = useMemo<ViewerOverlay[]>(() => {
    if (!edit || !showOutlines) return [];
    const list: ViewerOverlay[] = recipe.boxes.map((box, i) => ({
      id: box.id,
      kind: "area",
      points: boxOutline(box),
      label: editDict.overlayBox.replace("{n}", String(i + 1)),
      emphasis: box.id === selectedBoxId,
    }));
    if (recipe.bottom.mode !== "off") {
      const ring = bottomOutline(recipe.bottom.angleDeg);
      list.push({
        id: "bottom",
        kind: "line",
        points: [...ring, ring[0]],
        label: editDict.overlayBottom,
      });
    }
    return list;
  }, [edit, showOutlines, recipe, selectedBoxId, editDict]);

  // Drag handles on the selected box: its middle moves it, its corners resize it.
  const selectedIndex = recipe.boxes.findIndex((b) => b.id === selectedBoxId);
  const selectedBox = selectedIndex >= 0 ? recipe.boxes[selectedIndex] : null;
  const handles = useMemo<ViewerHandle[]>(() => {
    if (!edit || !showOutlines || !selectedBox) return [];
    const n = String(selectedIndex + 1);
    const points = boxHandlePoints(selectedBox);
    const labels: Record<ViewerHandle["shape"], string> = {
      move: editDict.handleMove,
      nw: editDict.handleNw,
      ne: editDict.handleNe,
      sw: editDict.handleSw,
      se: editDict.handleSe,
    };
    return (["nw", "ne", "sw", "se", "move"] as const).map((shape) => ({
      id: `${selectedBox.id}:${shape}`,
      shape,
      position: points[shape],
      label: labels[shape].replace("{n}", n),
    }));
  }, [edit, showOutlines, selectedBox, selectedIndex, editDict]);

  const handleHandleMove = useCallback(
    (handleId: string, at: TexturePosition, phase: "move" | "end") => {
      const split = handleId.lastIndexOf(":");
      const boxId = handleId.slice(0, split);
      const shape = handleId.slice(split + 1) as ViewerHandle["shape"];
      const index = recipeRef.current.boxes.findIndex((b) => b.id === boxId);
      const box = recipeRef.current.boxes[index];
      if (!box) return;
      const next = shape === "move" ? moveBoxTo(box, at) : resizeBoxFromCorner(box, shape as BoxCorner, at);
      // Kept in step at once, so the next pointer frame builds on this one.
      recipeRef.current = {
        ...recipeRef.current,
        boxes: recipeRef.current.boxes.map((b) => (b.id === boxId ? next : b)),
      };
      setRecipe(recipeRef.current);
      if (phase === "end") {
        setSizeNote({
          boxId,
          text: editDict.boxSizeNow
            .replace("{n}", String(index + 1))
            .replace("{w}", String(Math.round(next.w * 360)))
            .replace("{h}", String(Math.round(next.h * 180))),
        });
      }
    },
    [editDict],
  );

  // A preview is a photo of an older recipe. Once the boxes move on, the pixelation on
  // screen is no longer where the boxes are, which reads as "the box missed" unless said.
  const previewStale = preview !== null && showPreview && preview.recipeKey !== JSON.stringify(recipe);

  const modeIndex =
    clickMode.kind === "move" ? recipe.boxes.findIndex((b) => b.id === clickMode.boxId) + 1 : 0;
  const adding = clickMode.kind === "add";
  const full = recipe.boxes.length >= PRIVACY_MAX_BOXES;

  return (
    <>
      <div className="mt-8 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        <VirtualTour
          tour={displayTour}
          height="60vh"
          apiRef={apiRef}
          onPositionClick={edit ? handleClick : undefined}
          overlays={overlays}
          handles={handles}
          onHandleMove={edit ? handleHandleMove : undefined}
        />
      </div>

      {/* Right under the viewer on purpose: these change what a click on the photo does,
          and a toggle further down the page scrolls the photo out of reach the moment
          it is pressed. */}
      {edit ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            aria-pressed={adding}
            onClick={() => setClickMode(adding ? { kind: "idle" } : { kind: "add" })}
            disabled={full && !adding}
            className={`${toolbarButton} ${adding ? "bg-amber-500/20" : ""}`}
          >
            {adding ? editDict.addModeOn : editDict.addModeOff}
          </button>
          <button type="button" onClick={addBoxAtCenter} disabled={full} className={toolbarButton}>
            {editDict.addAtCenter}
          </button>
          {preview ? (
            <button
              type="button"
              aria-pressed={!showPreview}
              onClick={() => setShowPreview((v) => !v)}
              className={toolbarButton}
            >
              {showPreview ? editDict.showOriginal : editDict.showPreview}
            </button>
          ) : null}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={showOutlines}
              onChange={(e) => setShowOutlines(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            />
            <span>{editDict.outlinesToggle}</span>
          </label>
        </div>
      ) : null}
      {/* Not a live region: the preview panel below already announces the same change. */}
      {edit && previewStale ? (
        <p className="mt-2 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          {editDict.previewStaleViewer}
        </p>
      ) : null}
      {/* What a click on the viewer will do, said out loud and on screen. */}
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-medium">
        {adding
          ? full
            ? editDict.maxBoxes.replace("{max}", String(PRIVACY_MAX_BOXES))
            : editDict.addModeStatus
          : clickMode.kind === "move"
            ? editDict.moveBoxActive.replace("{n}", String(modeIndex))
            : (sizeNote?.boxId === selectedBoxId ? sizeNote.text : "") ||
              (handles.length ? editDict.handlesHint.replace("{n}", String(selectedIndex + 1)) : "")}
      </p>

      <div className="mt-4 flex flex-col gap-6">
        <ViewLimitControls
          sceneId={sceneId}
          destinationId={destinationId}
          lang={lang}
          initialMinPitchDeg={initialMinPitchDeg}
          viewerApiRef={apiRef}
          dict={viewLimitDict}
        />
        {edit ? (
          <ImageEditPanel
            setup={edit}
            sceneId={sceneId}
            destinationId={destinationId}
            lang={lang}
            recipe={recipe}
            onRecipeChange={setRecipe}
            clickMode={clickMode}
            onClickModeChange={setClickMode}
            selectedBoxId={selectedBoxId}
            onSelectBox={setSelectedBoxId}
            onMoveBoxToCenter={moveBoxToCenter}
            preview={preview}
            onPreviewChange={setPreview}
            onShowPreviewChange={setShowPreview}
            dict={editDict}
          />
        ) : (
          <p className="rounded-lg border border-black/10 p-4 text-sm text-zinc-600 dark:border-white/15 dark:text-zinc-300">
            {editDict.videoOnly}
          </p>
        )}
      </div>
    </>
  );
}
