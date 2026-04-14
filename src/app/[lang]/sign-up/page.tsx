import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/locales";
import { getDictionary } from "../dictionaries";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage({ params }: PageProps<"/[lang]/sign-up">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{dict.auth.signUpTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.auth.signUpSubtitle}
      </p>
      <SignUpForm dict={dict.auth} lang={lang} />
    </main>
  );
}
