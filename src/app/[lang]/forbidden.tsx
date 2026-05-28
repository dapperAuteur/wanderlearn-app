"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

type Locale = "en" | "es";

const copy = {
  en: {
    title: "You don't have access to this page",
    body: "You're signed in, but your account doesn't have the role required for this route. Most often this is an admin-only or creator-only page that needs an account promotion. If you should have access, contact BAM and we'll fix the role on your user row.",
    goHome: "Go to Wanderlearn home",
    contactSupport: "Open a support thread",
    availableIn: "Available in",
    navLabel: "Recover",
  },
  es: {
    title: "No tienes acceso a esta página",
    body: "Has iniciado sesión, pero tu cuenta no tiene el rol necesario para esta ruta. Suele ser una página de administrador o creador que requiere promover la cuenta. Si crees que deberías tener acceso, contacta a BAM y arreglamos el rol de tu usuario.",
    goHome: "Ir al inicio de Wanderlearn",
    contactSupport: "Abrir un hilo de soporte",
    availableIn: "Disponible en",
    navLabel: "Volver",
  },
} satisfies Record<Locale, Record<string, string>>;

const LOCALES: Locale[] = ["en", "es"];

export default function LocaleForbidden() {
  const params = useParams<{ lang: string }>();
  const lang: Locale = params?.lang === "es" ? "es" : "en";
  const t = copy[lang];

  return (
    <main id="main"
      role="main"
      aria-labelledby="forbidden-heading"
      className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-24 text-center sm:px-6"
    >
      <p
        aria-hidden="true"
        className="text-7xl font-semibold tracking-tight text-zinc-400 dark:text-zinc-600 sm:text-8xl"
      >
        403
      </p>
      <h1 id="forbidden-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
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
          href={`/${lang}/support/new`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {t.contactSupport}
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
