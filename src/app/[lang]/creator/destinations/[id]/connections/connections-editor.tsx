"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createSceneLinkPair, deleteSceneLink } from "@/lib/actions/hotspots";
import type { Locale } from "@/lib/locales";

export type ConnectionsDict = {
  title: string;
  subtitle: string;
  healthSummary: string;
  badgeStart: string;
  badgeOrphan: string;
  badgeDeadEnd: string;
  badgeUnreachable: string;
  inOutCounts: string;
  linksHeading: string;
  noOutgoing: string;
  needsPlacement: string;
  placeCta: string;
  duplicateChip: string;
  deleteCta: string;
  deletingLabel: string;
  addHeading: string;
  targetLabel: string;
  reverseLabel: string;
  addCta: string;
  addingLabel: string;
  addedBoth: string;
  addedOne: string;
  alreadyConnected: string;
  emptyState: string;
  genericError: string;
  editSceneCta: string;
};

type SceneOption = { id: string; name: string };
type LinkRow = {
  linkId: string;
  fromSceneId: string;
  toSceneId: string;
  toSceneName: string;
  name: string | null;
  placed: boolean;
};
type SceneStats = {
  sceneId: string;
  incoming: number;
  outgoing: number;
  isStart: boolean;
  isOrphan: boolean;
  isDeadEnd: boolean;
  isUnreachable: boolean;
  duplicateTargets: string[];
};

const chipClasses =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold";

/**
 * The list-based connections editor — the deliberate alternative to a
 * drag-to-connect canvas. Everything here is native controls (select, checkbox,
 * button), so the whole graph is editable by keyboard, which a canvas never is.
 */
