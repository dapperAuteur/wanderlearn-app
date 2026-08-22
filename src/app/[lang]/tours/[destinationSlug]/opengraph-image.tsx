import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getDestinationBySlug } from "@/db/queries/destinations";
import { hasLocale } from "@/lib/locales";
import { brandColors } from "@/lib/brand-colors";
import { posterUrlFor } from "@/lib/cloudinary";
import { fetchImageAsDataUri } from "@/lib/og-image-fetch";

export const runtime = "nodejs";
export const alt = "Wanderlust virtual tour preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TourOgImage({
  params,
}: {
  params: Promise<{ lang: string; destinationSlug: string }>;
}) {
  // `params` is a PROMISE here. The hand-written type said otherwise, so
  // destructuring it synchronously yielded undefined, every lookup missed, and
  // this route rendered its "not found" fallback for EVERY tour and course.
  // Silent: 200 OK, a valid PNG, just the wrong one — so every shared link and
  // social preview had been a blank card. tsc could not catch it because the
  // annotation itself was the lie.
  const { lang, destinationSlug } = await params;
  const safeLang = hasLocale(lang) ? lang : "en";

  const destination = await getDestinationBySlug(destinationSlug);
  if (!destination || !destination.isPublic) {
    return fallback("Tour not found");
  }

  const location = [destination.city, destination.country].filter(Boolean).join(", ");
  const eyebrow =
    safeLang === "es" ? "Recorrido virtual · Wanderlust" : "Virtual tour · Wanderlust";

  // The peak scene's poster, when the creator has marked one.
  //
  // This is the first OG route in the app to embed a real photograph. The
  // other three are deliberately text-only so they never depend on an external
  // fetch at request time — a sound default, and the wrong one HERE, because
  // this image is the entire point of sharing a place. A link preview showing
  // the actual view is what makes someone open it; a typographic card is what
  // makes them scroll past.
  //
  // So the fetch is opt-in and failure-tolerant: any problem resolving the
  // poster falls back to exactly the text-only card this route rendered
  // before. A share that looks plainer is a much smaller loss than a share
  // that renders nothing.
  const peakPosterUrl = await resolvePeakPoster(destination.peakSceneId);

  // Derived, not guessed. The photo occupies the right PHOTO_WIDTH of a
  // 1200px card and the card has 80px padding, so anything in the text column
  // must stop before 1200 - PHOTO_WIDTH - 80. Hardcoding a "looks about right"
  // width is how the domain ended up rendered underneath the photograph,
  // present in the markup and invisible in the picture.
  const PHOTO_WIDTH = 520;
  const PAGE_PADDING = 80;
  const textColumnMax = size.width - PHOTO_WIDTH - PAGE_PADDING * 2;

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
          position: "relative",
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
        {/*
          The key is OMITTED rather than set to undefined when there is no
          photo. Satori parses style values as strings and calls .trim() on
          them, so an explicit `undefined` throws "Cannot read properties of
          undefined" and the whole image fails to render — as a 500 on a route
          whose only job is to produce a picture.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            ...(peakPosterUrl ? { maxWidth: textColumnMax } : {}),
          }}
        >
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
        {/*
          Constrained to the text column when there is a photo. The image is
          absolutely positioned over the right 520px, so a full-width footer
          puts the domain underneath it — present in the markup, invisible in
          the picture, which is the worst of both.
        */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: 22,
            color: brandColors.muted,
            ...(peakPosterUrl ? { maxWidth: textColumnMax } : {}),
          }}
        >
          <span>Wanderlust</span>
          <span>wanderlust.witus.online</span>
        </div>

        {peakPosterUrl ? (
          // Bled off the right edge rather than boxed: a 360° capture reads as
          // a place you could step into, and a framed thumbnail reads as a
          // stock photo. Absolute so it cannot disturb the text column's
          // layout if the image is an unexpected shape.
          <img
            src={peakPosterUrl}
            alt=""
            width={PHOTO_WIDTH}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: PHOTO_WIDTH,
              height: 630,
              objectFit: "cover",
            }}
          />
        ) : null}
      </div>
    ),
    { ...size },
  );
}

/**
 * Resolve the peak scene's poster as embeddable bytes, or null.
 *
 * Two steps, both of which can legitimately come up empty: find the poster's
 * URL, then actually fetch it. Returns null rather than throwing on every
 * failure path — a missing peak, a deleted scene, media still processing, a
 * row that vanished between the destination read and this one, a URL that
 * 404s, a CDN that is slow today. The caller falls back to the text-only card.
 */
async function resolvePeakPoster(peakSceneId: string | null): Promise<string | null> {
  const url = await resolvePeakPosterUrl(peakSceneId);
  if (!url) return null;
  return fetchImageAsDataUri(url);
}

/** The DB half: peak scene → media row → poster URL. No network. */
async function resolvePeakPosterUrl(peakSceneId: string | null): Promise<string | null> {
  if (!peakSceneId) return null;
  try {
    const [scene] = await db
      .select({
        posterMediaId: schema.scenes.posterMediaId,
        panoramaMediaId: schema.scenes.panoramaMediaId,
      })
      .from(schema.scenes)
      .where(eq(schema.scenes.id, peakSceneId))
      .limit(1);
    if (!scene) return null;

    // Prefer the creator's chosen poster; fall back to the panorama itself,
    // which for an equirectangular still is a usable — if wide — image.
    const mediaId = scene.posterMediaId ?? scene.panoramaMediaId;
    if (!mediaId) return null;

    const [media] = await db
      .select({
        publicId: schema.mediaAssets.cloudinaryPublicId,
        posterPublicId: schema.mediaAssets.posterPublicId,
        status: schema.mediaAssets.status,
        kind: schema.mediaAssets.kind,
        deletedAt: schema.mediaAssets.deletedAt,
      })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, mediaId))
      .limit(1);

    // `status === "ready"` is the gate everywhere else in the app; an
    // in-flight upload must never reach a visitor, and a share card is about
    // as visitor-facing as it gets.
    if (!media || media.status !== "ready" || media.deletedAt) return null;

    const publicId = media.posterPublicId ?? media.publicId;
    if (!publicId) return null;

    return posterUrlFor(media.kind, publicId, 1040);
  } catch {
    return null;
  }
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
    {
      ...size,
      // Makes the failure DETECTABLE. This route's worst failure mode is
      // silent success: HTTP 200, a valid PNG, correct dimensions — just the
      // wrong picture. Every tour and course link previewed as "not found" for
      // months because nothing could tell the two apart without a human
      // looking at pixels.
      //
      // A header can be asserted on in a couple of lines. See
      // tests/e2e/og-images.spec.ts and plans/app-improvements/27.
      headers: { "x-og-fallback": "1" },
    },
  );
}
