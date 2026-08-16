"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";
import { MediaUploader } from "@/components/media/media-uploader";
import {
  Pager,
  usePagedOptions,
  type PickerChromeDict,
} from "@/components/media/media-picker-chrome";

type Dict = {
  uploadHereHeading: string;
  uploadHereIntro: string;
  uploadHereProcessing: string;
  nameLabel: string;
  captionLabel: string;
  captionHelp: string;
  panoramaLabel: string;
  panoramaEmptyState: string;
  panoramaUploadCta: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
  photoKindLabel: string;
  videoKindLabel: string;
  filterSearchLabel: string;
  filterSearchPlaceholder: string;
  filterScopeLabel: string;
  filterScopeThis: string;
  filterScopeUnassigned: string;
  filterScopeAll: string;
  filterKindAll: string;
  filterKindPhoto: string;
  filterKindVideo: string;
  filterTagsLabel: string;
  filterClearCta: string;
  filterNoMatches: string;
  filterCountLabel: string;
};

type KindFilter = "all" | "photo_360" | "video_360";

type PanoramaOption = {
  id: string;
  kind: "photo_360" | "video_360";
  label: string;
  originalFilename: string | null;
  tags: string[];
  inThisTour: boolean;
  inAnyTour: boolean;
  thumbnailUrl: string | null;
};

type ScopeFilter = "this" | "unassigned" | "all";

type ActionResult =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string; code: string };

