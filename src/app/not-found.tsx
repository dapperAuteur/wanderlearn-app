import Link from "next/link";
import { defaultLocale, locales } from "@/lib/locales";

export default function RootNotFound() {
  return (
    <main
      role="main"
      aria-labelledby="root-notfound-heading"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-16 text-center sm:px-6"
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
      </nav>
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        Available in:{" "}
        {locales.map((l, i) => (
          <span key={l}>
            {i > 0 ? " · " : ""}
            <Link
              href={`/${l}`}
              hrefLang={l}
              className="underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {l.toUpperCase()}
            </Link>
          </span>
        ))}
      </p>
    </main>
  );
}
