import Image from "next/image";
import { posterUrlFor, type UploadKind } from "@/lib/cloudinary";

export type MediaRow = {
  id: string;
  kind: UploadKind;
  status: "uploading" | "processing" | "ready" | "failed";
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  createdAt: Date;
};

type Dict = {
  title: string;
  emptyState: string;
  statusLabel: string;
  kindLabel: string;
  sizeLabel: string;
  createdLabel: string;
  statuses: Record<MediaRow["status"], string>;
  kinds: Record<UploadKind, string>;
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MediaLibrary({ rows, dict }: { rows: MediaRow[]; dict: Dict }) {
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
        {rows.map((row) => {
          const thumb =
            row.status === "ready" && row.cloudinaryPublicId
              ? posterUrlFor(row.kind, row.cloudinaryPublicId, 480)
              : null;
          return (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15"
            >
              {thumb ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black/5 dark:bg-white/5">
                  <Image
                    src={thumb}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="flex aspect-video w-full items-center justify-center rounded-md bg-black/5 text-xs text-zinc-500 dark:bg-white/5"
                  aria-hidden="true"
                >
                  {dict.statuses[row.status]}
                </div>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-zinc-500">{dict.kindLabel}</dt>
                <dd>{dict.kinds[row.kind]}</dd>
                <dt className="text-zinc-500">{dict.statusLabel}</dt>
                <dd>{dict.statuses[row.status]}</dd>
                <dt className="text-zinc-500">{dict.sizeLabel}</dt>
                <dd>{formatSize(row.sizeBytes)}</dd>
                <dt className="text-zinc-500">{dict.createdLabel}</dt>
                <dd>{row.createdAt.toLocaleDateString()}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
