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
  creatorLabel: string;
  destinationsLabel: string;
  mediaLabel: string;
  myCoursesLabel: string;
  adminLabel: string;
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
  ];
  if (user && canAccessCreator(role)) {
    navItems.push(
      { href: `/${lang}/creator/courses`, label: dict.myCoursesLabel },
      { href: `/${lang}/creator/destinations`, label: dict.destinationsLabel },
      { href: `/${lang}/creator/media`, label: dict.mediaLabel },
    );
  }
  if (user && role === "admin") {
    navItems.push({ href: `/${lang}/admin/users`, label: dict.adminLabel });
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        {dict.skipToContent}
      </a>
      <header className="border-b border-black/5 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-1 items-center gap-6">
            <Link
              href={`/${lang}`}
              className="text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
              aria-label={dict.brandLabel}
            >
              Wanderlearn
            </Link>
            <nav aria-label={dict.brandLabel} className="hidden items-center gap-4 text-sm sm:flex">
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
              className="hidden min-h-11 min-w-11 items-center justify-center rounded-md border border-black/10 px-3 text-sm font-medium sm:inline-flex hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:bg-white/5"
            >
              {dict.otherLanguage}
            </Link>
            {user ? (
              <>
                <span className="hidden max-w-[12rem] truncate text-sm text-zinc-600 sm:inline dark:text-zinc-400">
                  {displayName}
                </span>
                <div className="hidden sm:inline-flex">
                  <SignOutButton label={dict.signOut} lang={lang} />
                </div>
              </>
            ) : (
              <Link
                href={`/${lang}/sign-in`}
                className="hidden min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background sm:inline-flex hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
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
