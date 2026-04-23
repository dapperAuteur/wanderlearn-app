"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/lib/locales";
import { markLessonCompleted } from "@/lib/actions/lesson-progress";
import { enqueueProgressWrite } from "@/lib/offline-outbox";

type Dict = {
  completeCta: string;
  completingLabel: string;
  completedLabel: string;
  errorGeneric: string;
  queuedOffline: string;
};

type Feedback =
  | { kind: "idle" }
  | { kind: "queued"; message: string }
  | { kind: "error"; message: string };

export function CompleteLessonButton({
  enrollmentId,
  lessonId,
  courseSlug,
  lang,
  alreadyCompleted,
  nextLessonSlug,
  dict,
}: {
  enrollmentId: string;
  lessonId: string;
  courseSlug: string;
  lang: Locale;
  alreadyCompleted: boolean;
  nextLessonSlug: string | null;
  dict: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });

  function onClick() {
    const formData = new FormData();
    formData.set("enrollmentId", enrollmentId);
    formData.set("lessonId", lessonId);
    formData.set("courseSlug", courseSlug);
    formData.set("lang", lang);
    setFeedback({ kind: "idle" });

    startTransition(async () => {
      let queued = false;
      try {
        const result = await markLessonCompleted(formData);
        if (!result.ok) {
          setFeedback({ kind: "error", message: dict.errorGeneric });
          return;
        }
      } catch {
        try {
          await enqueueProgressWrite({
            kind: "complete",
            enrollmentId,
            lessonId,
            courseSlug,
            lang,
            clientTimestamp: Date.now(),
          });
          queued = true;
          setFeedback({ kind: "queued", message: dict.queuedOffline });
        } catch (err) {
          console.error("[offline] failed to enqueue completion", err);
          setFeedback({ kind: "error", message: dict.errorGeneric });
          return;
        }
      }
      if (nextLessonSlug) {
        router.push(`/${lang}/learn/${courseSlug}/${nextLessonSlug}`);
      } else {
        router.push(`/${lang}/courses/${courseSlug}`);
      }
      if (!queued) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || alreadyCompleted}
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-600 px-5 text-base font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
      >
        {alreadyCompleted ? `✓ ${dict.completedLabel}` : pending ? dict.completingLabel : dict.completeCta}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={
          feedback.kind === "error"
            ? "text-sm text-red-700 dark:text-red-300"
            : feedback.kind === "queued"
              ? "text-sm text-amber-800 dark:text-amber-200"
              : "sr-only"
        }
      >
        {feedback.kind === "idle" ? "" : feedback.message}
      </p>
    </div>
  );
}
