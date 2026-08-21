import { ImageResponse } from "next/og";
import { getDestinationBySlug } from "@/db/queries/destinations";
import { hasLocale } from "@/lib/locales";
import { brandColors } from "@/lib/brand-colors";

export const runtime = "nodejs";
export const alt = "Wanderlearn virtual tour preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TourOgImage({
  params,
}: {
  params: { lang: string; destinationSlug: string };
}) {
  const { lang, destinationSlug } = params;
  const safeLang = hasLocale(lang) ? lang : "en";

  const destination = await getDestinationBySlug(destinationSlug);
  if (!destination || !destination.isPublic) {
    return fallback("Tour not found");
  }

  const location = [destination.city, destination.country].filter(Boolean).join(", ");
  const eyebrow =
    safeLang === "es" ? "Recorrido virtual · Wanderlearn" : "Virtual tour · Wanderlearn";

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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 1000,
            }}
          >
            {truncate(destination.name, 80)}
          </div>
          {location ? (
            <div
              style={{
                fontSize: 32,
                lineHeight: 1.3,
                color: brandColors.muted,
              }}
            >
              {truncate(location, 120)}
            </div>
          ) : null}
          {destination.description ? (
            <div
              style={{
                fontSize: 24,
                lineHeight: 1.4,
                color: brandColors.muted,
                maxWidth: 980,
              }}
            >
              {truncate(destination.description, 140)}
            </div>
          ) : null}
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
          <span>Wanderlearn</span>
          <span>wanderlust.witus.online</span>
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