export function NewSceneForm({
  dict,
  chromeDict,
  uploaderDict,
  userRole,
  lang,
  destinationId,
  panoramas,
  action,
}: {
  dict: Dict;
  chromeDict: PickerChromeDict;
  uploaderDict: React.ComponentProps<typeof MediaUploader>["dict"];
  userRole: string;
  lang: Locale;
  destinationId: string;
  panoramas: PanoramaOption[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Set when an upload finishes here. The file is not selectable straight away
  // because Cloudinary may still be processing and the list only carries `ready`
  // rows, so we remember the id and take it the moment it shows up.
  const [awaitingId, setAwaitingId] = useState<string | null>(null);
  const [selectedPanoramaId, setSelectedPanoramaId] = useState<string>(
    panoramas[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
  // Default to this tour when it has anything, otherwise the picker would open
  // empty on a brand-new destination and look broken.
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(() =>
    panoramas.some((p) => p.inThisTour) ? "this" : "all",
  );
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of panoramas) for (const t of p.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [panoramas]);

  const visiblePanoramas = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return panoramas.filter((p) => {
      if (scopeFilter === "this" && !p.inThisTour) return false;
      if (scopeFilter === "unassigned" && p.inAnyTour) return false;
      if (kindFilter !== "all" && p.kind !== kindFilter) return false;
      if (needle) {
        const haystacks = [
          p.label,
          p.originalFilename,
          ...p.tags,
        ].filter((v): v is string => Boolean(v));
        const matches = haystacks.some((h) => h.toLowerCase().includes(needle));
        if (!matches) return false;
      }
      if (activeTags.size > 0) {
        const has = p.tags.some((t) => activeTags.has(t));
        if (!has) return false;
      }
      return true;
    });
  }, [panoramas, search, kindFilter, activeTags, scopeFilter]);

  // This form already has search, kind, tag and scope filters; paging sits on
  // top of whatever they leave, so the grid stays a screenful either way.
  const paged = usePagedOptions({ options: visiblePanoramas, initiallyOpen: true });

  // A file uploaded on this page wins the selection the moment it lands in the
  // list. Derived rather than synced in an effect: the same reason the line
  // below is derived, and it keeps the "claim" logic in one expression instead
  // of a render-then-correct round trip.
  const claimedId =
    awaitingId && panoramas.some((p) => p.id === awaitingId) ? awaitingId : null;

  // Derive the actual radio state from the user's selection AND the visible
  // set: if filters hide the user's pick, fall back to the first visible row
  // so save stays enabled. Computed on render to avoid setState-in-effect.
  const preferredId = claimedId ?? selectedPanoramaId;
  const effectiveSelectedId = visiblePanoramas.some((p) => p.id === preferredId)
    ? preferredId
    : visiblePanoramas[0]?.id ?? "";

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setKindFilter("all");
    setActiveTags(new Set());
  }

  const filtersActive = search.trim() !== "" || kindFilter !== "all" || activeTags.size > 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveSelectedId) return;
    const formData = new FormData(event.currentTarget);
    formData.set("lang", lang);
    formData.set("destinationId", destinationId);
    formData.set("panoramaMediaId", effectiveSelectedId);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.push(
          `/${lang}/creator/destinations/${destinationId}/scenes/${result.data.id}?saved=created`,
        );
        router.refresh();
      } else {
        window.alert(dict.genericError);
      }
    });
  }

  if (panoramas.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-black/15 p-6 text-center dark:border-white/20">
        <p className="text-base text-zinc-700 dark:text-zinc-200">{dict.panoramaEmptyState}</p>
        <Link
          href={`/${lang}/creator/media`}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.panoramaUploadCta}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      {/* Upload in place. A creator whose panorama is not in the library yet
          would otherwise have to leave, upload, and come back to a blank form. */}
      <details className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <summary className="cursor-pointer text-base font-semibold">
          {dict.uploadHereHeading}
        </summary>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{dict.uploadHereIntro}</p>
        {awaitingId && !claimedId ? (
          <p role="status" aria-live="polite" className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
            {dict.uploadHereProcessing}
          </p>
        ) : null}
        <div className="mt-4">
          <MediaUploader
            dict={uploaderDict}
            userRole={userRole}
            allowedKinds={["photo_360", "video_360"]}
            onUploaded={(id) => setAwaitingId(id)}
          />
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium">
          {dict.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={200}
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="caption" className="text-sm font-medium">
          {dict.captionLabel}
        </label>
        <input
          id="caption"
          name="caption"
          type="text"
          maxLength={500}
          aria-describedby="caption-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="caption-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.captionHelp}
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">{dict.panoramaLabel}</legend>
        <div className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/15">
          {/* Tour scope first, above search and kind: it is the coarsest cut and the
              one that makes the list manageable at all once a creator has several
              tours. Defaults to this tour, falling back to all when the tour is
              still empty so a new destination does not open on a blank picker. */}
          <div role="group" aria-label={dict.filterScopeLabel} className="flex flex-wrap gap-2">
            {(
              [
                ["this", dict.filterScopeThis],
                ["unassigned", dict.filterScopeUnassigned],
                ["all", dict.filterScopeAll],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScopeFilter(value)}
                aria-pressed={scopeFilter === value}
                className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                  scopeFilter === value
                    ? "bg-foreground text-background"
                    : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{dict.filterSearchLabel}</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={dict.filterSearchPlaceholder}
                className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
              />
            </label>
            <div
              role="group"
              aria-label={dict.panoramaLabel}
              className="flex flex-wrap items-end gap-2"
            >
              {(
                [
                  ["all", dict.filterKindAll],
                  ["photo_360", dict.filterKindPhoto],
                  ["video_360", dict.filterKindVideo],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKindFilter(value)}
                  aria-pressed={kindFilter === value}
                  className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                    kindFilter === value
                      ? "bg-foreground text-background"
                      : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {allTags.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {dict.filterTagsLabel}
              </span>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={activeTags.has(tag)}
                    className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                      activeTags.has(tag)
                        ? "bg-foreground text-background"
                        : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span aria-live="polite" className="text-xs text-zinc-600 dark:text-zinc-300">
              {dict.filterCountLabel
                .replace("{count}", String(visiblePanoramas.length))
                .replace("{total}", String(panoramas.length))}
            </span>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-9 rounded border border-black/15 px-3 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                {dict.filterClearCta}
              </button>
            ) : null}
          </div>
        </div>
        {visiblePanoramas.length === 0 ? (
          <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300">
            {dict.filterNoMatches}
          </p>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paged.pageItems.map((p) => (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-2 ${
                  effectiveSelectedId === p.id
                    ? "border-foreground ring-2 ring-foreground/40"
                    : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
                }`}
              >
                <input
                  type="radio"
                  name="panoramaOptionRadio"
                  value={p.id}
                  checked={effectiveSelectedId === p.id}
                  onChange={() => {
                    setAwaitingId(null);
                    setSelectedPanoramaId(p.id);
                  }}
                  className="sr-only"
                />
                <div className="relative aspect-video w-full">
                  {p.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnailUrl}
                      alt=""
                      className="h-full w-full rounded-md object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-full w-full rounded-md bg-black/5 dark:bg-white/5"
                    />
                  )}
                  <span
                    className={`absolute right-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${
                      p.kind === "video_360" ? "bg-red-600/90" : "bg-blue-600/90"
                    }`}
                  >
                    {p.kind === "video_360" ? dict.videoKindLabel : dict.photoKindLabel}
                  </span>
                </div>
                <span className="truncate text-sm">{p.label}</span>
              </label>
            </li>
          ))}
        </ul>

        <Pager
          page={paged.page}
          totalPages={paged.totalPages}
          from={paged.from}
          to={paged.to}
          total={paged.total}
          setPage={paged.setPage}
          dict={chromeDict}
        />
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending || !effectiveSelectedId}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.savingLabel : dict.saveCta}
        </button>
        <Link
          href={`/${lang}/creator/destinations/${destinationId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
