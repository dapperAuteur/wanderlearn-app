"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/locales";
import { markLessonInProgress } from "@/lib/actions/lesson-progress";
import { enqueueProgressWrite } from "@/lib/offline-outbox";

export function RecordLessonVisit({
  enrollmentId,
  lessonId,
  courseSlug,
  lang,
}: {
  enrollmentId: string;
  lessonId: string;
  courseSlug: string;
  lang: Locale;
}) {
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    const formData = new FormData();
    formData.set("enrollmentId", enrollmentId);
    formData.set("lessonId", lessonId);
    formData.set("courseSlug", courseSlug);
    formData.set("lang", lang);
    (async () => {
      try {
        const result = await markLessonInProgress(formData);
        if (!result.ok) {
          // Server rejected deterministically (bad input, ownership). Don't
          // queue — the outbox can't repair a permission error.
          return;
        }
      } catch {
        // Network failure → queue for replay on reconnect.
        await enqueueProgressWrite({
          kind: "start",
          enrollmentId,
          lessonId,
          courseSlug,
          lang,
          clientTimestamp: Date.now(),
        }).catch((err) => {
          console.error("[offline] failed to enqueue lesson-visit", err);
        });
      }
    })();
  }, [enrollmentId, lessonId, courseSlug, lang]);

  return null;
}
