"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";
import {
  createHotspot,
  createSceneLink,
  deleteHotspot,
  deleteSceneLink,
  updateHotspot,
} from "@/lib/actions/hotspots";

export type HotspotForEditor = {
  id: string;
  title: string;
  contentHtml: string | null;
  externalUrl: string | null;
  yaw: number;
  pitch: number;
};

export type SceneLinkForEditor = {
  id: string;
  toSceneId: string;
  toSceneName: string;
  name: string | null;
  yaw: number | null;
  pitch: number | null;
};

export type LinkTargetOption = { id: string; name: string };

type Dict = {
  placementHint: string;
  pickOnTourCta: string;
  pickingLabel: string;
  cancelPickCta: string;
  yawLabel: string;
  pitchLabel: string;
  // hotspots
  hotspotsHeading: string;
  hotspotsIntro: string;
  hotspotsEmpty: string;
  addHotspotCta: string;
  hotspotTitleLabel: string;
  hotspotContentLabel: string;
  hotspotContentHelp: string;
  hotspotUrlLabel: string;
  hotspotUrlHelp: string;
  hotspotDeleteCta: string;
  hotspotDeletingLabel: string;
  hotspotSaveCta: string;
  hotspotSavingLabel: string;
  hotspotCancelCta: string;
  hotspotEditCta: string;
  // links
  linksHeading: string;
  linksIntro: string;
  linksEmpty: string;
  linksNoOtherScenes: string;
  addLinkCta: string;
  linkTargetLabel: string;
  linkNameLabel: string;
  linkNameHelp: string;
  linkDeleteCta: string;
  linkDeletingLabel: string;
  linkSaveCta: string;
  linkSavingLabel: string;
  linkCancelCta: string;
  // errors
  genericError: string;
  positionMissing: string;
};

type Mode =
  | { kind: "idle" }
  | { kind: "placing"; purpose: "new-hotspot" | "new-link" | { editHotspotId: string } }
  | {
      kind: "editing-hotspot";
      hotspotId: string;
      yaw: number;
      pitch: number;
      title: string;
      contentHtml: string;
      externalUrl: string;
    }
  | {
      kind: "creating-hotspot";
      yaw: number;
      pitch: number;
    }
  | {
      kind: "creating-link";
      yaw: number;
      pitch: number;
    };

