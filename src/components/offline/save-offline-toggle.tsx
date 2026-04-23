"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";

type ActionResult =
  | { ok: true; data: { courseId: string; enabled: boolean } }
  | { ok: false; error: string; code: string };

type Dict = {
  heading: string;
  enableCta: string;
  disableCta: string;
  savingLabel: string;
  enabledLabel: string;
  progressLabel: string;
  doneLabel: string;
  failureLabel: string;
  unsupportedLabel: string;
  unsupportedHint: string;
};

export function SaveOfflineToggle({
  lang,
  courseId,
  courseSlug,
  initialEnabled,
  dict,
  action,
}: {
  lang: Locale;
  courseId: string;
  courseSlug: string;
  initialEnabled: boolean;
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [progress, setProgress] = useState<{
    cached: number;
    total: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const swSupported =
    typeof navigator !== "undefined" && "serviceWorker" in navigator;

  async function fetchManifest(): Promise<string[] | null> {
    try {
      const res = await fetch(
        `/api/offline/course-manifest?courseId=${encodeURIComponent(courseId)}&lang=${encodeURIComponent(lang)}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: true; urls: string[] };
      return body.urls;
    } catch {
      return null;
    }
  }

  async function postToSw(
    message: { type: "cache-course" | "uncache-course"; courseSlug: string; urls: string[] },
  ): Promise<void> {
    const reg = await navigator.serviceWorker.ready;
    const sw = reg.active;
    if (!sw) return;
    const channel = new MessageChannel();
    const done = new Promise<void>((resolve) => {
      channel.port1.onmessage = (ev) => {
        const data = ev.data as { type: string; cached?: number; total?: number };
        if (data.type === "cache-progress") {
          setProgress({
            cached: data.cached ?? 0,
            total: data.total ?? 0,
          });
        } else if (data.type === "cache-done" || data.type === "uncache-done") {
          resolve();
        }
      };
    });
    sw.postMessage(message, [channel.port2]);
    await done;
  }

  function onToggle(nextEnabled: boolean) {
    setNotice(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("courseId", courseId);
      formData.set("courseSlug", courseSlug);
      formData.set("enabled", nextEnabled ? "true" : "false");
      formData.set("lang", lang);
      const result = await action(formData);
      if (!result.ok) {
        setNotice(dict.failureLabel);
        return;
      }
      setEnabled(nextEnabled);
      if (!swSupported) return;

      const urls = await fetchManifest();
      if (!urls) {
        setNotice(dict.failureLabel);
        return;
      }
      setProgress({ cached: 0, total: urls.length });
      await postToSw({
        type: nextEnabled ? "cache-course" : "uncache-course",
        courseSlug,
        urls,
      });
      setProgress(null);
      setNotice(dict.doneLabel);
    });
  }

  return (
    <section
      aria-labelledby="save-offline-heading"
      className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 id="save-offline-heading" className="text-sm font-semibold">
        {dict.heading}
      </h2>
      {!swSupported ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {dict.unsupportedLabel}{" "}
          <span className="text-zinc-500">{dict.unsupportedHint}</span>
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onToggle(!enabled)}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
          >
            {pending
              ? dict.savingLabel
              : enabled
                ? dict.disableCta
                : dict.enableCta}
          </button>
          {enabled ? (
            <span className="text-sm text-emerald-700 dark:text-emerald-300">
              ✓ {dict.enabledLabel}
            </span>
          ) : null}
          {progress ? (
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              {dict.progressLabel
                .replace("{cached}", String(progress.cached))
                .replace("{total}", String(progress.total))}
            </span>
          ) : null}
          {notice ? (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {notice}
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}
