import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/client";
import { hasLocale, type Locale } from "@/lib/locales";
import { getSession } from "@/lib/rbac";
import { getPassportForUser } from "@/db/queries/passport";
import { getDictionary } from "../dictionaries";
import { ExternalLinkingToggle } from "../creator/destinations/external-linking-toggle";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";
import { SessionsList, type SessionEntry } from "./sessions-list";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.account.pageTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({
  params,
}: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const session = await getSession();
  if (!session) {
    redirect(`/${lang}/sign-in?from=${encodeURIComponent(`/${lang}/account`)}`);
  }

  const dict = await getDictionary(lang);

  const reqHeaders = await nextHeaders();
  const [userRow, rawSessions, passport] = await Promise.all([
    db
      .select({
        name: schema.users.name,
        email: schema.users.email,
        locale: schema.users.locale,
        allowExternalLinkingDefault: schema.users.allowExternalLinkingDefault,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id))
      .limit(1)
      .then((rows) => rows[0]),
    auth.api.listSessions({ headers: reqHeaders }),
    getPassportForUser(session.user.id),
  ]);
  const passportCounts = passport.counts;

  if (!userRow) {
    // Session pointed at a user row that no longer exists — log out path.
    redirect(`/${lang}/sign-in`);
  }

  const currentToken = session.session.token;
  const sessions: SessionEntry[] = (rawSessions ?? []).map((s) => ({
    token: s.token,
    createdAt: new Date(s.createdAt).toISOString(),
    expiresAt: new Date(s.expiresAt).toISOString(),
    ipAddress: s.ipAddress ?? null,
    userAgent: s.userAgent ?? null,
    isCurrent: s.token === currentToken,
  }));

  // Validate the locale value we got from the DB — Better Auth allows
  // any string for additionalFields and the type widens to string.
  const rawLocale = (userRow.locale ?? "en") as Locale;
  const initialLocale: "en" | "es" = rawLocale === "es" ? "es" : "en";

  // Only creators (role >= creator) see the cross-tour opt-in toggle —
  // learners don't have destinations to link to.
  const showCrossTour =
    userRow.role === "creator" ||
    userRow.role === "teacher" ||
    userRow.role === "site_manager" ||
    userRow.role === "admin";

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.nav.brandLabel}
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {dict.account.pageTitle}
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-300">
          {dict.account.pageSubtitle}
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-6">
        {/*
          The passport sits above the account forms because it is the reason
          someone would visit this page for pleasure rather than admin. The
          summary is a link, not an inline list: the counts are cheap, the
          entries are not, and this page already runs four other queries.
        */}
        <section className="rounded-lg border-2 border-brand-text p-4 sm:p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            {dict.account.passport.pageTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {passportCounts.places > 0
              ? [
                  dict.account.passport.countsPlaces.replace(
                    "{count}",
                    String(passportCounts.places),
                  ),
                  dict.account.passport.countsStamped.replace(
                    "{count}",
                    String(passportCounts.stamped),
                  ),
                ].join(" · ")
              : dict.account.passport.summaryEmpty}
          </p>
          <Link
            href={`/${lang}/account/passport`}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.account.passport.summaryLink}
          </Link>
        </section>

        <ProfileForm
          lang={lang}
          initialName={userRow.name ?? ""}
          email={userRow.email}
          initialLocale={initialLocale}
          dict={dict.account.profile}
        />

        <PasswordForm lang={lang} dict={dict.account.password} />

        {showCrossTour ? (
          <ExternalLinkingToggle
            lang={lang}
            initial={userRow.allowExternalLinkingDefault ?? false}
            dict={dict.account.externalLinking}
          />
        ) : null}

        <SessionsList lang={lang} sessions={sessions} dict={dict.account.sessions} />
      </div>
    </main>
  );
}