export function HotspotsEditor({
  sceneId,
  destinationId,
  lang,
  tour,
  hotspots,
  links,
  linkTargets,
  dict,
}: {
  sceneId: string;
  destinationId: string;
  lang: Locale;
  tour: VirtualTourType | null;
  hotspots: HotspotForEditor[];
  links: SceneLinkForEditor[];
  linkTargets: LinkTargetOption[];
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const isPicking = mode.kind === "placing";

  function handlePositionClick(position: { yaw: number; pitch: number }) {
    if (mode.kind !== "placing") return;
    const purpose = mode.purpose;
    if (purpose === "new-hotspot") {
      setMode({ kind: "creating-hotspot", yaw: position.yaw, pitch: position.pitch });
    } else if (purpose === "new-link") {
      setMode({ kind: "creating-link", yaw: position.yaw, pitch: position.pitch });
    } else {
      const existing = hotspots.find((h) => h.id === purpose.editHotspotId);
      setMode({
        kind: "editing-hotspot",
        hotspotId: purpose.editHotspotId,
        yaw: position.yaw,
        pitch: position.pitch,
        title: existing?.title ?? "",
        contentHtml: existing?.contentHtml ?? "",
        externalUrl: existing?.externalUrl ?? "",
      });
    }
  }

  function beginEditHotspot(hotspot: HotspotForEditor) {
    setMode({
      kind: "editing-hotspot",
      hotspotId: hotspot.id,
      yaw: hotspot.yaw,
      pitch: hotspot.pitch,
      title: hotspot.title,
      contentHtml: hotspot.contentHtml ?? "",
      externalUrl: hotspot.externalUrl ?? "",
    });
  }

  function submitHotspot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode.kind !== "creating-hotspot" && mode.kind !== "editing-hotspot") return;
    const form = new FormData(event.currentTarget);
    form.set("sceneId", sceneId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    form.set("yaw", String(mode.yaw));
    form.set("pitch", String(mode.pitch));
    startTransition(async () => {
      const action =
        mode.kind === "editing-hotspot"
          ? (() => {
              form.set("id", mode.hotspotId);
              return updateHotspot(form);
            })()
          : createHotspot(form);
      const result = await action;
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      setMode({ kind: "idle" });
      router.refresh();
    });
  }

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode.kind !== "creating-link") return;
    const form = new FormData(event.currentTarget);
    form.set("fromSceneId", sceneId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    form.set("yaw", String(mode.yaw));
    form.set("pitch", String(mode.pitch));
    startTransition(async () => {
      const result = await createSceneLink(form);
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      setMode({ kind: "idle" });
      router.refresh();
    });
  }

  function removeHotspot(id: string) {
    const form = new FormData();
    form.set("id", id);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    startTransition(async () => {
      await deleteHotspot(form);
      router.refresh();
    });
  }

  function removeLink(id: string) {
    const form = new FormData();
    form.set("id", id);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    startTransition(async () => {
      await deleteSceneLink(form);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {tour ? (
        <div
          className={`overflow-hidden rounded-lg border ${
            isPicking
              ? "border-emerald-500/60 ring-2 ring-emerald-500/30"
              : "border-black/10 dark:border-white/15"
          }`}
        >
          {isPicking ? (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-wrap items-center justify-between gap-2 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200"
            >
              <span>{dict.placementHint}</span>
              <button
                type="button"
                onClick={() => setMode({ kind: "idle" })}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-emerald-700/40 bg-white/70 px-3 text-xs font-semibold text-emerald-900 hover:bg-white"
              >
                {dict.cancelPickCta}
              </button>
            </div>
          ) : null}
          <VirtualTour
            tour={tour}
            height="50vh"
            onPositionClick={isPicking ? handlePositionClick : undefined}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {mode.kind === "creating-hotspot" || mode.kind === "editing-hotspot" ? (
        <form
          onSubmit={submitHotspot}
          className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <p className="text-sm font-semibold">
            {mode.kind === "editing-hotspot"
              ? dict.hotspotEditCta
              : dict.addHotspotCta}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
            <dt>{dict.yawLabel}</dt>
            <dd>{mode.yaw.toFixed(3)}</dd>
            <dt>{dict.pitchLabel}</dt>
            <dd>{mode.pitch.toFixed(3)}</dd>
          </dl>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{dict.hotspotTitleLabel}</span>
            <input
              name="title"
              type="text"
              required
              minLength={1}
              maxLength={200}
              defaultValue={mode.kind === "editing-hotspot" ? mode.title : ""}
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{dict.hotspotContentLabel}</span>
            <textarea
              name="contentHtml"
              rows={3}
              maxLength={5000}
              defaultValue={mode.kind === "editing-hotspot" ? mode.contentHtml : ""}
              aria-describedby="hotspot-content-help"
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
            />
            <span id="hotspot-content-help" className="text-xs text-zinc-600 dark:text-zinc-400">
              {dict.hotspotContentHelp}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{dict.hotspotUrlLabel}</span>
            <input
              name="externalUrl"
              type="url"
              inputMode="url"
              maxLength={500}
              defaultValue={mode.kind === "editing-hotspot" ? mode.externalUrl : ""}
              aria-describedby="hotspot-url-help"
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
            />
            <span id="hotspot-url-help" className="text-xs text-zinc-600 dark:text-zinc-400">
              {dict.hotspotUrlHelp}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {pending ? dict.hotspotSavingLabel : dict.hotspotSaveCta}
            </button>
            <button
              type="button"
              onClick={() => setMode({ kind: "idle" })}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.hotspotCancelCta}
            </button>
          </div>
        </form>
      ) : null}

      {mode.kind === "creating-link" ? (
        <form
          onSubmit={submitLink}
          className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <p className="text-sm font-semibold">{dict.addLinkCta}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
            <dt>{dict.yawLabel}</dt>
            <dd>{mode.yaw.toFixed(3)}</dd>
            <dt>{dict.pitchLabel}</dt>
            <dd>{mode.pitch.toFixed(3)}</dd>
          </dl>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{dict.linkTargetLabel}</span>
            <select
              name="toSceneId"
              required
              defaultValue=""
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
            >
              <option value="" disabled>
                —
              </option>
              {linkTargets.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{dict.linkNameLabel}</span>
            <input
              name="name"
              type="text"
              maxLength={200}
              aria-describedby="link-name-help"
              className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
            />
            <span id="link-name-help" className="text-xs text-zinc-600 dark:text-zinc-400">
              {dict.linkNameHelp}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {pending ? dict.linkSavingLabel : dict.linkSaveCta}
            </button>
            <button
              type="button"
              onClick={() => setMode({ kind: "idle" })}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.linkCancelCta}
            </button>
          </div>
        </form>
      ) : null}

      <section aria-labelledby="hotspots-list" className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="hotspots-list" className="text-lg font-semibold">
              {dict.hotspotsHeading}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{dict.hotspotsIntro}</p>
          </div>
          <button
            type="button"
            onClick={() => setMode({ kind: "placing", purpose: "new-hotspot" })}
            disabled={!tour}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.addHotspotCta}
          </button>
        </div>
        {hotspots.length === 0 ? (
          <p className="rounded-md border border-dashed border-black/15 p-4 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.hotspotsEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {hotspots.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{h.title}</p>
                  <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {dict.yawLabel} {h.yaw.toFixed(2)} · {dict.pitchLabel} {h.pitch.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => beginEditHotspot(h)}
                    className="inline-flex min-h-9 items-center rounded-md border border-black/15 px-3 text-xs font-semibold hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                  >
                    {dict.hotspotEditCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeHotspot(h.id)}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-red-600/30 px-3 text-xs font-semibold text-red-700 hover:bg-red-600/10 dark:border-red-400/40 dark:text-red-300"
                  >
                    {pending ? dict.hotspotDeletingLabel : dict.hotspotDeleteCta}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="links-list" className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="links-list" className="text-lg font-semibold">
              {dict.linksHeading}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{dict.linksIntro}</p>
          </div>
          <button
            type="button"
            onClick={() => setMode({ kind: "placing", purpose: "new-link" })}
            disabled={!tour || linkTargets.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.addLinkCta}
          </button>
        </div>
        {linkTargets.length === 0 ? (
          <p className="rounded-md border border-dashed border-black/15 p-4 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.linksNoOtherScenes}
          </p>
        ) : links.length === 0 ? (
          <p className="rounded-md border border-dashed border-black/15 p-4 text-center text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.linksEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">→ {link.toSceneName}</p>
                  {link.name ? (
                    <p className="truncate text-xs text-zinc-600 dark:text-zinc-300">
                      {link.name}
                    </p>
                  ) : null}
                  {link.yaw !== null && link.pitch !== null ? (
                    <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {dict.yawLabel} {link.yaw.toFixed(2)} · {dict.pitchLabel} {link.pitch.toFixed(2)}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/${lang}/creator/destinations/${destinationId}/scenes/${link.toSceneId}`}
                    className="inline-flex min-h-9 items-center rounded-md border border-black/15 px-3 text-xs font-semibold hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                  >
                    →
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeLink(link.id)}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-red-600/30 px-3 text-xs font-semibold text-red-700 hover:bg-red-600/10 dark:border-red-400/40 dark:text-red-300"
                  >
                    {pending ? dict.linkDeletingLabel : dict.linkDeleteCta}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
