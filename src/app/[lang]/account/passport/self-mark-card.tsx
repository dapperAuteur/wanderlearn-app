import { RemoveMarkButton } from "./remove-mark-button";

/**
 * A place the learner added themselves.
 *
 * DELIBERATELY UNLIKE VisaCard. The earned card uses a heavy brand border and
 * the word "Stamped"; this one uses a dashed border and says "Added by you".
 * The rule is that a self-declared mark must never be mistakable for an earned
 * one — different shape, different ink, and the fact stated in words rather
 * than implied by styling, because styling alone fails for anyone who cannot
 * see it and for anyone in a forced-colours mode.
 *
 * A "want to go" that has not happened yet is drawn dashed for the same reason
 * a real passport leaves the page blank: it is an intention, not a record.
 */
export function SelfMarkCard({
  mark,
  dict,
}: {
  mark: {
    id: string;
    placeName: string | null;
    wantsToGo: boolean;
    visitedInPerson: boolean;
    visitedOn: string | null;
    isPublic: boolean;
  };
  dict: {
    selfMarkBadge: string;
    publicBadge: string;
    privateBadge: string;
    wantsToGoLabel: string;
    visitedLabel: string;
    removeLabel: string;
  };
}) {
  return (
    <article className="rounded-lg border border-dashed border-line-strong p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold tracking-tight">
          {mark.placeName ?? "—"}
        </h3>
        <span className="text-xs font-medium text-muted">{dict.selfMarkBadge}</span>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
        {mark.visitedInPerson ? (
          <li>
            {dict.visitedLabel}
            {mark.visitedOn ? ` · ${mark.visitedOn}` : ""}
          </li>
        ) : null}
        {mark.wantsToGo ? <li>{dict.wantsToGoLabel}</li> : null}
        {/* Stated in words. Someone sharing their passport should be able to
            see at a glance which rows travel with it. */}
        <li>{mark.isPublic ? dict.publicBadge : dict.privateBadge}</li>
      </ul>

      <RemoveMarkButton markId={mark.id} label={dict.removeLabel} placeName={mark.placeName} />
    </article>
  );
}
