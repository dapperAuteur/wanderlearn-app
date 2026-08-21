import Link from "next/link";
import { getSession } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";
import { SignOutButton } from "./sign-out-button";
import { MobileNavMenu, type MobileNavItem } from "./mobile-nav-menu";

type NavDict = {
  skipToContent: string;
  brandLabel: string;
  coursesLabel: string;
  toursLabel: string;
  howItWorksLabel: string;
  helpLabel: string;
  docsLabel: string;
  creatorLabel: string;
  destinationsLabel: string;
  mediaLabel: string;
  myCoursesLabel: string;
  adminLabel: string;
  adminTourTypesLabel: string;
  accountLabel: string;
  signIn: string;
  signOut: string;
  otherLanguage: string;
  changeLanguage: string;
  openMenuLabel: string;
  closeMenuLabel: string;
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

  const navItems: MobileNavItem[] = [
    { href: `/${lang}/tours`, label: dict.toursLabel },
    { href: `/${lang}/courses`, label: dict.coursesLabel },
    { href: `/${lang}/how-it-works`, label: dict.howItWorksLabel },
    // Signed-out visitors get no support FAB, so the header is their only
    // route into the Help Center. Keep it above the role-gated links.
    { href: `/${lang}/help`, label: dict.helpLabel },
    // Help articles answer "how do I do this in the app"; /docs holds the longer
    // guides (creator, embedding, transcripts, capture kit) that partners are
    // sent to directly. Both are public, so both belong above the role gate.
    { href: `/${lang}/docs`, label: dict.docsLabel },
  ];
  if (user && canAccessCreator(role)) {
    navItems.push(
      { href: `/${lang}/creator/courses`, label: dict.myCoursesLabel },
      { href: `/${lang}/creator/destinations`, label: dict.destinationsLabel },
      { href: `/${lang}/creator/media`, label: dict.mediaLabel },
    );
  }
  if (user && role === "admin") {
    navItems.push(
      { href: `/${lang}/admin/users`, label: dict.adminLabel },
      { href: `/${lang}/admin/tour-types`, label: dict.adminTourTypesLabel },
    );
  }
  if (user) {
    navItems.push({ href: `/${lang}/account`, label: dict.accountLabel });
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        {dict.skipToContent}
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Link
              href={`/${lang}`}
              className="font-display text-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
              aria-label={dict.brandLabel}
            >
              Wanderlust
            </Link>
            {/* Inline nav starts at lg, not sm: a signed-in admin renders 10 items plus
                brand, language, display name, and sign-out in one non-wrapping row, which
                overflowed the viewport between 640px and 1024px and produced the page-level
                horizontal scroll the mobile-first launch gate forbids. The drawer covers
                everything below lg. */}
            <nav aria-label={dict.brandLabel} className="hidden items-center gap-4 text-sm lg:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/${otherLang}`}
              hrefLang={otherLang}
              aria-label={`${dict.changeLanguage}: ${dict.otherLanguage}`}
              className="hidden min-h-11 min-w-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm font-medium lg:inline-flex hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {dict.otherLanguage}
            </Link>
            {user ? (
              <>
                <Link
                  href={`/${lang}/account`}
                  aria-label={`${dict.accountLabel}: ${displayName}`}
                  className="hidden max-w-48 truncate text-sm text-muted hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current lg:inline"
                >
                  {displayName}
                </Link>
                <div className="hidden lg:inline-flex">
                  <SignOutButton label={dict.signOut} lang={lang} />
                </div>
              </>
            ) : (
              <Link
                href={`/${lang}/sign-in`}
                className="hidden min-h-11 items-center justify-center rounded-md border-2 border-brand-text bg-brand px-4 text-sm font-bold text-on-brand lg:inline-flex hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {dict.signIn}
              </Link>
            )}
            <MobileNavMenu
              lang={lang}
              otherLang={otherLang}
              items={navItems}
              signedIn={Boolean(user)}
              displayName={displayName}
              dict={{
                openMenuLabel: dict.openMenuLabel,
                closeMenuLabel: dict.closeMenuLabel,
                brandLabel: dict.brandLabel,
                signIn: dict.signIn,
                signOut: dict.signOut,
                otherLanguage: dict.otherLanguage,
                changeLanguage: dict.changeLanguage,
              }}
            />
          </div>
        </div>
      </header>
    </>
  );
}
