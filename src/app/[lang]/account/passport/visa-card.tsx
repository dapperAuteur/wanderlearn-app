import Link from "next/link";
import type { PassportEntry } from "@/lib/passport";

/**
 * One place, styled as a travel document rather than a content card.
 *
 * The stamped state is signalled three ways — a border weight, a label reading
 * "Stamped", and the date line — because colour alone fails WCAG 1.4.1 and
 * fails anyone reading this in bright sun on a phone, which is exactly where a
 * passport gets looked at.
 */
export function VisaCard({
  entry,
  lang,
  dict,
  stampedOnText,
}: {
  entry: PassportEntry;
  lang: string;
  dict: {
    stampedLabel: string;
    inProgressLabel: string;
    lessonsProgress: string;
    viewTourLabel: string;
  };
  /** Pre-formatted: date formatting belongs to the server component. */
  stampedOnText: string;
}) {
  const place = [entry.city, entry.country].filter(Boolean).join(", ");

  return (
    <article
      className={
        entry.stamped
          ? "rounded-lg border-2 border-brand-text p-4 sm:p-5"
          : "rounded-lg border border-line p-4 sm:p-5"
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{entry.name}</h2>
        {/*
          Not colour alone: the word itself carries the state. `font-bold`
          rather than a coloured pill so it survives a forced-colours mode.
        */}
        <span className={entry.stamped ? "text-sm font-bold" : "text-sm text-muted"}>
          {entry.stamped ? dict.stampedLabel : dict.inProgressLabel}
        </span>
      </div>

      {place ? <p className="mt-1 text-sm text-muted">{place}</p> : null}

      {entry.stamped ? <p className="mt-2 text-sm text-muted">{stampedOnText}</p> : null}

      <ul className="mt-3 flex flex-col gap-1">
        {entry.courses.map((course) => (
          <li key={course.slug} className="text-sm">
            <span>{course.title}</span>{" "}
            <span className="text-muted">
              {dict.lessonsProgress
                .replace("{completed}", String(course.lessonsCompleted))
                .replace("{total}", String(course.lessonsTotal))}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={`/${lang}/tours/${entry.slug}`}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {/* Names the place, so a screen-reader user hearing a list of links
            does not get "Open the tour" fourteen times. */}
        <span aria-hidden="true">{dict.viewTourLabel}</span>
        <span className="sr-only">{`${dict.viewTourLabel}: ${entry.name}`}</span>
      </Link>
    </article>
  );
}
