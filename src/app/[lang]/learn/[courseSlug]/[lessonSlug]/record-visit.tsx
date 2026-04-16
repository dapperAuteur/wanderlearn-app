"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/locales";
import { markLessonInProgress } from "@/lib/actions/lesson-progress";

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
    void markLessonInProgress(formData);
  }, [enrollmentId, lessonId, courseSlug, lang]);

  return null;
}
