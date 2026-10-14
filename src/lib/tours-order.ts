/**
 * How /[lang]/tours orders its cards, chosen by an admin. Pure, so the ordering
 * is testable and the same in every caller.
 */
export const TOURS_ORDERS = ["name_asc", "name_desc", "created_desc", "created_asc", "custom"] as const;
export type ToursOrder = (typeof TOURS_ORDERS)[number];

/** The order the page always used before this setting existed. */
export const DEFAULT_TOURS_ORDER: ToursOrder = "created_desc";

export function isToursOrder(value: unknown): value is ToursOrder {
  return typeof value === "string" && (TOURS_ORDERS as readonly string[]).includes(value);
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Sorts tours for display. Never mutates the input. */
export function orderTours<T extends { name: string; createdAt: Date; indexPosition: number | null }>(
  tours: T[],
  order: ToursOrder,
): T[] {
  const newest = (a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime();
  const copy = [...tours];
  switch (order) {
    case "name_asc":
      return copy.sort((a, b) => collator.compare(a.name, b.name) || newest(a, b));
    case "name_desc":
      return copy.sort((a, b) => collator.compare(b.name, a.name) || newest(a, b));
    case "created_asc":
      return copy.sort((a, b) => -newest(a, b));
    case "custom":
      // Placed tours in their place; anything never placed (a tour published
      // after the admin arranged them) follows, newest first.
      return copy.sort((a, b) => {
        if (a.indexPosition === null && b.indexPosition === null) return newest(a, b);
        if (a.indexPosition === null) return 1;
        if (b.indexPosition === null) return -1;
        return a.indexPosition - b.indexPosition || newest(a, b);
      });
    case "created_desc":
    default:
      return copy.sort(newest);
  }
}
