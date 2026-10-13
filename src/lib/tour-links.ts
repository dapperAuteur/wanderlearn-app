import { z } from "zod";
import { httpUrlSchema } from "./http-url";

/**
 * Tour-wide links (donate, tickets, the venue's site): set once per tour,
 * shown in the same place on every scene. Stored as one jsonb array on
 * `destinations.tour_links` so a save is a single atomic UPDATE (the
 * neon-http driver has no transactions).
 */
export type TourLink = {
  label: string;
  url: string;
  /** At most one per tour. The featured link gets its own labelled button in the viewer. */
  featured: boolean;
};

export const MAX_TOUR_LINKS = 3;
export const TOUR_LINK_LABEL_MAX = 40;

export const tourLinksSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(TOUR_LINK_LABEL_MAX),
      url: httpUrlSchema,
      featured: z.boolean(),
    }),
  )
  .max(MAX_TOUR_LINKS)
  .refine((links) => links.filter((link) => link.featured).length <= 1, {
    message: "Only one link can be featured",
  });

/** The featured link, if any, and the rest in their saved order. */
export function splitTourLinks(links: TourLink[]): { featured: TourLink | null; others: TourLink[] } {
  const featured = links.find((link) => link.featured) ?? null;
  return { featured, others: links.filter((link) => link !== featured) };
}
