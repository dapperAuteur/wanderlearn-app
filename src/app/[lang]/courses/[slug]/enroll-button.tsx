"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/locales";
import { enrollFreeCourse } from "@/lib/actions/enrollments";

type Dict = {
  enrollCta: string;
  enrollingLabel: string;
  errorGeneric: string;
};

export function EnrollButton({
  courseId,
  courseSlug,
  lang,
  dict,
  firstLessonSlug,
}: {
  courseId: string;
  courseSlug: string;
  lang: Locale;
  dict: Dict;
  firstLessonSlug: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("lang", lang);
    startTransition(async () => {
      const result = await enrollFreeCourse(formData);
      if (!result.ok) {
        window.alert(dict.errorGeneric);
        return;
      }
      if (firstLessonSlug) {
        router.push(`/${lang}/learn/${courseSlug}/${firstLessonSlug}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
    >
      {pending ? dict.enrollingLabel : dict.enrollCta}
    </button>
  );
}
