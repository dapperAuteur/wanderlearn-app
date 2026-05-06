"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  assignMediaToDestination,
  unassignMediaFromDestination,
} from "@/lib/actions/destination-media";
import { posterUrlFor, type UploadKind } from "@/lib/cloudinary-urls";
import type { Locale } from "@/lib/locales";

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
};

export function DestinationMediaLibrary({
  lang,
  destinationId,
  hasSceneAtDestination,
  explicit,
  autoIncluded,
  assignable,
  dict,
}: {
  lang: Locale;
  destinationId: string;
  hasSceneAtDestination: boolean;
  explicit: LibraryItem[];
  autoIncluded: LibraryItem[];
  assignable: LibraryItem[];
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {explicit.map((item) => (
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
        )}
      </div>

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
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignable.map((item) => (
                <LibraryCard
                  key={item.id}
                  item={item}
                  dict={dict}
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
          )}
        </div>
      ) : null}

      <div className="mt-8">
        <h3 className="text-sm font-semibold">{dict.autoHeading}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.autoIntro}</p>
        {autoIncluded.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{dict.autoEmpty}</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {autoIncluded.map((item) => (
              <LibraryCard key={item.id} item={item} dict={dict} action={null} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LibraryCard({
  item,
  dict,
  action,
}: {
  item: LibraryItem;
  dict: Dict;
  action: React.ReactNode;
}) {
  const thumb =
    item.cloudinaryPublicId
      ? posterUrlFor(item.kind as UploadKind, item.cloudinaryPublicId, 480)
      : item.cloudinarySecureUrl;

  return (
    <li className="flex flex-col overflow-hidden rounded-md border border-black/10 dark:border-white/15">
      <div className="relative aspect-video w-full bg-black/5 dark:bg-white/5">
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
