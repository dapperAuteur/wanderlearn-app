import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates } from "@/lib/site";
import { getDictionary } from "../dictionaries";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/reset-password">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.auth.resetTitle,
    description: dict.auth.resetSubtitle,
    robots: { index: false, follow: false },
    alternates: {
      canonical: absoluteUrl(`/${lang}/reset-password`),
      languages: localizedAlternates("/reset-password", locales),
    },
  };
}

export default async function ResetPasswordPage({
  params,
}: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{dict.auth.resetTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.auth.resetSubtitle}
      </p>
      {/* useSearchParams needs a Suspense boundary, same as the sign-in form. */}
      <Suspense fallback={null}>
        <ResetPasswordForm
          lang={lang}
          dict={{
            passwordLabel: dict.auth.resetPasswordLabel,
            confirmLabel: dict.auth.resetConfirmLabel,
            passwordHint: dict.auth.resetPasswordHint,
            submitCta: dict.auth.resetCta,
            submitLoading: dict.auth.resetLoading,
            done: dict.auth.resetDone,
            error: dict.auth.resetError,
            mismatchError: dict.auth.resetMismatchError,
            tooShortError: dict.auth.resetTooShortError,
            invalidTokenError: dict.auth.resetInvalidTokenError,
            backToSignIn: dict.auth.backToSignIn,
            requestNewLink: dict.auth.resetRequestNewLink,
          }}
        />
      </Suspense>
    </main>
  );
}