export function ConnectionsEditor({
  lang,
  destinationId,
  scenes,
  links,
  stats,
  dict,
}: {
  lang: Locale;
  destinationId: string;
  scenes: SceneOption[];
  links: LinkRow[];
  stats: SceneStats[];
  dict: ConnectionsDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ kind: "status" | "alert"; text: string } | null>(
    null,
  );
  // Per-scene target selection for the add forms. Uncontrolled selects would
  // reset on router.refresh; a single map keeps them stable.
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [reverse, setReverse] = useState<Record<string, boolean>>({});

  // Scene numbers must match the tour-map pins exactly: both derive from the
  // same ordered scenes array the page passes down, so number N here is pin N
  // on the map. That correspondence is the whole point — it lets a creator
  // read "3 → 7" in this list and find both rooms on the floor plan.
  const numberById = new Map(scenes.map((s, i) => [s.id, i + 1]));
  const statsById = new Map(stats.map((s) => [s.sceneId, s]));
  const linksByFrom = new Map<string, LinkRow[]>();
  for (const link of links) {
    const list = linksByFrom.get(link.fromSceneId) ?? [];
    list.push(link);
    linksByFrom.set(link.fromSceneId, list);
  }

  function addConnection(event: FormEvent<HTMLFormElement>, fromSceneId: string) {
    event.preventDefault();
    const toSceneId = targets[fromSceneId] ?? "";
    if (!toSceneId) return;
    const createReverse = reverse[fromSceneId] ?? true;
    setBanner(null);
    const form = new FormData();
    form.set("fromSceneId", fromSceneId);
    form.set("toSceneId", toSceneId);
    form.set("destinationId", destinationId);
    form.set("createReverse", String(createReverse));
    form.set("lang", lang);
    startTransition(async () => {
      const result = await createSceneLinkPair(form);
      if (!result.ok) {
        setBanner({ kind: "alert", text: dict.genericError });
        return;
      }
      const { forwardId, reverseId, skippedForward, skippedReverse } = result.data;
      if (!forwardId && skippedForward && (!createReverse || skippedReverse)) {
        setBanner({ kind: "status", text: dict.alreadyConnected });
      } else if (forwardId && reverseId) {
        setBanner({ kind: "status", text: dict.addedBoth });
      } else {
        setBanner({ kind: "status", text: dict.addedOne });
      }
      router.refresh();
    });
  }

  function removeLink(linkId: string) {
    setBanner(null);
    const form = new FormData();
    form.set("id", linkId);
    form.set("destinationId", destinationId);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await deleteSceneLink(form);
      if (!result.ok) {
        setBanner({ kind: "alert", text: dict.genericError });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {banner ? (
        <p
          role={banner.kind}
          aria-live={banner.kind === "status" ? "polite" : undefined}
          className={
            banner.kind === "status"
              ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-300"
              : "rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-400"
          }
        >
          {banner.text}
        </p>
      ) : null}

      {scenes.map((scene) => {
        const s = statsById.get(scene.id);
        const outgoing = linksByFrom.get(scene.id) ?? [];
        const duplicateSet = new Set(s?.duplicateTargets ?? []);
        const seenTargets = new Set<string>();
        const otherScenes = scenes.filter((o) => o.id !== scene.id);
        return (
          <section
            key={scene.id}
            aria-labelledby={`scene-${scene.id}`}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/10 text-xs font-bold dark:bg-white/15"
                >
                  {numberById.get(scene.id)}
                </span>
                <h2 id={`scene-${scene.id}`} className="text-base font-semibold">
                  <Link
                    href={`/${lang}/creator/destinations/${destinationId}/scenes/${scene.id}/edit`}
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    {scene.name}
                  </Link>
                </h2>
                {s?.isStart ? (
                  <span className={`${chipClasses} bg-emerald-500/15 text-emerald-800 dark:text-emerald-300`}>
                    {dict.badgeStart}
                  </span>
                ) : null}
                {s?.isOrphan ? (
                  <span className={`${chipClasses} bg-amber-500/15 text-amber-900 dark:text-amber-300`}>
                    {dict.badgeOrphan}
                  </span>
                ) : null}
                {s?.isDeadEnd ? (
                  <span className={`${chipClasses} bg-amber-500/15 text-amber-900 dark:text-amber-300`}>
                    {dict.badgeDeadEnd}
                  </span>
                ) : null}
                {s?.isUnreachable ? (
                  <span className={`${chipClasses} bg-red-500/15 text-red-800 dark:text-red-300`}>
                    {dict.badgeUnreachable}
                  </span>
                ) : null}
              </div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {dict.inOutCounts
                  .replace("{in}", String(s?.incoming ?? 0))
                  .replace("{out}", String(s?.outgoing ?? 0))}
              </span>
            </div>

            <h3 className="sr-only">{dict.linksHeading}</h3>
            {outgoing.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {dict.noOutgoing}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {outgoing.map((link) => {
                  const isDuplicate =
                    duplicateSet.has(link.toSceneId) && seenTargets.has(link.toSceneId);
                  seenTargets.add(link.toSceneId);
                  return (
                    <li
                      key={link.linkId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
                    >
                      <span className="min-w-0 text-sm">
                        <span aria-hidden="true">→ </span>
                        <span className="font-medium">{numberById.get(link.toSceneId)}</span>{" "}
                        {link.toSceneName}
                        {link.name ? (
                          <span className="text-zinc-600 dark:text-zinc-400"> · {link.name}</span>
                        ) : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {isDuplicate ? (
                          <span className={`${chipClasses} bg-zinc-500/15 text-zinc-700 dark:text-zinc-300`}>
                            {dict.duplicateChip}
                          </span>
                        ) : null}
                        {!link.placed ? (
                          <Link
                            href={`/${lang}/creator/destinations/${destinationId}/scenes/${link.fromSceneId}/edit?place=${link.linkId}`}
                            className={`${chipClasses} min-h-11 items-center bg-amber-500/15 text-amber-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-amber-300`}
                          >
                            {dict.needsPlacement} {dict.placeCta}
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => removeLink(link.linkId)}
                          className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
                        >
                          {pending ? dict.deletingLabel : dict.deleteCta}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {otherScenes.length > 0 ? (
              <form
                onSubmit={(e) => addConnection(e, scene.id)}
                className="mt-3 flex flex-wrap items-end gap-3 border-t border-black/5 pt-3 dark:border-white/10"
              >
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:max-w-64">
                  <span className="font-medium">{dict.targetLabel}</span>
                  <select
                    value={targets[scene.id] ?? ""}
                    onChange={(e) =>
                      setTargets((prev) => ({ ...prev, [scene.id]: e.target.value }))
                    }
                    className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
                  >
                    <option value="">—</option>
                    {otherScenes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {numberById.get(o.id)} · {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={reverse[scene.id] ?? true}
                    onChange={(e) =>
                      setReverse((prev) => ({ ...prev, [scene.id]: e.target.checked }))
                    }
                    className="h-4 w-4"
                  />
                  {dict.reverseLabel}
                </label>
                <button
                  type="submit"
                  disabled={pending || !(targets[scene.id] ?? "")}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
                >
                  {pending ? dict.addingLabel : dict.addCta}
                </button>
              </form>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
