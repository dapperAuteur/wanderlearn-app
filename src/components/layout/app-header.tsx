import Link from "next/link";
import { getSession } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";
import { SignOutButton } from "./sign-out-button";

type NavDict = {
  skipToContent: string;
  brandLabel: string;
  coursesLabel: string;
  howItWorksLabel: string;
  creatorLabel: string;
  destinationsLabel: string;
  mediaLabel: string;
  adminLabel: string;
  signIn: string;
  signOut: string;
  otherLanguage: string;
  changeLanguage: string;
};

type UserRole = "learner" | "creator" | "teacher" | "admin";

function canAccessCreator(role: UserRole): boolean {
  return role === "creator" || role === "teacher" || role === "admin";
}

export async function AppHeader({ dict, lang }: { dict: NavDict; lang: Locale }) {
  const session = await getSession();
  const user = session?.user;
  const role = (user as { role?: UserRole } | undefined)?.role ?? "learner";
  const displayName = (user as { name?: string | null } | undefined)?.name ?? user?.email ?? "";
  const otherLang: Locale = lang === "en" ? "es" : "en";

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        {dict.skipToContent}
      </a>
      <header className="border-b border-black/5 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href={`/${lang}`}
              className="text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
              aria-label={dict.brandLabel}
            >
              Wanderlearn
            </Link>
            <nav aria-label={dict.brandLabel} className="hidden items-center gap-4 text-sm sm:flex">
              <Link
                href={`/${lang}/courses`}
                className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {dict.coursesLabel}
              </Link>
              <Link
                href={`/${lang}/how-it-works`}
                className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {dict.howItWorksLabel}
              </Link>
              {user && canAccessCreator(role) ? (
                <>
                  <Link
                    href={`/${lang}/creator/destinations`}
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    {dict.destinationsLabel}
                  </Link>
                  <Link
                    href={`/${lang}/creator/media`}
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    {dict.mediaLabel}
                  </Link>
                </>
              ) : null}
              {user && role === "admin" ? (
                <Link
                  href={`/${lang}/admin/users`}
                  className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {dict.adminLabel}
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${otherLang}`}
              hrefLang={otherLang}
              aria-label={`${dict.changeLanguage}: ${dict.otherLanguage}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-black/10 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:bg-white/5"
            >
              {dict.otherLanguage}
            </Link>
            {user ? (
              <>
                <span className="hidden max-w-[12rem] truncate text-sm text-zinc-600 sm:inline dark:text-zinc-400">
                  {displayName}
                </span>
                <SignOutButton label={dict.signOut} lang={lang} />
              </>
            ) : (
              <Link
                href={`/${lang}/sign-in`}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {dict.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
