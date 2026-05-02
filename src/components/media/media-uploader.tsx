"use client";

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type Kind =
  | "image"
  | "audio"
  | "standard_video"
  | "photo_360"
  | "video_360"
  | "drone_video"
  | "transcript"
  | "screenshot"
  | "screen_recording";

type Dict = {
  label: string;
  kindLabel: string;
  fileLabel: string;
  uploadCta: string;
  uploadingLabel: string;
  progressLabel: string;
  errorLabel: string;
  networkError: string;
  successLabel: string;
  batchHint: string;
  batchTooLarge: string;
  kindMismatch: string;
  queueLabel: string;
  rowCancel: string;
  rowRetry: string;
  rowRemove: string;
  statusQueued: string;
  statusUploading: string;
  statusDone: string;
  statusError: string;
  statusCancelled: string;
  statusKindMismatch: string;
  kinds: Record<Kind, string>;
};

type SignedFile = {
  mediaId: string;
  cloudName: string;
  apiKey: string;
  resourceType: "image" | "video" | "raw";
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  context: string;
  uploadUrl: string;
};

type SignResponse = {
  ok: boolean;
  data?: SignedFile[];
  error?: string;
};

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
};

type RowStatus =
  | "queued"
  | "uploading"
  | "done"
  | "error"
  | "cancelled"
  | "kind_mismatch";

type Row = {
  rowId: string;
  file: File;
  mediaId: string | null;
  status: RowStatus;
  progress: number;
  errorMessage: string | null;
  signed: SignedFile | null;
};

const KINDS: Kind[] = [
  "image",
  "photo_360",
  "audio",
  "standard_video",
  "video_360",
  "drone_video",
  "transcript",
];

const ADMIN_BATCH_LIMIT = 10;
const DEFAULT_BATCH_LIMIT = 5;
const CONCURRENCY = 2;

