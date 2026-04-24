import { ImageResponse } from "next/og";
import { siteName, siteTagline } from "@/lib/site";

export const runtime = "nodejs";
export const alt = "Wanderlearn — place-based learning, captured in 360°";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Site-wide fallback OpenGraph image. Every route that doesn't declare
// its own `opengraph-image.tsx` (landing, /courses catalog, legal,
// how-it-works, etc.) renders this instead. Kept deliberately text-only
// so it never depends on external image fetches during build/request.
export default function SiteOgImage() {
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
          Place-based learning
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: -2,
            }}
          >
            {siteName}
          </div>
          <div
            style={{
              fontSize: 32,
              lineHeight: 1.3,
              color: "#d4d4d0",
              maxWidth: 1000,
            }}
          >
            {siteTagline}
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
          <span>Every lesson starts by standing inside a real place.</span>
          <span>wanderlearn.witus.online</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
