"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";
import type { PublishViolation } from "@/lib/publish-gates";

type ActionResult =
  | { ok: true; data: { id: string; status: string } }
  | { ok: false; error: string; code: string };

type Dict = {
  heading: string;
  currentStatusLabel: string;
  statuses: Record<string, string>;
  violationsHeading: string;
  noViolations: string;
  submitCta: string;
  submittingLabel: string;
  genericError: string;
  gateError: string;
  violations: {
    no_lessons: string;
    lesson_empty: string;
    video_missing_transcript: string;
    media_not_ready: string;
    media_missing: string;
  };
};

export function PublishSection({
  lang,
  courseId,
  courseStatus,
  violations,
  action,
  dict,
}: {
  lang: Locale;
  courseId: string;
  courseStatus: string;
  violations: PublishViolation[];
  action: (formData: FormData) => Promise<ActionResult>;
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    (courseStatus === "draft" || courseStatus === "unpublished") &&
    violations.length === 0;

  function onSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set("lang", lang);
    formData.set("id", courseId);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.code === "a11y_gate_failed" ? dict.gateError : dict.genericError);
      }
    });
  }

  return (
    <section
      aria-labelledby="publish-heading"
      className="mt-10 rounded-lg border border-black/10 p-5 dark:border-white/15"
    >
      <h2 id="publish-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        <span className="font-semibold">{dict.currentStatusLabel}:</span>{" "}
        {dict.statuses[courseStatus] ?? courseStatus}
      </p>

      <div className="mt-4">
        <h3 className="text-sm font-semibold">{dict.violationsHeading}</h3>
        {violations.length === 0 ? (
          <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300">
            {dict.noViolations}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {violations.map((v, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:text-amber-200"
              >
                {renderViolation(v, dict)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {courseStatus === "draft" || courseStatus === "unpublished" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending || !canSubmit}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pending ? dict.submittingLabel : dict.submitCta}
          </button>
          {error ? (
            <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function renderViolation(v: PublishViolation, dict: Dict): string {
  if (v.kind === "no_lessons") return dict.violations.no_lessons;
  if (v.kind === "lesson_empty") {
    return dict.violations.lesson_empty.replace("{lesson}", v.lessonTitle);
  }
  if (v.kind === "video_missing_transcript") {
    return dict.violations.video_missing_transcript.replace("{lesson}", v.lessonTitle);
  }
  if (v.kind === "media_not_ready") {
    return dict.violations.media_not_ready
      .replace("{lesson}", v.lessonTitle)
      .replace("{type}", v.blockType);
  }
  return dict.violations.media_missing
    .replace("{lesson}", v.lessonTitle)
    .replace("{type}", v.blockType);
}
