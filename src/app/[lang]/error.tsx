"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

type Locale = "en" | "es";

const copy = {
  en: {
    title: "Something went wrong",
    body: "Wanderlust hit an unexpected error while rendering this page. You can try again, head back to the homepage, or report the problem to us.",
    retry: "Try again",
    home: "Go home",
    report: "Report this to support",
    reference: "Error reference",
    retryHint: "If this keeps happening, copy the reference above when you report it.",
  },
  es: {
    title: "Algo salió mal",
    body: "Wanderlust encontró un error inesperado al mostrar esta página. Puedes intentarlo de nuevo, volver al inicio o reportar el problema.",
    retry: "Intentar de nuevo",
    home: "Ir al inicio",
    report: "Reportar a soporte",
    reference: "Referencia del error",
    retryHint: "Si sigue pasando, copia la referencia de arriba cuando nos reportes.",
  },
} satisfies Record<Locale, Record<string, string>>;

export default function LocaleError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const params = useParams<{ lang: string }>();
  const lang: Locale = params.lang === "es" ? "es" : "en";
  const t = copy[lang];

  useEffect(() => {
    console.error("LocaleError boundary caught:", error);
  }, [error]);

  return (
    <main id="main"
      role="alert"
      aria-live="assertive"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-16 text-center sm:px-6"
    >
      <p
        aria-hidden="true"
        className="text-7xl font-semibold tracking-tight text-red-500/80 dark:text-red-400/80 sm:text-8xl"
      >
        500
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
      <p className="max-w-lg text-base leading-7 text-muted">{t.body}</p>

      {error.digest ? (
        <div className="mt-2 flex flex-col items-center gap-1">
          <p className="text-xs uppercase tracking-widest text-muted">
            {t.reference}
          </p>
          <code className="rounded border border-black/10 bg-black/5 px-3 py-1 font-mono text-sm dark:border-white/15 dark:bg-white/5">
            {error.digest}
          </code>
          <p className="mt-2 max-w-sm text-xs text-muted">{t.retryHint}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex min-h-12 items-center justify-center rounded-md border-2 border-brand-text bg-brand px-6 text-base font-bold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {t.retry}
        </button>
        <Link
          href={`/${lang}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {t.home}
        </Link>
        <Link
          href={`/${lang}/support`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {t.report}
        </Link>
      </div>
    </main>
  );
}