export function MediaUploader({ dict, userRole }: { dict: Dict; userRole: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [kind, setKind] = useState<Kind>("image");
  const [rows, setRows] = useState<Row[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const xhrsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const inFlightRef = useRef(0);
  const batchLimit = userRole === "admin" ? ADMIN_BATCH_LIMIT : DEFAULT_BATCH_LIMIT;

  const updateRow = useCallback((rowId: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }, []);

  function onSelect(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      setRows([]);
      setBatchError(null);
      return;
    }
    const picked = Array.from(fileList);
    if (picked.length > batchLimit) {
      setBatchError(
        dict.batchTooLarge
          .replace("{count}", String(picked.length))
          .replace("{limit}", String(batchLimit)),
      );
      setRows([]);
      event.target.value = "";
      return;
    }
    setBatchError(null);

    // Auto-pick kind for unambiguous Insta360 extensions. Most users leave
    // the dropdown on the default "image" and end up with a 360 photo
    // mis-classified as a flat image, which the scene picker then hides.
    // .insp and .insv are unambiguously 360 (proprietary Insta360 formats),
    // so it's safe to switch silently. Other extensions like .jpg can be
    // either flat or 360 — no auto-switch there.
    const detected = detectKindFromFiles(picked);
    const effectiveKind = detected ?? kind;
    if (detected && detected !== kind) {
      setKind(detected);
    }

    setRows(
      picked.map((file): Row => {
        const wrapped = rewrapInsta360(file);
        const matches = extensionMatchesKind(wrapped, effectiveKind);
        return {
          rowId: crypto.randomUUID(),
          file: wrapped,
          mediaId: null,
          status: matches ? "queued" : "kind_mismatch",
          progress: 0,
          errorMessage: matches ? null : dict.kindMismatch,
          signed: null,
        };
      }),
    );
  }

  const runUpload = useCallback(
    (row: Row) => {
      if (!row.signed) return;
      const signed = row.signed;
      const form = new FormData();
      form.append("file", row.file);
      form.append("api_key", signed.apiKey);
      form.append("timestamp", String(signed.timestamp));
      form.append("signature", signed.signature);
      form.append("folder", signed.folder);
      form.append("public_id", signed.publicId);
      form.append("context", signed.context);

      const xhr = new XMLHttpRequest();
      xhrsRef.current.set(row.rowId, xhr);
      xhr.open("POST", signed.uploadUrl);
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          updateRow(row.rowId, {
            progress: Math.round((event.loaded / event.total) * 100),
          });
        }
      });
      xhr.addEventListener("load", async () => {
        xhrsRef.current.delete(row.rowId);
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const uploaded = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
            await fetch("/api/media/complete", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ mediaId: signed.mediaId, cloudinary: uploaded }),
            });
            updateRow(row.rowId, { status: "done", progress: 100, errorMessage: null });
          } catch {
            updateRow(row.rowId, { status: "error", errorMessage: dict.errorLabel });
          }
        } else {
          const message = parseCloudinaryError(xhr.responseText) ?? dict.errorLabel;
          updateRow(row.rowId, { status: "error", errorMessage: message });
        }
        pumpQueue();
        router.refresh();
      });
      xhr.addEventListener("error", () => {
        xhrsRef.current.delete(row.rowId);
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        updateRow(row.rowId, { status: "error", errorMessage: dict.networkError });
        pumpQueue();
      });
      xhr.addEventListener("abort", () => {
        xhrsRef.current.delete(row.rowId);
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      });
      xhr.send(form);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dict.errorLabel, dict.networkError, router, updateRow],
  );

  const pumpQueue = useCallback(() => {
    setRows((prev) => {
      const next = [...prev];
      while (inFlightRef.current < CONCURRENCY) {
        const idx = next.findIndex(
          (r) => r.status === "queued" && r.signed !== null,
        );
        if (idx === -1) break;
        const row = next[idx];
        next[idx] = { ...row, status: "uploading", progress: 0 };
        inFlightRef.current += 1;
        runUpload(row);
      }
      return next;
    });
  }, [runUpload]);

  async function startBatch() {
    const eligible = rows.filter((r) => r.status === "queued");
    if (eligible.length === 0) return;
    setSigning(true);
    setBatchError(null);

    let signRes: Response;
    try {
      signRes = await fetch("/api/media/cloudinary-sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: eligible.map((r) => ({
            kind,
            filename: r.file.name,
            sizeBytes: r.file.size,
          })),
        }),
      });
    } catch {
      setSigning(false);
      setBatchError(dict.networkError);
      return;
    }

    const json = await safeJson<SignResponse>(signRes);
    setSigning(false);
    if (!json || !json.ok || !json.data || json.data.length !== eligible.length) {
      setBatchError(json?.error ?? dict.errorLabel);
      return;
    }

    const signedData = json.data;
    setRows((prev) => {
      const map = new Map(eligible.map((r, i) => [r.rowId, signedData[i]]));
      return prev.map((r) => {
        const signed = map.get(r.rowId);
        if (!signed) return r;
        return { ...r, signed, mediaId: signed.mediaId };
      });
    });

    pumpQueue();
  }

  async function cancelRow(row: Row) {
    const xhr = xhrsRef.current.get(row.rowId);
    if (xhr) {
      xhr.abort();
      xhrsRef.current.delete(row.rowId);
    }
    updateRow(row.rowId, { status: "cancelled", progress: 0 });
    if (row.mediaId) {
      void fetch(`/api/media/${row.mediaId}`, { method: "DELETE" }).catch(() => undefined);
    }
  }

  async function retryRow(row: Row) {
    setBatchError(null);
    let signRes: Response;
    try {
      signRes = await fetch("/api/media/cloudinary-sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: [{ kind, filename: row.file.name, sizeBytes: row.file.size }],
        }),
      });
    } catch {
      updateRow(row.rowId, { status: "error", errorMessage: dict.networkError });
      return;
    }
    const json = await safeJson<SignResponse>(signRes);
    if (!json || !json.ok || !json.data || json.data.length !== 1) {
      updateRow(row.rowId, {
        status: "error",
        errorMessage: json?.error ?? dict.errorLabel,
      });
      return;
    }
    const signed = json.data[0];
    updateRow(row.rowId, {
      status: "queued",
      progress: 0,
      errorMessage: null,
      signed,
      mediaId: signed.mediaId,
    });
    pumpQueue();
  }

  function removeRow(row: Row) {
    setRows((prev) => prev.filter((r) => r.rowId !== row.rowId));
  }

  // beforeunload sweep — cancel any uploading/queued rows that have a mediaId
  useEffect(() => {
    function onBeforeUnload() {
      const ids = rows
        .filter(
          (r): r is Row & { mediaId: string } =>
            (r.status === "uploading" || r.status === "queued") && r.mediaId !== null,
        )
        .map((r) => r.mediaId);
      if (ids.length === 0) return;
      const blob = new Blob([JSON.stringify({ ids })], { type: "application/json" });
      navigator.sendBeacon("/api/media/cancel-batch", blob);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [rows]);

  const acceptForKind = getAcceptForKind(kind);
  const eligibleCount = rows.filter((r) => r.status === "queued").length;
  const anyUploading = rows.some((r) => r.status === "uploading");
  const canStart = eligibleCount > 0 && !signing && !anyUploading;

  return (
    <section aria-labelledby={`${fieldId}-label`} className="flex flex-col gap-4">
      <h2 id={`${fieldId}-label`} className="text-xl font-semibold">
        {dict.label}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {dict.batchHint.replace("{limit}", String(batchLimit))}
      </p>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${fieldId}-kind`} className="text-sm font-medium">
            {dict.kindLabel}
          </label>
          <select
            id={`${fieldId}-kind`}
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            disabled={anyUploading}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base disabled:opacity-60 dark:border-white/20"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {dict.kinds[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${fieldId}-file`} className="text-sm font-medium">
            {dict.fileLabel}
          </label>
          <input
            id={`${fieldId}-file`}
            type="file"
            multiple
            accept={acceptForKind}
            onChange={onSelect}
            disabled={anyUploading}
            className="block min-h-11 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base file:mr-3 file:rounded file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-sm file:font-medium file:text-background disabled:opacity-60 dark:border-white/20"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={startBatch}
        disabled={!canStart}
        className="inline-flex min-h-12 items-center justify-center self-start rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
      >
        {signing || anyUploading ? dict.uploadingLabel : dict.uploadCta}
      </button>

      {batchError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {batchError}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul
          aria-label={dict.queueLabel}
          role="status"
          aria-live="polite"
          className="flex flex-col gap-2"
        >
          {rows.map((row) => (
            <RowItem
              key={row.rowId}
              row={row}
              dict={dict}
              onCancel={() => cancelRow(row)}
              onRetry={() => retryRow(row)}
              onRemove={() => removeRow(row)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function RowItem({
  row,
  dict,
  onCancel,
  onRetry,
  onRemove,
}: {
  row: Row;
  dict: Dict;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const statusLabel = (() => {
    switch (row.status) {
      case "queued":
        return dict.statusQueued;
      case "uploading":
        return dict.statusUploading;
      case "done":
        return dict.statusDone;
      case "error":
        return dict.statusError;
      case "cancelled":
        return dict.statusCancelled;
      case "kind_mismatch":
        return dict.statusKindMismatch;
    }
  })();

  return (
    <li className="flex flex-col gap-1 rounded-md border border-black/10 p-3 dark:border-white/15">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.file.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatBytes(row.file.size)} · {statusLabel}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {(row.status === "queued" || row.status === "uploading") && row.mediaId ? (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-9 rounded border border-black/15 px-3 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              {dict.rowCancel}
            </button>
          ) : null}
          {row.status === "error" ? (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-9 rounded border border-black/15 px-3 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              {dict.rowRetry}
            </button>
          ) : null}
          {row.status === "done" ||
          row.status === "cancelled" ||
          row.status === "kind_mismatch" ||
          row.status === "error" ? (
            <button
              type="button"
              onClick={onRemove}
              className="min-h-9 rounded border border-black/15 px-3 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              {dict.rowRemove}
            </button>
          ) : null}
        </div>
      </div>
      {row.status === "uploading" ? (
        <progress
          value={row.progress}
          max={100}
          className="h-1 w-full"
          aria-label={`${dict.progressLabel} ${row.progress}%`}
        />
      ) : null}
      {row.errorMessage ? (
        <p className="text-xs text-red-600 dark:text-red-400">{row.errorMessage}</p>
      ) : null}
    </li>
  );
}

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function parseCloudinaryError(text: string): string | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed?.error?.message ?? null;
  } catch {
    return null;
  }
}

function getAcceptForKind(kind: Kind): string | undefined {
  switch (kind) {
    case "image":
    case "screenshot":
      return "image/*,.jpg,.jpeg,.png,.webp";
    case "photo_360":
      return "image/*,.jpg,.jpeg,.png,.webp,.insp";
    case "audio":
      return "audio/*,.mp3,.wav,.m4a,.ogg";
    case "standard_video":
    case "drone_video":
    case "screen_recording":
      return "video/*,.mp4,.mov,.webm,.lrv";
    case "video_360":
      return "video/*,.mp4,.mov,.webm,.lrv,.insv";
    case "transcript":
      return ".srt,.vtt,.txt";
    default:
      return undefined;
  }
}

function extensionMatchesKind(file: File, kind: Kind): boolean {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  switch (kind) {
    case "image":
    case "screenshot":
      return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) || file.type.startsWith("image/");
    case "photo_360":
      return [".jpg", ".jpeg", ".png", ".webp", ".insp"].includes(ext) || file.type.startsWith("image/");
    case "audio":
      return [".mp3", ".wav", ".m4a", ".ogg"].includes(ext) || file.type.startsWith("audio/");
    case "standard_video":
    case "drone_video":
    case "screen_recording":
      return [".mp4", ".mov", ".webm", ".lrv"].includes(ext) || file.type.startsWith("video/");
    case "video_360":
      return [".mp4", ".mov", ".webm", ".lrv", ".insv"].includes(ext) || file.type.startsWith("video/");
    case "transcript":
      return [".srt", ".vtt", ".txt"].includes(ext);
    default:
      return false;
  }
}

// Insta360 cameras emit `.insp` (JPEG with GPano XMP) and `.insv` (MP4).
// Cloudinary detects format by extension and rejects unknown ones, so rewrap
// with a standard extension/MIME before upload. Bytes are unchanged.
function detectKindFromFiles(files: File[]): Kind | null {
  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".insp")) return "photo_360";
    if (lower.endsWith(".insv")) return "video_360";
  }
  return null;
}

function rewrapInsta360(file: File): File {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".insp")) {
    return new File([file], `${file.name.slice(0, -5)}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  }
  if (lower.endsWith(".insv")) {
    return new File([file], `${file.name.slice(0, -5)}.mp4`, {
      type: "video/mp4",
      lastModified: file.lastModified,
    });
  }
  return file;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
