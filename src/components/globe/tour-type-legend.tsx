export interface TourTypeLegendItem {
  type: string;
  color: string;
  label: string;
}

/**
 * The globe "key": swatch + label per active tour type present among the
 * pins. Server-rendered (plain markup) so it works without JS and reads
 * cleanly for screen readers.
 */
export function TourTypeLegend({
  items,
  heading,
}: {
  items: TourTypeLegendItem[];
  heading: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {heading}
      </h3>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {items.map((item) => (
          <li
            key={item.type}
            className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200"
          >
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/25"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
