"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";
import type { PublishViolation } from "@/lib/publish-gates";

type ActionResult =
  | { ok: true; data: { id: string; status: string } }
  | { ok: false; error: string; code: string };

type Dict = {
  violationsHeading: string;
  noViolations: string;
  approveCta: string;
  approvingLabel: string;
  unpublishCta: string;
  unpublishingLabel: string;
  noAction: string;
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

export function AdminReviewControls({
  lang,
  courseId,
  courseStatus,
  violations,
  approveAction,
  unpublishAction,
  dict,
}: {
  lang: Locale;
  courseId: string;
  courseStatus: string;
  violations: PublishViolation[];
  approveAction: (formData: FormData) => Promise<ActionResult>;
  unpublishAction: (formData: FormData) => Promise<ActionResult>;
  dict: Dict;
}) {
  const router = useRouter();
  const [pendingApprove, startApprove] = useTransition();
  const [pendingUnpublish, startUnpublish] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    action: (formData: FormData) => Promise<ActionResult>,
    starter: (cb: () => void) => void,
  ) {
    setError(null);
    const formData = new FormData();
    formData.set("lang", lang);
    formData.set("id", courseId);
    starter(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.code === "a11y_gate_failed" ? dict.gateError : dict.genericError);
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div>
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

      <div className="flex flex-wrap items-center gap-3">
        {courseStatus === "in_review" ? (
          <button
            type="button"
            onClick={() => run(approveAction, startApprove)}
            disabled={pendingApprove || violations.length > 0}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {pendingApprove ? dict.approvingLabel : dict.approveCta}
          </button>
        ) : null}
        {courseStatus === "published" || courseStatus === "in_review" ? (
          <button
            type="button"
            onClick={() => run(unpublishAction, startUnpublish)}
            disabled={pendingUnpublish}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-red-500/40 px-6 text-base font-semibold text-red-700 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:text-red-300"
          >
            {pendingUnpublish ? dict.unpublishingLabel : dict.unpublishCta}
          </button>
        ) : null}
        {courseStatus !== "in_review" && courseStatus !== "published" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{dict.noAction}</p>
        ) : null}
        {error ? (
          <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
            {error}
          </span>
        ) : null}
      </div>
    </div>
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
