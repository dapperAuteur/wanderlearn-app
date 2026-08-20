"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkCreateScenes } from "@/lib/actions/scenes";
import {
  assignMediaToDestination,
  bulkAssignMediaToDestination,
  unassignMediaFromDestination,
} from "@/lib/actions/destination-media";
import { posterUrlFor, type UploadKind } from "@/lib/cloudinary-urls";
import type { Locale } from "@/lib/locales";
import { MediaUploader } from "@/components/media/media-uploader";
import {
  Pager,
  PickerToggle,
  usePagedOptions,
  type PickerChromeDict,
} from "@/components/media/media-picker-chrome";

type LibraryItem = {
  id: string;
  kind: string;
  displayName: string | null;
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  tags: string[];
  createdAt: Date | string;
};

type Dict = {
  heading: string;
  intro: string;
  presenceWarning: string;
  explicitHeading: string;
  explicitEmpty: string;
  autoHeading: string;
  autoIntro: string;
  autoEmpty: string;
  unassignCta: string;
  unassigningLabel: string;
  addCta: string;
  addPanelHeading: string;
  addPanelEmpty: string;
  addPanelCancel: string;
  assignCta: string;
  assigningLabel: string;
  unnamedLabel: string;
  kindLabels: Record<string, string>;
  genericError: string;
  assignSelectedCta: string;
  clearSelectionCta: string;
  selectLabel: string;
  showAssignedCta: string;
  hideAssignedCta: string;
  showAutoCta: string;
  hideAutoCta: string;
  uploadHereHeading: string;
  uploadHereIntro: string;
  uploadedAssignedLabel: string;
  uploadedNotAssignedLabel: string;
  createScenesPrompt: string;
  createScenesCta: string;
  creatingScenesLabel: string;
  dismissCta: string;
  scenesCreatedLabel: string;
};

