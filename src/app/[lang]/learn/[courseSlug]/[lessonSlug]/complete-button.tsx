"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
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

  function onClick() {
    const formData = new FormData();
    formData.set("enrollmentId", enrollmentId);
    formData.set("lessonId", lessonId);
    formData.set("courseSlug", courseSlug);
    formData.set("lang", lang);
    startTransition(async () => {
      try {
        const result = await markLessonCompleted(formData);
        if (!result.ok) {
          window.alert(dict.errorGeneric);
          return;
        }
      } catch {
        // Network failure → queue for replay on reconnect, give the
        // learner an optimistic "queued" acknowledgement, still navigate
        // to the next lesson since the cache serves it.
        try {
          await enqueueProgressWrite({
            kind: "complete",
            enrollmentId,
            lessonId,
            courseSlug,
            lang,
            clientTimestamp: Date.now(),
          });
          window.alert(dict.queuedOffline);
        } catch (err) {
          console.error("[offline] failed to enqueue completion", err);
          window.alert(dict.errorGeneric);
          return;
        }
      }
      if (nextLessonSlug) {
        router.push(`/${lang}/learn/${courseSlug}/${nextLessonSlug}`);
      } else {
        router.push(`/${lang}/courses/${courseSlug}`);
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || alreadyCompleted}
      className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-600 px-5 text-base font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
    >
      {alreadyCompleted ? `✓ ${dict.completedLabel}` : pending ? dict.completingLabel : dict.completeCta}
    </button>
  );
}
