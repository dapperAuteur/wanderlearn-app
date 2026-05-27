import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/locales";
import type { CrossTourTarget } from "./types";

export type NextTourCtaDict = {
  eyebrow: string;
  cta: string;
};

/**
 * Destination-level "next tour" CTA rendered below the viewer on the
 * public tour page (and the embed page, with new-tab opening to keep
 * the iframe surface intact).
 */
export function NextTourCta({
  target,
  lang,
  openInNewTab,
  dict,
}: {
  target: CrossTourTarget;
  lang: Locale;
  openInNewTab: boolean;
  dict: NextTourCtaDict;
}) {
  const href = `/${lang}/tours/${target.slug}`;
  const commonClasses =
    "group flex flex-col gap-3 overflow-hidden rounded-lg border border-black/10 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md dark:border-white/15 sm:flex-row";

  const inner = (
    <>
      {target.posterUrl ? (
        <div className="relative aspect-video w-full overflow-hidden bg-black/5 dark:bg-white/5 sm:aspect-square sm:h-auto sm:w-48 sm:shrink-0">
          <Image
            src={target.posterUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 12rem, 100vw"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {dict.eyebrow}
        </p>
        <p className="text-xl font-semibold tracking-tight">{target.name}</p>
        {target.description ? (
          <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">
            {target.description}
          </p>
        ) : null}
        <span className="mt-auto pt-2 text-sm font-semibold underline-offset-4 group-hover:underline">
          {dict.cta} <span aria-hidden="true">→</span>
        </span>
      </div>
    </>
  );

  if (openInNewTab) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={commonClasses}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={commonClasses}>
      {inner}
    </Link>
  );
}