export function DestinationMediaLibrary({
  lang,
  destinationId,
  hasSceneAtDestination,
  explicit,
  autoIncluded,
  assignable,
  dict,
  chromeDict,
  uploaderDict,
  userRole,
}: {
  lang: Locale;
  destinationId: string;
  hasSceneAtDestination: boolean;
  explicit: LibraryItem[];
  autoIncluded: LibraryItem[];
  assignable: LibraryItem[];
  dict: Dict;
  chromeDict: PickerChromeDict;
  uploaderDict: React.ComponentProps<typeof MediaUploader>["dict"];
  userRole: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Three lists on one page, each previously rendering in full. On this account
  // that is 30 assigned plus 29 auto-included plus every remaining file in the
  // library, all as <Image> tags, on the page a creator opens just to reach
  // their scenes.
  const assignedPaged = usePagedOptions<LibraryItem>({ options: explicit });
  const autoPaged = usePagedOptions<LibraryItem>({ options: autoIncluded });
  // Files uploaded on THIS page, in order. Kept so they can be assigned to the
  // destination without a round trip through the media page, and so the scene
  // offer below knows exactly which files it is talking about.
  const [justUploaded, setJustUploaded] = useState<{ id: string; kind: string }[]>([]);
  const [assignSkipped, setAssignSkipped] = useState(false);
  const [scenesCreated, setScenesCreated] = useState<number | null>(null);
  const newPanoramas = justUploaded.filter(
    (u) => u.kind === "photo_360" || u.kind === "video_360",
  );

  function onUploaded(mediaId: string, kind: string) {
    setJustUploaded((prev) =>
      prev.some((u) => u.id === mediaId) ? prev : [...prev, { id: mediaId, kind }],
    );
    // Assign it to this tour straight away. Uploading while inside a
    // destination is a statement about where the file belongs.
    const form = new FormData();
    form.set("destinationId", destinationId);
    form.set("mediaAssetId", mediaId);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await assignMediaToDestination(form);
      // A destination with no scenes yet rejects assignment by design:
      // ownership of a destination's library is proven by having contributed a
      // scene to it. That is the exact moment a creator uploads first, so it is
      // reported as a next step rather than as a failure. Creating a scene from
      // the file resolves it, and the file counts as this tour's either way.
      if (!result.ok && result.code === "no_scene_at_destination") {
        setAssignSkipped(true);
        return;
      }
      if (!result.ok) setError(dict.genericError);
      router.refresh();
    });
  }

  function createScenesFromUploads() {
    setError(null);
    startTransition(async () => {
      const result = await bulkCreateScenes({
        destinationId,
        panoramaMediaIds: newPanoramas.map((u) => u.id),
        lang: lang as "en" | "es",
      });
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      setScenesCreated(result.data.created);
      setJustUploaded([]);
      setAssignSkipped(false);
      router.refresh();
    });
  }

  const assignablePaged = usePagedOptions<LibraryItem>({
    options: assignable,
    // Already behind the Add media button, so opening that panel should show
    // the grid rather than demand a second click.
    initiallyOpen: true,
  });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runAssignSelected() {
    if (selected.size === 0) return;
    setError(null);
    const fd = new FormData();
    fd.set("destinationId", destinationId);
    fd.set("mediaAssetIds", JSON.stringify(Array.from(selected)));
    fd.set("lang", lang);
    startTransition(async () => {
      // Same server action as the media page's bulk tool — one implementation,
      // two entry points, identical skip semantics for not-ready files.
      const result = await bulkAssignMediaToDestination(fd);
      if (!result.ok) {
        setError(dict.genericError);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function runAssign(mediaAssetId: string) {
    setError(null);
    setPendingId(mediaAssetId);
    const fd = new FormData();
    fd.set("destinationId", destinationId);
    fd.set("mediaAssetId", mediaAssetId);
    fd.set("lang", lang);
    startTransition(async () => {
      const result = await assignMediaToDestination(fd);
      setPendingId(null);
      if (result.ok) {
        setAddOpen(false);
        router.refresh();
      } else {
        setError(dict.genericError);
      }
    });
  }

  function runUnassign(mediaAssetId: string) {
    setError(null);
    setPendingId(mediaAssetId);
    const fd = new FormData();
    fd.set("destinationId", destinationId);
    fd.set("mediaAssetId", mediaAssetId);
    fd.set("lang", lang);
    startTransition(async () => {
      const result = await unassignMediaFromDestination(fd);
      setPendingId(null);
      if (result.ok) {
        router.refresh();
      } else {
        setError(dict.genericError);
      }
    });
  }

  return (
    <section
      aria-labelledby="destination-media-library-heading"
      className="rounded-lg border border-black/10 p-5 dark:border-white/15"
    >
      <h2 id="destination-media-library-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      {!hasSceneAtDestination ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/40 dark:text-amber-200"
        >
          {dict.presenceWarning}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">{dict.explicitHeading}</h3>
          {hasSceneAtDestination ? (
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              disabled={pending}
              aria-expanded={addOpen}
              className="inline-flex min-h-9 items-center rounded-md border border-black/15 px-3 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.addCta}
            </button>
          ) : null}
        </div>

        {explicit.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            {dict.explicitEmpty}
          </p>
        ) : (
          <>
          <div className="mt-3">
            <PickerToggle
              open={assignedPaged.open}
              setOpen={assignedPaged.setOpen}
              count={explicit.length}
              expandCta={dict.showAssignedCta}
              collapseCta={dict.hideAssignedCta}
              dict={chromeDict}
            />
          </div>
          {!assignedPaged.open ? null : (
          <>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assignedPaged.pageItems.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                dict={dict}
                action={
                  <button
                    type="button"
                    onClick={() => runUnassign(item.id)}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-amber-500/40 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-amber-400/40 dark:text-amber-200"
                  >
                    {pendingId === item.id ? dict.unassigningLabel : dict.unassignCta}
                  </button>
                }
              />
            ))}
          </ul>
          <div className="mt-3">
            <Pager
              page={assignedPaged.page}
              totalPages={assignedPaged.totalPages}
              from={assignedPaged.from}
              to={assignedPaged.to}
              total={assignedPaged.total}
              setPage={assignedPaged.setPage}
              dict={chromeDict}
            />
          </div>
          </>
          )}
          </>
        )}
      </div>

      {/* Upload without leaving the destination. The uploader refreshes the
          route when a file reaches Ready, so it appears in Add media below. */}
      <details className="mt-6 rounded-md border border-black/10 p-4 dark:border-white/15">
        <summary className="cursor-pointer text-sm font-semibold">
          {dict.uploadHereHeading}
        </summary>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{dict.uploadHereIntro}</p>
        <div className="mt-4">
          <MediaUploader dict={uploaderDict} userRole={userRole} onUploaded={onUploaded} />
        </div>

        {justUploaded.length > 0 ? (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
            {(assignSkipped ? dict.uploadedNotAssignedLabel : dict.uploadedAssignedLabel).replace(
              "{count}",
              String(justUploaded.length),
            )}
          </p>
        ) : null}
      </details>

      {/* Offer the obvious next step rather than leaving the creator to find
          the bulk creator further down the page. Only 360 files can become
          scenes, so an upload of, say, a poster image never triggers this. */}
      {newPanoramas.length > 0 ? (
        <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium">
            {dict.createScenesPrompt.replace("{count}", String(newPanoramas.length))}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createScenesFromUploads}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
            >
              {pending
                ? dict.creatingScenesLabel
                : dict.createScenesCta.replace("{count}", String(newPanoramas.length))}
            </button>
            <button
              type="button"
              onClick={() => setJustUploaded([])}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.dismissCta}
            </button>
          </div>
        </div>
      ) : null}

      {scenesCreated !== null ? (
        <p role="status" aria-live="polite" className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          {dict.scenesCreatedLabel.replace("{count}", String(scenesCreated))}
        </p>
      ) : null}

      {addOpen ? (
        <div className="mt-6 rounded-md border border-black/10 p-4 dark:border-white/15">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">{dict.addPanelHeading}</h3>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="text-sm underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {dict.addPanelCancel}
            </button>
          </div>
          {assignable.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              {dict.addPanelEmpty}
            </p>
          ) : (
            <>
            {/* Multi-select path: tick several, one Assign. The per-card Assign
                button stays for the single-file case — ticking a checkbox to
                move one file would be worse than what this replaces. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runAssignSelected}
                disabled={pending || selected.size === 0}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
              >
                {pending ? dict.assigningLabel : dict.assignSelectedCta.replace("{count}", String(selected.size))}
              </button>
              {selected.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
                >
                  {dict.clearSelectionCta}
                </button>
              ) : null}
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignablePaged.pageItems.map((item) => (
                <LibraryCard
                  key={item.id}
                  item={item}
                  dict={dict}
                  selectable={{
                    checked: selected.has(item.id),
                    onToggle: () => toggleSelected(item.id),
                    label: dict.selectLabel,
                  }}
                  action={
                    <button
                      type="button"
                      onClick={() => runAssign(item.id)}
                      disabled={pending}
                      className="inline-flex min-h-9 items-center rounded-md bg-foreground px-3 text-xs font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
                    >
                      {pendingId === item.id ? dict.assigningLabel : dict.assignCta}
                    </button>
                  }
                />
              ))}
            </ul>
            <div className="mt-3">
              <Pager
                page={assignablePaged.page}
                totalPages={assignablePaged.totalPages}
                from={assignablePaged.from}
                to={assignablePaged.to}
                total={assignablePaged.total}
                setPage={assignablePaged.setPage}
                dict={chromeDict}
              />
            </div>
            </>
          )}
        </div>
      ) : null}

      <div className="mt-8">
        <h3 className="text-sm font-semibold">{dict.autoHeading}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.autoIntro}</p>
        {autoIncluded.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{dict.autoEmpty}</p>
        ) : (
          <>
          <div className="mt-3">
            <PickerToggle
              open={autoPaged.open}
              setOpen={autoPaged.setOpen}
              count={autoIncluded.length}
              expandCta={dict.showAutoCta}
              collapseCta={dict.hideAutoCta}
              dict={chromeDict}
            />
          </div>
          {autoPaged.open ? (
            <>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {autoPaged.pageItems.map((item) => (
                <LibraryCard key={item.id} item={item} dict={dict} action={null} />
              ))}
            </ul>
            <div className="mt-3">
              <Pager
                page={autoPaged.page}
                totalPages={autoPaged.totalPages}
                from={autoPaged.from}
                to={autoPaged.to}
                total={autoPaged.total}
                setPage={autoPaged.setPage}
                dict={chromeDict}
              />
            </div>
            </>
          ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function LibraryCard({
  item,
  dict,
  action,
  selectable,
}: {
  item: LibraryItem;
  dict: Dict;
  action: React.ReactNode;
  /** When set, the card renders a selection checkbox in its corner. */
  selectable?: { checked: boolean; onToggle: () => void; label: string };
}) {
  const thumb =
    item.cloudinaryPublicId
      ? posterUrlFor(item.kind as UploadKind, item.cloudinaryPublicId, 480)
      : item.cloudinarySecureUrl;

  return (
    <li className="flex flex-col overflow-hidden rounded-md border border-black/10 dark:border-white/15">
      <div className="relative aspect-video w-full bg-black/5 dark:bg-white/5">
        {selectable ? (
          <label className="absolute left-2 top-2 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-md bg-background/90 shadow">
            <input
              type="checkbox"
              checked={selectable.checked}
              onChange={selectable.onToggle}
              className="h-5 w-5"
            />
            <span className="sr-only">{selectable.label}</span>
          </label>
        ) : null}
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            fill
            sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold">
          {item.displayName ?? dict.unnamedLabel}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {dict.kindLabels[item.kind] ?? item.kind}
        </p>
        {action ? <div className="mt-auto">{action}</div> : null}
      </div>
    </li>
  );
}
