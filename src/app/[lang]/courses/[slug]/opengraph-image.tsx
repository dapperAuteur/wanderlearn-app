import { ImageResponse } from "next/og";
import { getPublishedCourseBySlug } from "@/db/queries/courses";
import { getCourseTranslation } from "@/db/queries/translations";
import { applyCourseTranslation, shouldTranslate } from "@/lib/translate";
import { hasLocale } from "@/lib/locales";

export const runtime = "nodejs";
export const alt = "Wanderlearn course preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function CourseOgImage({
  params,
}: {
  params: { lang: string; slug: string };
}) {
  const { lang, slug } = params;
  const safeLang = hasLocale(lang) ? lang : "en";

  const baseCourse = await getPublishedCourseBySlug(slug);
  if (!baseCourse) {
    return fallback("Course not found");
  }
  const translation = shouldTranslate(safeLang, baseCourse.defaultLocale)
    ? await getCourseTranslation(baseCourse.id, safeLang)
    : null;
  const course = applyCourseTranslation(baseCourse, translation);

  const subtitle = course.subtitle?.trim() || "A place-based Wanderlearn course";
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
          background: "linear-gradient(135deg, #0b1220 0%, #1a3a2e 100%)",
          color: "#f5f5f1",
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
            color: "#6ee7b7",
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
              color: "#d4d4d0",
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
            color: "#a3a3a0",
          }}
        >
          <span>Wanderlearn</span>
          <span>wanderlearn.witus.online</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
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
          background: "#0b1220",
          color: "#f5f5f1",
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
