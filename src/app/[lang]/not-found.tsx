"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

type Locale = "en" | "es";

const copy = {
  en: {
    title: "This place isn't on the map yet",
    body: "The page you were looking for doesn't exist on Wanderlearn. It may have been moved, renamed, or never existed at this URL. Let's get you back on track.",
    goHome: "Go to Wanderlearn home",
    browseCourses: "Browse courses",
    availableIn: "Available in",
    navLabel: "Recover",
  },
  es: {
    title: "Este lugar aún no está en el mapa",
    body: "La página que buscabas no existe en Wanderlearn. Puede que se haya movido, renombrado o que nunca haya existido en esta URL. Vamos a regresarte al camino.",
    goHome: "Ir al inicio de Wanderlearn",
    browseCourses: "Ver cursos",
    availableIn: "Disponible en",
    navLabel: "Volver",
  },
} satisfies Record<Locale, Record<string, string>>;

const LOCALES: Locale[] = ["en", "es"];

export default function LocaleNotFound() {
  const params = useParams<{ lang: string }>();
  const lang: Locale = params?.lang === "es" ? "es" : "en";
  const t = copy[lang];

  return (
    <main
      role="main"
      aria-labelledby="notfound-heading"
      className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-24 text-center sm:px-6"
    >
      <p
        aria-hidden="true"
        className="text-7xl font-semibold tracking-tight text-zinc-400 dark:text-zinc-600 sm:text-8xl"
      >
        404
      </p>
      <h1 id="notfound-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t.title}
      </h1>
      <p className="max-w-lg text-base leading-7 text-zinc-600 dark:text-zinc-300">{t.body}</p>
      <nav aria-label={t.navLabel} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/${lang}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {t.goHome}
        </Link>
        <Link
          href={`/${lang}/courses`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {t.browseCourses}
        </Link>
      </nav>
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        {t.availableIn}:{" "}
        {LOCALES.map((l, i) => (
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
