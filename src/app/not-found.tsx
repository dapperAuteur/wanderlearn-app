import Link from "next/link";
import { defaultLocale, locales } from "@/lib/locales";

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-black/5 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={`/${defaultLocale}`}
            className="text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
          >
            Wanderlearn
          </Link>
          <nav aria-label="Quick links" className="flex items-center gap-2">
            {locales.map((l) => (
              <Link
                key={l}
                href={`/${l}`}
                hrefLang={l}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-black/10 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:bg-white/5"
              >
                {l.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>
      </header>

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
        <p className="max-w-lg text-base leading-7 text-zinc-600 dark:text-zinc-300">
          The page you were looking for doesn&apos;t exist. It may have been moved, renamed, or
          simply never existed at this URL.
        </p>
        <nav aria-label="Recover" className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${defaultLocale}`}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Go to Wanderlearn home
          </Link>
          <Link
            href={`/${defaultLocale}/courses`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            Browse courses
          </Link>
        </nav>
      </main>

      <footer className="border-t border-black/5 px-4 py-6 text-center text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-500">
        © 2026 Wanderlearn. A project by BAM / WitUS.Online.
      </footer>
    </div>
  );
}
