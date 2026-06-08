import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/locales";
import { requireAdmin } from "@/lib/rbac";
import { listTourTypeSettings } from "@/db/queries/tour-types";
import { getDictionary } from "../../dictionaries";
import { TourTypeRow } from "./tour-type-row";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/tour-types">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.adminTourTypes.title,
    description: dict.adminTourTypes.subtitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminTourTypesPage({
  params,
}: PageProps<"/[lang]/admin/tour-types">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdmin(lang);
  const dict = await getDictionary(lang);

  const settings = await listTourTypeSettings();
  const labels = dict.tourTypes as Record<string, string>;
  const rowDict = {
    colorLabel: dict.adminTourTypes.colorLabel,
    sortLabel: dict.adminTourTypes.sortLabel,
    activeLabel: dict.adminTourTypes.activeLabel,
    save: dict.adminTourTypes.save,
    saving: dict.adminTourTypes.saving,
    saved: dict.adminTourTypes.saved,
    genericError: dict.adminTourTypes.genericError,
    preset: dict.adminTourTypes.preset as Record<string, string>,
  };

  return (
    <main id="main" className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {dict.adminTourTypes.title}
      </h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
        {dict.adminTourTypes.subtitle}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {settings.map((s) => (
          <TourTypeRow
            key={s.type}
            type={s.type}
            label={labels[s.type] ?? s.type}
            color={s.color}
            sortOrder={s.sortOrder}
            active={s.active}
            lang={lang}
            dict={rowDict}
          />
        ))}
      </div>
    </main>
  );
}
