import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "@/lib/locales";
import { getSession } from "@/lib/rbac";
import { getPassportForUser } from "@/db/queries/passport";
import { listMarksForUser } from "@/db/queries/places";
import { ATTRIBUTION } from "@/lib/nominatim";
import { getDictionary } from "../../dictionaries";
import { VisaCard } from "./visa-card";
import { AddPlace } from "./add-place";
import { SelfMarkCard } from "./self-mark-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/passport">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.account.passport.pageTitle,
    // Someone's record of where they have been is nobody else's business, and
    // the rest of /account is already noindex for the same reason.
    robots: { index: false, follow: false },
  };
}

/**
 * The learner's passport: one row per PLACE, with the stamps it has earned.
 *
 * WHY A PLACE AND NOT A COURSE. Two courses about the same museum are one
 * entry with two lines under it. A passport that listed the museum twice would
 * read as two visits, and an inflated record discredits every other number on
 * the page.
 *
 * WHAT A STAMP MEANS TODAY. Nothing in the schema joins a user to a tour —
 * tours are viewed signed-out by design — so "toured here" is not a fact we
 * hold. What we do hold is which courses someone finished and which place each
 * course is built around. The stamp says you completed the course about this
 * place. Narrower than "you toured here", and true.
 */
export default async function PassportPage({ params }: PageProps<"/[lang]/account/passport">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const session = await getSession();
  if (!session) {
    redirect(`/${lang}/sign-in?from=${encodeURIComponent(`/${lang}/account/passport`)}`);
  }

  const dict = await getDictionary(lang);
  const d = dict.account.passport;
  const [passport, marks] = await Promise.all([
    getPassportForUser(session.user.id),
    listMarksForUser(session.user.id),
  ]);

  const fmt = new Intl.DateTimeFormat(lang, { year: "numeric", month: "short", day: "numeric" });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={`/${lang}/account`}
        className="inline-flex min-h-11 items-center text-sm text-muted underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {d.backToAccount}
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{d.pageTitle}</h1>
      <p className="mt-2 text-base text-muted">{d.pageSubtitle}</p>

      {passport.entries.length > 0 ? (
        <>
          {/*
            Three facts about the same rows, never a single total. A number
            that added places to stamps would look authoritative and mean
            nothing. Rendered as a list so a screen reader announces three
            separate values rather than one run-on sentence.
          */}
          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <li>{d.countsPlaces.replace("{count}", String(passport.counts.places))}</li>
            <li aria-hidden="true">·</li>
            <li>{d.countsStamped.replace("{count}", String(passport.counts.stamped))}</li>
            {passport.counts.inProgress > 0 ? (
              <>
                <li aria-hidden="true">·</li>
                <li>
                  {d.countsInProgress.replace("{count}", String(passport.counts.inProgress))}
                </li>
              </>
            ) : null}
          </ul>

          <ul className="mt-8 flex flex-col gap-4">
            {passport.entries.map((entry) => (
              <li key={entry.destinationId}>
                <VisaCard
                  entry={entry}
                  lang={lang}
                  dict={d}
                  stampedOnText={
                    entry.stampedAt
                      ? d.stampedOn.replace("{date}", fmt.format(entry.stampedAt))
                      : d.stampedDateUnknown
                  }
                />
              </li>
            ))}
          </ul>
        </>
      ) : marks.length > 0 ? null : (
        // Empty is an invitation, not a failure. It names the one action that
        // fills it rather than leaving a blank page.
        <div className="mt-10 rounded-lg border border-line p-6">
          <h2 className="text-lg font-semibold">{d.emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted">{d.emptyBody}</p>
          <Link
            href={`/${lang}/courses`}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border-2 border-brand-text bg-brand px-4 text-sm font-bold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {d.emptyCta}
          </Link>
        </div>
      )}
      {marks.length > 0 ? (
        <>
          {/*
            Self-declared marks live in their OWN list under their own heading,
            not mixed into the earned entries above. Interleaving them would
            make the two kinds look equivalent, which is exactly the confusion
            the design has to prevent: a mark you gave yourself must never read
            as a stamp you earned.
          */}
          <h2 className="mt-10 text-xl font-semibold tracking-tight">{d.selfHeading}</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {marks.map((mark) => (
              <li key={mark.id}>
                <SelfMarkCard
                  mark={{
                    id: mark.id,
                    placeName: mark.placeName,
                    wantsToGo: mark.wantsToGo,
                    visitedInPerson: mark.visitedInPerson,
                    visitedOn: mark.visitedOn,
                    isPublic: mark.isPublic,
                  }}
                  dict={dict.account.places}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-10">
        <AddPlace dict={dict.account.places} attribution={ATTRIBUTION} />
      </div>
    </main>
  );
}
