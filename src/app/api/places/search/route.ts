import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupPlaces } from "@/db/queries/places";
import { ATTRIBUTION } from "@/lib/nominatim";
import { getSession } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Server-side proxy for Nominatim place search.
 *
 * THIS ROUTE EXISTS BECAUSE THE POLICY REQUIRES IT, not for convenience. The
 * OSM usage policy forbids client-side autocomplete outright, caps the whole
 * API at one request per second, requires a real identifying User-Agent, and
 * requires results to be cached. A fetch from the browser could satisfy none
 * of those: it cannot be rate-limited across visitors, cannot share a cache,
 * and cannot set a trustworthy User-Agent.
 *
 * SIGNED IN ONLY. Not because the data is sensitive — it is public map data —
 * but because an open geocoding proxy on a public domain is an invitation to
 * be used as someone else's free geocoder, and we would be the ones violating
 * the rate limit when it happened.
 *
 * The UI that calls this must be search-on-submit. Wiring it to a keystroke
 * handler would re-create the forbidden autocomplete on our own infrastructure
 * and burn the shared rate limit in a few seconds.
 */
const querySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "bad_query" }, { status: 400 });
  }

  const result = await lookupPlaces(parsed.data.q);

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      // 429 with Retry-After, so the UI can say something true rather than
      // "something went wrong". The limit is one second, globally.
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": "1" } },
      );
    }
    return NextResponse.json({ ok: false, error: result.reason }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    places: result.places,
    // Shipped with every response so a client cannot render results without
    // having been handed the attribution the ODbL licence requires.
    attribution: ATTRIBUTION,
  });
}
