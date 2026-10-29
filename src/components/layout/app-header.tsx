import Link from "next/link";
import { getSession } from "@/lib/rbac";
import { witusEndSessionEndpoint } from "@/lib/env";
import { localeSwitcherEnabled, type Locale } from "@/lib/locales";
import { SignOutButton, SignOutEverywhereButton } from "./sign-out-button";
import { MobileNavMenu } from "./mobile-nav-menu";
import { NavDisclosure, type NavGroup } from "./nav-disclosure";
import { ThemeToggle, type ThemeToggleDict } from "./theme-toggle";

type NavDict = {
  skipToContent: string;
  brandLabel: string;
  coursesLabel: string;
  toursLabel: string;
  howItWorksLabel: string;
  helpCenterLabel: string;
  docsLabel: string;
  browseToursLabel: string;
  myDestinationsLabel: string;
  mediaLibraryLabel: string;
  myCoursesLabel: string;
  adminUsersLabel: string;
  adminTourTypesLabel: string;
  adminCoursesLabel: string;
  adminSupportLabel: string;
  groups: { tours: string; courses: string; help: string; admin: string };
  accountLabel: string;
  supportLabel: string;
  signIn: string;
  signOut: string;
  signOutEverywhere: string;
  signOutEverywhereHelp: string;
  otherLanguage: string;
  themeToggle: ThemeToggleDict;
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

  // Grouped, not flat. A signed-in admin used to get 12 links in one row,
  // which slid under the right-hand controls at every width the row shows at
  // (the header is capped at max-w-6xl, so big monitors were no better). Each
  // group holds the public section first, then the creator's own work in it.
  const isCreator = Boolean(user) && canAccessCreator(role);
  const navGroups: NavGroup[] = [
    {
      id: "tours",
      label: dict.groups.tours,
      soloLabel: dict.toursLabel,
      items: [
        { href: `/${lang}/tours`, label: dict.browseToursLabel },
        ...(isCreator
          ? [
              { href: `/${lang}/creator/destinations`, label: dict.myDestinationsLabel },
              { href: `/${lang}/creator/media`, label: dict.mediaLibraryLabel },
            ]
          : []),
      ],
    },
    {
      id: "courses",
      label: dict.groups.courses,
      items: [
        { href: `/${lang}/courses`, label: dict.coursesLabel },
        ...(isCreator ? [{ href: `/${lang}/creator/courses`, label: dict.myCoursesLabel }] : []),
      ],
    },
    {
      // Signed-out visitors get no support FAB, so this group is their only
      // route into the Help Center. Help articles answer "how do I do this in
      // the app"; /docs holds the longer guides partners are sent to directly.
      id: "help",
      label: dict.groups.help,
      items: [
        { href: `/${lang}/how-it-works`, label: dict.howItWorksLabel },
        { href: `/${lang}/help`, label: dict.helpCenterLabel },
        { href: `/${lang}/docs`, label: dict.docsLabel },
        // /support has existed since the support-chat feature shipped and
        // nothing linked to it, which is why BAM could not find his own
        // tickets. A route with no route to it is not a feature.
        ...(user ? [{ href: `/${lang}/support`, label: dict.supportLabel }] : []),
      ],
    },
  ];
  if (user && role === "admin") {
    navGroups.push({
      id: "admin",
      label: dict.groups.admin,
      items: [
        { href: `/${lang}/admin/users`, label: dict.adminUsersLabel },
        { href: `/${lang}/admin/tour-types`, label: dict.adminTourTypesLabel },
        { href: `/${lang}/admin/courses`, label: dict.adminCoursesLabel },
        { href: `/${lang}/admin/support`, label: dict.adminSupportLabel },
      ],
    });
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
            {/* Inline nav starts at lg; the drawer covers everything below. Grouping
                keeps the row to at most four entries, so it no longer runs under the
                right-hand controls. */}
            <nav aria-label={dict.brandLabel} className="hidden items-center gap-2 text-sm lg:flex">
              {navGroups.map((group) =>
                group.items.length === 1 ? (
                  <Link
                    key={group.id}
                    href={group.items[0].href}
                    className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    {group.soloLabel ?? group.items[0].label}
                  </Link>
                ) : (
                  <NavDisclosure key={group.id} label={group.label} items={group.items} />
                ),
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {/* Hidden until Spanish is fully hand-translated — see locales.ts.
                /es still renders; this is only the way in. */}
            {/* Display preferences live together: theme beside language.
                Hidden below lg for the same reason the locale switcher is —
                the mobile menu carries both instead of crowding the bar. */}
            <div className="hidden lg:block">
              <ThemeToggle dict={dict.themeToggle} />
            </div>
            {localeSwitcherEnabled ? (
              <Link
                href={`/${otherLang}`}
                hrefLang={otherLang}
                aria-label={`${dict.changeLanguage}: ${dict.otherLanguage}`}
                className="hidden min-h-11 min-w-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm font-medium lg:inline-flex hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {dict.otherLanguage}
              </Link>
            ) : null}
            {user ? (
              <>
                <Link
                  href={`/${lang}/account`}
                  aria-label={`${dict.accountLabel}: ${displayName}`}
                  className="hidden max-w-48 truncate text-sm text-muted hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current lg:inline"
                >
                  {displayName}
                </Link>
                {/* "Sign out" is this app only; "Sign out of WitUS everywhere" sits beside it
                    and renders only when the server resolved an end-session URL (BAM,
                    2026-10-29, witus task 128 option (b)). */}
                <div className="hidden items-start gap-2 lg:inline-flex">
                  <SignOutButton label={dict.signOut} lang={lang} />
                  <SignOutEverywhereButton
                    label={dict.signOutEverywhere}
                    help={dict.signOutEverywhereHelp}
                    endSessionUrl={witusEndSessionEndpoint}
                  />
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
              groups={navGroups}
              accountHref={`/${lang}/account`}
              signedIn={Boolean(user)}
              displayName={displayName}
              // Resolved on the server; null when this app is not an ecosystem OIDC client, which
              // hides "Sign out of WitUS everywhere". See src/lib/env.ts.
              endSessionUrl={witusEndSessionEndpoint}
              dict={{
                accountLabel: dict.accountLabel,
                openMenuLabel: dict.openMenuLabel,
                closeMenuLabel: dict.closeMenuLabel,
                brandLabel: dict.brandLabel,
                signIn: dict.signIn,
                signOut: dict.signOut,
                signOutEverywhere: dict.signOutEverywhere,
                signOutEverywhereHelp: dict.signOutEverywhereHelp,
                otherLanguage: dict.otherLanguage,
                changeLanguage: dict.changeLanguage,
                themeToggle: dict.themeToggle,
              }}
            />
          </div>
        </div>
      </header>
    </>
  );
}
