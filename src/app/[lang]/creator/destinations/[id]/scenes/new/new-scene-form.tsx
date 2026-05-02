"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";

type Dict = {
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
  thumbnailUrl: string | null;
};

type ActionResult =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string; code: string };

export function NewSceneForm({
  dict,
  lang,
  destinationId,
  panoramas,
  action,
}: {
  dict: Dict;
  lang: Locale;
  destinationId: string;
  panoramas: PanoramaOption[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedPanoramaId, setSelectedPanoramaId] = useState<string>(
    panoramas[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
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
  }, [panoramas, search, kindFilter, activeTags]);

  // Derive the actual radio state from the user's selection AND the visible
  // set: if filters hide the user's pick, fall back to the first visible row
  // so save stays enabled. Computed on render to avoid setState-in-effect.
  const effectiveSelectedId = visiblePanoramas.some((p) => p.id === selectedPanoramaId)
    ? selectedPanoramaId
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
          {visiblePanoramas.map((p) => (
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
                  onChange={() => setSelectedPanoramaId(p.id)}
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
