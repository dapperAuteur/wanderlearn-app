import Link from "next/link";
import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";
import { defaultLocale } from "@/lib/locales";
import { getDictionary } from "./[lang]/dictionaries";

// Error pages keep the app shell (witus docs/shared-ui-ux-dx.md). This root 404 catches paths
// with no valid locale prefix (the [lang] layout calls notFound() before it renders), so it renders
// the real header (with Sign in) and footer itself, in the default locale.
export default async function RootNotFound() {
  const dict = await getDictionary(defaultLocale);
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader dict={dict.nav} lang={defaultLocale} />

      <main
        role="main"
        aria-labelledby="root-notfound-heading"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center sm:px-6"
      >
        <p
          aria-hidden="true"
          className="text-7xl font-semibold tracking-tight text-zinc-400 dark:text-zinc-600 sm:text-8xl"
        >
          404
        </p>
        <h1 id="root-notfound-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Page not found
        </h1>
        <p className="max-w-lg text-base leading-7 text-muted">
          The page you were looking for doesn&apos;t exist. It may have been moved, renamed, or
          simply never existed at this URL.
        </p>
        <nav aria-label="Recover" className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${defaultLocale}`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border-2 border-brand-text bg-brand px-6 text-base font-bold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Go to Wanderlust home
          </Link>
          <Link
            href={`/${defaultLocale}/courses`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            Browse courses
          </Link>
        </nav>
      </main>

      <AppFooter dict={dict.footer} lang={defaultLocale} />
    </div>
  );
}
