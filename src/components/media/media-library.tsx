import { MediaLibraryRow } from "./media-library-row";
import type { UploadKind } from "@/lib/cloudinary-urls";
import type { Locale } from "@/lib/locales";

export type MediaRow = {
  id: string;
  kind: UploadKind;
  status: "uploading" | "processing" | "ready" | "failed" | "deleted";
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  displayName: string | null;
  description: string | null;
  fallbackName: string | null;
  createdAt: Date;
};

export type MediaLibraryDict = {
  title: string;
  emptyState: string;
  statusLabel: string;
  kindLabel: string;
  sizeLabel: string;
  createdLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  editCta: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  deleteCta: string;
  deletingLabel: string;
  softDeletePrompt: string;
  hardDeletePrompt: string;
  inUseHeading: string;
  inUseBody: string;
  genericError: string;
  statuses: Record<MediaRow["status"], string>;
  kinds: Record<UploadKind, string>;
};

export function MediaLibrary({
  rows,
  dict,
  lang,
}: {
  rows: MediaRow[];
  dict: MediaLibraryDict;
  lang: Locale;
}) {
  if (rows.length === 0) {
    return (
      <section aria-labelledby="media-library-heading" className="flex flex-col gap-4">
        <h2 id="media-library-heading" className="text-xl font-semibold">
          {dict.title}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{dict.emptyState}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="media-library-heading" className="flex flex-col gap-4">
      <h2 id="media-library-heading" className="text-xl font-semibold">
        {dict.title}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <MediaLibraryRow key={row.id} row={row} dict={dict} lang={lang} />
        ))}
      </ul>
    </section>
  );
}
