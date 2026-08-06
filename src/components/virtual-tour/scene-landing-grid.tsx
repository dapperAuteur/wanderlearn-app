import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/locales";
import type { TourScene } from "./types";

export type SceneLandingGridDict = {
  heading: string;
  intro: string;
  recommendedPill: string;
  startHereCta: string;
};

export function SceneLandingGrid({
  lang,
  destinationSlug,
  scenes,
  defaultStartSceneId,
  previewToken = null,
  dict,
}: {
  lang: Locale;
  destinationSlug: string;
  /**
   * Private-preview capability token, when the visitor arrived with one.
   * Every scene link must carry it forward — otherwise picking a scene drops
   * ?k= and the next request 404s, which is exactly what happened to the first
   * real preview link shared (2026-07-29).
   */
  previewToken?: string | null;
  scenes: TourScene[];
  defaultStartSceneId: string | null;
  dict: SceneLandingGridDict;
}) {
  // Recommended scene (if the creator set one and it survived assembly)
  // floats to the top; the rest follow in their existing tour order
  // (oldest-first by createdAt, matching what PSV navigation surfaces).
  const recommendedId =
    defaultStartSceneId && scenes.some((s) => s.id === defaultStartSceneId)
      ? defaultStartSceneId
      : null;
  const ordered = recommendedId
    ? [
        ...scenes.filter((s) => s.id === recommendedId),
        ...scenes.filter((s) => s.id !== recommendedId),
      ]
    : scenes;

  return (
    <section
      aria-labelledby="scene-landing-heading"
      className="rounded-lg border border-black/10 p-4 sm:p-6 dark:border-white/15"
    >
      <h2 id="scene-landing-heading" className="text-xl font-semibold tracking-tight">
        {dict.heading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
        {dict.intro}
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((scene) => {
          const isRecommended = scene.id === recommendedId;
          return (
            <li key={scene.id} className="contents">
              <Link
                href={`/${lang}/tours/${destinationSlug}?scene=${scene.id}${previewToken ? `&k=${encodeURIComponent(previewToken)}` : ""}`}
                aria-current={isRecommended ? "true" : undefined}
                className="group flex min-h-44 flex-col overflow-hidden rounded-lg border border-black/10 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md dark:border-white/15"
              >
                <div className="relative aspect-video w-full bg-black/5 dark:bg-white/5">
                  {scene.thumbnail ? (
                    <Image
                      src={scene.thumbnail}
                      alt={scene.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center text-3xl text-zinc-400 dark:text-zinc-600"
                    >
                      360°
                    </span>
                  )}
                  {isRecommended ? (
                    <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
                      {dict.recommendedPill}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="text-base font-semibold">{scene.name}</p>
                  {scene.caption ? (
                    <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {scene.caption}
                    </p>
                  ) : null}
                  <span className="mt-auto pt-2 text-sm font-semibold underline-offset-4 group-hover:underline">
                    {dict.startHereCta} <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
