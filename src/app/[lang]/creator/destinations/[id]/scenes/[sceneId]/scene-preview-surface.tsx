"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Locale } from "@/lib/locales";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { VirtualTour, type VirtualTourViewerApi } from "@/components/virtual-tour/virtual-tour";
import { PublicShareControls } from "../../public-share-controls";
import { ScenePublishControls } from "./scene-publish-controls";
import { IconOpacityControls, type IconOpacityDict } from "./icon-opacity-controls";
import {
  HorizonRotationControls,
  type HorizonRotationDict,
} from "./horizon-rotation-controls";

type SceneStatus = "draft" | "published" | "unpublished";

export type SceneMeta = {
  id: string;
  name: string;
  caption: string | null;
  status: SceneStatus;
  rollOffsetDeg: number | null;
  sceneLinkIconOpacity: number | null;
  hotspotIconOpacity: number | null;
};

/**
 * Everything on the scene page that describes or acts on "the scene you are
 * looking at".
 *
 * This page previews the WHOLE tour, so the creator can walk from the scene in
 * the URL into any other one. Before this component existed, nothing followed
 * them: the heading, the Edit button, the publish controls and the share link
 * all stayed pinned to whichever scene the page was opened with. That is not
 * merely stale copy — it is a wrong-target hazard. The horizon slider had the
 * same defect and it meant adjusting the tilt while looking at scene B silently
 * saved it onto scene A.
 *
 * So the rule here is all-or-nothing: every control that names or mutates "this
 * scene" reads `currentSceneId`. Splitting them — a heading that follows the
 * viewer above publish controls that do not — would be worse than the original
 * bug, because the heading would vouch for the wrong target.
 */
export function ScenePreviewSurface({
  tour,
  sceneId,
  destinationId,
  destinationSlug,
  lang,
  origin,
  initialIsPublic,
  scenes,
  editCtaLabel,
  publishDict,
  shareDict,
  dict,
  opacityDict,
}: {
  tour: VirtualTourType;
  /** The scene in the URL — where the preview opens. */
  sceneId: string;
  destinationId: string;
  destinationSlug: string;
  lang: Locale;
  origin: string;
  initialIsPublic: boolean;
  scenes: SceneMeta[];
  editCtaLabel: string;
  publishDict: React.ComponentProps<typeof ScenePublishControls>["dict"];
  shareDict: React.ComponentProps<typeof PublicShareControls>["dict"];
  dict: HorizonRotationDict;
  opacityDict: IconOpacityDict;
}) {
  // Shared ref so the horizon slider can push live previews into the
  // viewer's PSV sphereCorrection while the creator drags.
  const apiRef = useRef<VirtualTourViewerApi | null>(null);

  const [currentSceneId, setCurrentSceneId] = useState(sceneId);
  const current = scenes.find((s) => s.id === currentSceneId) ?? scenes.find((s) => s.id === sceneId);

  return (
    <>
      {/* The heading changes under the reader as they walk, so announce it.
          polite, not assertive: it should not interrupt the arrival. */}
      <div
        aria-live="polite"
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {current?.name}
          </h1>
          {current?.caption ? (
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
              {current.caption}
            </p>
          ) : null}
        </div>
        <Link
          href={`/${lang}/creator/destinations/${destinationId}/scenes/${currentSceneId}/edit`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {editCtaLabel}
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        <VirtualTour
          tour={tour}
          height="60vh"
          apiRef={apiRef}
          onSceneChange={setCurrentSceneId}
        />
      </div>

      <div className="mt-6">
        {/* Keyed on the scene so each control fully resets when the creator walks
            into another room — otherwise it would show the previous scene's
            saved values as this scene's starting state. */}
        <HorizonRotationControls
          key={currentSceneId}
          sceneId={currentSceneId}
          destinationId={destinationId}
          lang={lang}
          initialRollOffsetDeg={current?.rollOffsetDeg ?? null}
          viewerApiRef={apiRef}
          dict={dict}
        />

          {/* Same keying rule as above, same reason: walking into another room
              must not leave the previous scene's values on screen as if they
              belonged to this one. */}
          <IconOpacityControls
            key={`opacity-${currentSceneId}`}
            sceneId={currentSceneId}
            destinationId={destinationId}
            lang={lang}
            initialLinkOpacity={current?.sceneLinkIconOpacity ?? null}
            initialHotspotOpacity={current?.hotspotIconOpacity ?? null}
            viewerApiRef={apiRef}
            dict={opacityDict}
          />
      </div>

      <div className="mt-8">
        <ScenePublishControls
          key={currentSceneId}
          lang={lang}
          destinationId={destinationId}
          sceneId={currentSceneId}
          status={current?.status ?? "draft"}
          dict={publishDict}
        />
      </div>

      <div className="mt-8">
        <PublicShareControls
          key={currentSceneId}
          destinationId={destinationId}
          destinationSlug={destinationSlug}
          lang={lang}
          initialIsPublic={initialIsPublic}
          sceneId={currentSceneId}
          origin={origin}
          dict={shareDict}
        />
      </div>
    </>
  );
}
