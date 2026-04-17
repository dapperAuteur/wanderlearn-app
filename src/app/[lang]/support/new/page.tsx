import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/rbac";
import { hasLocale } from "@/lib/locales";
import { createSupportThread } from "@/lib/actions/support";
import { NewThreadForm } from "./new-thread-form";
import { getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/support/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.support.newTitle,
    robots: { index: false, follow: false },
  };
}

export default async function NewSupportThreadPage({
  params,
}: PageProps<"/[lang]/support/new">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const session = await getSession();
  if (!session?.user) {
    redirect(`/${lang}/sign-in?from=${encodeURIComponent(`/${lang}/support/new`)}`);
  }
  const dict = await getDictionary(lang);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/support`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.support.listTitle}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">{dict.support.newTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.support.newSubtitle}
      </p>
      <NewThreadForm lang={lang} dict={dict.support.newForm} action={createSupportThread} />
    </main>
  );
}
