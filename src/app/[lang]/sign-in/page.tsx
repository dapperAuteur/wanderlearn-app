import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/locales";
import { getDictionary } from "../dictionaries";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ params }: PageProps<"/[lang]/sign-in">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{dict.auth.signInTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.auth.signInSubtitle}
      </p>
      <Suspense fallback={null}>
        <SignInForm dict={dict.auth} lang={lang} />
      </Suspense>
    </main>
  );
}
