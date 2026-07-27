import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates } from "@/lib/site";
import { getDictionary } from "../dictionaries";
import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/forgot-password">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.auth.forgotTitle,
    description: dict.auth.forgotSubtitle,
    // Same posture as /sign-in: an auth surface has no business in the index.
    robots: { index: false, follow: true },
    alternates: {
      canonical: absoluteUrl(`/${lang}/forgot-password`),
      languages: localizedAlternates("/forgot-password", locales),
    },
  };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{dict.auth.forgotTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.auth.forgotSubtitle}
      </p>
      <ForgotPasswordForm
        lang={lang}
        dict={{
          emailLabel: dict.auth.emailLabel,
          submitCta: dict.auth.forgotCta,
          submitLoading: dict.auth.forgotLoading,
          sent: dict.auth.forgotSent,
          error: dict.auth.forgotError,
          emailRequiredError: dict.auth.emailRequiredError,
          backToSignIn: dict.auth.backToSignIn,
        }}
      />
    </main>
  );
}
