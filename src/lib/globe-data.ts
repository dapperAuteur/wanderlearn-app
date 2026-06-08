import "server-only";
import { getActiveTourTypeColors } from "@/db/queries/tour-types";
import { DEFAULT_TOUR_TYPE } from "@/lib/tour-types";
import type { GlobeMarker } from "@/components/globe/globe-explorer";
import type { TourTypeLegendItem } from "@/components/globe/tour-type-legend";

type DestinationLike = {
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  lat: string | null;
  lng: string | null;
  tourType: string | null;
};

/**
 * Build globe markers (with per-type pin colors) and the legend ("key")
 * from public destinations. Shared by /tours and the home page so both
 * resolve colors the same way. Only destinations with valid coordinates
 * become markers; the legend lists only the active types actually present.
 */
export async function buildGlobeData(
  destinations: DestinationLike[],
  typeLabels: Record<string, string>,
): Promise<{ markers: GlobeMarker[]; legend: TourTypeLegendItem[] }> {
  const { colorByType, active } = await getActiveTourTypeColors();
  const presentTypes = new Set<string>();

  const markers: GlobeMarker[] = destinations
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => {
      const typeKey = d.tourType ?? DEFAULT_TOUR_TYPE;
      presentTypes.add(typeKey);
      return {
        slug: d.slug,
        name: d.name,
        city: d.city ?? undefined,
        country: d.country ?? undefined,
        lat: Number(d.lat),
        lng: Number(d.lng),
        color: colorByType.get(typeKey),
      };
    })
    .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

  const legend: TourTypeLegendItem[] = active
    .filter((s) => presentTypes.has(s.type))
    .map((s) => ({
      type: s.type,
      color: s.color,
      label: typeLabels[s.type] ?? s.type,
    }));

  return { markers, legend };
}
