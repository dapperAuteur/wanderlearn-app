"use client";

import { useMemo, useState } from "react";
import { TOUR_COLOR_PRESETS, type TourColorPresetKey } from "@/lib/tour-styling";
import type { Locale } from "@/lib/locales";

type Theme = "light" | "dark";
type AccentChoice = "destination" | TourColorPresetKey;

export type EmbedSnippetGeneratorDict = {
  heading: string;
  intro: string;
  themeLabel: string;
  themeLight: string;
  themeDark: string;
  accentLabel: string;
  accentDestination: string;
  accentHelp: string;
  hideChromeLabel: string;
  hideChromeHelp: string;
  widthLabel: string;
  heightLabel: string;
  codeLabel: string;
  copyCta: string;
  copiedLabel: string;
  previewLabel: string;
  privateNotice: string;
  preset: Record<TourColorPresetKey, string>;
};

export function EmbedSnippetGenerator({
  destinationName,
  destinationSlug,
  origin,
  isPublic,
  lang,
  dict,
}: {
  destinationName: string;
  destinationSlug: string;
  origin: string;
  isPublic: boolean;
  lang: Locale;
  dict: EmbedSnippetGeneratorDict;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [accent, setAccent] = useState<AccentChoice>("destination");
  const [hideChrome, setHideChrome] = useState(false);
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("600");
  const [copied, setCopied] = useState(false);

  const embedUrl = useMemo(() => {
    const url = new URL(`${origin}/embed/tours/${destinationSlug}`);
    if (lang !== "en") url.searchParams.set("lang", lang);
    if (theme !== "light") url.searchParams.set("theme", theme);
    if (accent !== "destination") url.searchParams.set("accent", accent);
    if (hideChrome) url.searchParams.set("hidechrome", "1");
    return url.toString();
  }, [origin, destinationSlug, lang, theme, accent, hideChrome]);

  const widthAttr = /^\d+$/.test(width.trim()) ? `${width}` : width;
  const heightAttr = /^\d+$/.test(height.trim()) ? `${height}` : height;

  const snippet = useMemo(() => {
    const escapedTitle = destinationName
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
    return `<iframe
  src="${embedUrl}"
  width="${widthAttr}"
  height="${heightAttr}"
  frameborder="0"
  allow="fullscreen; gyroscope; accelerometer"
  allowfullscreen
  loading="lazy"
  title="${escapedTitle} — Wanderlearn virtual tour"
></iframe>`;
  }, [destinationName, embedUrl, widthAttr, heightAttr]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers without Clipboard API: select the textarea so the
      // user can copy manually with the keyboard.
      const ta = document.getElementById("embed-snippet-textarea") as
        | HTMLTextAreaElement
        | null;
      ta?.select();
    }
  }

  if (!isPublic) {
    return (
      <section
        aria-labelledby="embed-heading"
        className="rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h2 id="embed-heading" className="text-lg font-semibold">
          {dict.heading}
        </h2>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.privateNotice}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="embed-heading"
      className="rounded-lg border border-black/10 p-6 dark:border-white/15"
    >
      <h2 id="embed-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        {dict.intro}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{dict.themeLabel}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={theme === "light"}
              onClick={() => setTheme("light")}
              className={pillClass(theme === "light")}
            >
              {dict.themeLight}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === "dark"}
              onClick={() => setTheme("dark")}
              className={pillClass(theme === "dark")}
            >
              {dict.themeDark}
            </button>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{dict.accentLabel}</legend>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {dict.accentHelp}
          </p>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={accent === "destination"}
              onClick={() => setAccent("destination")}
              className={pillClass(accent === "destination")}
            >
              {dict.accentDestination}
            </button>
            {TOUR_COLOR_PRESETS.map((preset) => {
              const checked = accent === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={dict.preset[preset.key]}
                  title={dict.preset[preset.key]}
                  onClick={() => setAccent(preset.key)}
                  className={`flex min-h-9 min-w-9 items-center justify-center rounded-md border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                    checked
                      ? "border-current"
                      : "border-transparent hover:border-black/20 dark:hover:border-white/30"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="block h-5 w-5 rounded-full border border-black/15 dark:border-white/20"
                    style={{ backgroundColor: preset.value }}
                  />
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="embed-width" className="text-sm font-medium">
            {dict.widthLabel}
          </label>
          <input
            id="embed-width"
            type="text"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="embed-height" className="text-sm font-medium">
            {dict.heightLabel}
          </label>
          <input
            id="embed-height"
            type="text"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
          />
        </div>
      </div>

      <label className="mt-5 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={hideChrome}
          onChange={(e) => setHideChrome(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="font-medium">{dict.hideChromeLabel}</span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">
            {dict.hideChromeHelp}
          </span>
        </span>
      </label>

      <div className="mt-6">
        <p className="text-sm font-semibold">{dict.previewLabel}</p>
        <div className="mt-2 overflow-hidden rounded-md border border-black/10 dark:border-white/15">
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={`${destinationName} embed preview`}
            allow="fullscreen; gyroscope; accelerometer"
            loading="lazy"
            style={{ width: "100%", height: "360px", border: 0 }}
          />
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="embed-snippet-textarea" className="text-sm font-semibold">
          {dict.codeLabel}
        </label>
        <textarea
          id="embed-snippet-textarea"
          readOnly
          value={snippet}
          rows={6}
          className="mt-2 w-full rounded-md border border-black/15 bg-zinc-50 p-3 font-mono text-xs leading-5 dark:border-white/20 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={copy}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-5 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {copied ? dict.copiedLabel : dict.copyCta}
        </button>
      </div>
    </section>
  );
}

function pillClass(active: boolean): string {
  return `min-h-9 rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
    active
      ? "border-current bg-foreground/10"
      : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
  }`;
}
