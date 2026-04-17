import Link from "next/link";
import type { Locale } from "@/lib/locales";

export function SupportFab({ lang, label }: { lang: Locale; label: string }) {
  return (
    <Link
      href={`/${lang}/support/new`}
      aria-label={label}
      className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-lg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:bottom-6 sm:right-6"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <span aria-hidden="true" className="mr-2">?</span>
      {label}
    </Link>
  );
}
