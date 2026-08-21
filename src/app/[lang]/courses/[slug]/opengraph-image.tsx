import { ImageResponse } from "next/og";
import { getPublishedCourseBySlug } from "@/db/queries/courses";
import { getCourseTranslation } from "@/db/queries/translations";
import { applyCourseTranslation, shouldTranslate } from "@/lib/translate";
import { brandColors } from "@/lib/brand-colors";
import { hasLocale } from "@/lib/locales";

export const runtime = "nodejs";
export const alt = "Wanderlust course preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function CourseOgImage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  // `params` is a PROMISE here. The hand-written type said otherwise, so
  // destructuring it synchronously yielded undefined, every lookup missed, and
  // this route rendered its "not found" fallback for EVERY tour and course.
  // Silent: 200 OK, a valid PNG, just the wrong one — so every shared link and
  // social preview had been a blank card. tsc could not catch it because the
  // annotation itself was the lie.
  const { lang, slug } = await params;
  const safeLang = hasLocale(lang) ? lang : "en";

  const baseCourse = await getPublishedCourseBySlug(slug);
  if (!baseCourse) {
    return fallback("Course not found");
  }
  const translation = shouldTranslate(safeLang, baseCourse.defaultLocale)
    ? await getCourseTranslation(baseCourse.id, safeLang)
    : null;
  const course = applyCourseTranslation(baseCourse, translation);

  const subtitle = course.subtitle?.trim() || "A place-based Wanderlust course";
  const eyebrow = safeLang === "es" ? "Aprendizaje basado en lugares" : "Place-based learning";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: brandColors.background,
          color: brandColors.foreground,
          borderBottom: `24px solid ${brandColors.brand}`,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: brandColors.brandText,
          }}
        >
          {eyebrow}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 1000,
            }}
          >
            {truncate(course.title, 90)}
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.35,
              color: brandColors.muted,
              maxWidth: 980,
            }}
          >
            {truncate(subtitle, 180)}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: 22,
            color: brandColors.muted,
          }}
        >
          <span>Wanderlust</span>
          <span>wanderlust.witus.online</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

function truncate(s: string, max: number): string {
  // Collapse whitespace first. Descriptions are markdown written in a textarea,
  // so they carry newlines and runs of spaces. Satori honours those literally,
  // which on a share card renders as words colliding and stacking on top of one
  // another — the exact image a stranger sees before deciding whether to click.
  const flat = s.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

function fallback(label: string) {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brandColors.background,
          color: brandColors.foreground,
          fontSize: 48,
          fontFamily: "sans-serif",
        }}
      >
        {label}
      </div>
    ),
    { ...size },
  );
}
