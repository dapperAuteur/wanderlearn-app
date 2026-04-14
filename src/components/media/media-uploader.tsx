"use client";

import { useId, useState, type ChangeEvent } from "react";
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
  successLabel: string;
  kinds: Record<Kind, string>;
};

type SignResponse = {
  ok: boolean;
  data?: {
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

const KINDS: Kind[] = [
  "image",
  "photo_360",
  "audio",
  "standard_video",
  "video_360",
  "drone_video",
  "transcript",
];

export function MediaUploader({ dict }: { dict: Dict }) {
  const router = useRouter();
  const fieldId = useId();
  const [kind, setKind] = useState<Kind>("image");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setStatus("idle");
    setProgress(0);
    setErrorMessage(null);
  }

  async function onUpload() {
    if (!file) return;
    setStatus("uploading");
    setErrorMessage(null);
    setProgress(0);

    const signRes = await fetch("/api/media/cloudinary-sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, filename: file.name, sizeBytes: file.size }),
    });

    const signJson = (await signRes.json()) as SignResponse;
    if (!signJson.ok || !signJson.data) {
      setStatus("error");
      setErrorMessage(signJson.error ?? dict.errorLabel);
      return;
    }

    const signed = signJson.data;
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("signature", signed.signature);
    form.append("folder", signed.folder);
    form.append("public_id", signed.publicId);
    form.append("context", signed.context);

    const uploaded = await uploadWithProgress(signed.uploadUrl, form, (pct) => setProgress(pct));
    if (!uploaded) {
      setStatus("error");
      setErrorMessage(dict.errorLabel);
      return;
    }

    await fetch("/api/media/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaId: signed.mediaId, cloudinary: uploaded }),
    });

    setStatus("done");
    setProgress(100);
    setFile(null);
    router.refresh();
  }

  const statusId = `${fieldId}-status`;

  return (
    <section aria-labelledby={`${fieldId}-label`} className="flex flex-col gap-4">
      <h2 id={`${fieldId}-label`} className="text-xl font-semibold">
        {dict.label}
      </h2>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${fieldId}-kind`} className="text-sm font-medium">
            {dict.kindLabel}
          </label>
          <select
            id={`${fieldId}-kind`}
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
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
            onChange={onFile}
            className="block min-h-11 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base file:mr-3 file:rounded file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-sm file:font-medium file:text-background dark:border-white/20"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onUpload}
        disabled={!file || status === "uploading"}
        className="inline-flex min-h-12 items-center justify-center self-start rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
      >
        {status === "uploading" ? dict.uploadingLabel : dict.uploadCta}
      </button>

      <div
        id={statusId}
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
        className="min-h-6 text-sm"
      >
        {status === "uploading" ? (
          <span>
            {dict.progressLabel}: {progress}%
          </span>
        ) : null}
        {status === "done" ? (
          <span className="text-emerald-700 dark:text-emerald-400">{dict.successLabel}</span>
        ) : null}
        {status === "error" && errorMessage ? (
          <span className="text-red-600 dark:text-red-400">{errorMessage}</span>
        ) : null}
      </div>
    </section>
  );
}

function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<CloudinaryUploadResponse | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResponse);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
    xhr.addEventListener("error", () => resolve(null));
    xhr.addEventListener("abort", () => resolve(null));
    xhr.send(form);
  });
}
