import type { CourseRow } from "@/db/queries/courses";
import type { LessonRow } from "@/db/queries/lessons";
import type {
  ContentBlockTranslationRow,
  CourseTranslationRow,
  LessonTranslationRow,
} from "@/db/queries/translations";
import type { LessonBlockRow } from "@/components/blocks/lesson-blocks";

function pickText(translated: string | null | undefined, base: string): string {
  if (typeof translated === "string" && translated.trim().length > 0) return translated;
  return base;
}

function pickOptional(
  translated: string | null | undefined,
  base: string | null,
): string | null {
  if (typeof translated === "string" && translated.trim().length > 0) return translated;
  return base;
}

export function applyCourseTranslation(
  course: CourseRow,
  translation: CourseTranslationRow | null,
): CourseRow {
  if (!translation) return course;
  return {
    ...course,
    title: pickText(translation.title, course.title),
    subtitle: pickOptional(translation.subtitle, course.subtitle),
    description: pickOptional(translation.description, course.description),
  };
}

export function applyCoursesTranslations(
  courses: CourseRow[],
  map: Map<string, CourseTranslationRow>,
  locale: string,
): CourseRow[] {
  return courses.map((c) =>
    locale === c.defaultLocale ? c : applyCourseTranslation(c, map.get(c.id) ?? null),
  );
}

export function applyLessonTranslation(
  lesson: LessonRow,
  translation: LessonTranslationRow | null,
): LessonRow {
  if (!translation) return lesson;
  return {
    ...lesson,
    title: pickText(translation.title, lesson.title),
    summary: pickOptional(translation.summary, lesson.summary),
  };
}

export function applyLessonsTranslations(
  lessons: LessonRow[],
  map: Map<string, LessonTranslationRow>,
): LessonRow[] {
  return lessons.map((l) => applyLessonTranslation(l, map.get(l.id) ?? null));
}

export function applyBlockTranslations(
  blocks: LessonBlockRow[],
  map: Map<string, ContentBlockTranslationRow>,
): LessonBlockRow[] {
  return blocks.map((b) => {
    const translation = map.get(b.id);
    if (!translation) return b;
    return { ...b, data: translation.data };
  });
}

export function shouldTranslate(locale: string, defaultLocale: string): boolean {
  return locale !== defaultLocale;
}
