import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env, hasCloudinary } from "./env";
import {
  cloudName,
  folderFor,
  imageUrl,
  posterUrlFor,
  resourceTypeFor,
  transformedImageUrl,
  video360PanoramaUrl,
  videoHlsUrl,
  videoPosterUrl,
  type CloudinaryResourceType,
  type UploadKind,
} from "./cloudinary-urls";

export {
  cloudName,
  folderFor,
  hasCloudinary,
  imageUrl,
  posterUrlFor,
  resourceTypeFor,
  transformedImageUrl,
  video360PanoramaUrl,
  videoHlsUrl,
  videoPosterUrl,
};
export type { UploadKind };

function requireCloudinary(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} {
  if (
    !env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment. See docs/CLOUDINARY_SETUP.md.",
    );
  }
  return {
    cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
}

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  const c = requireCloudinary();
  cloudinary.config({
    cloud_name: c.cloudName,
    api_key: c.apiKey,
    api_secret: c.apiSecret,
    secure: true,
  });
  configured = true;
}

export interface SignedUploadParams {
  cloudName: string;
  apiKey: string;
  resourceType: CloudinaryResourceType;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  context: string;
}

export function signUpload(kind: UploadKind, publicId: string): SignedUploadParams {
  ensureConfigured();
  const c = requireCloudinary();
  const timestamp = Math.round(Date.now() / 1000);
  const folder = folderFor(kind);
  const context = `type=${kind}`;

  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
    public_id: publicId,
    context,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, c.apiSecret);

  return {
    cloudName: c.cloudName,
    apiKey: c.apiKey,
    resourceType: resourceTypeFor(kind),
    timestamp,
    signature,
    folder,
    publicId,
    context,
  };
}

export function verifyWebhookSignature(
  bodyString: string,
  timestamp: string,
  signature: string,
): boolean {
  ensureConfigured();
  return cloudinary.utils.verifyNotificationSignature(bodyString, Number(timestamp), signature);
}

export async function destroyAsset(
  publicId: string,
  kind: UploadKind,
): Promise<{ ok: true } | { ok: false; error: string }> {
  ensureConfigured();
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceTypeFor(kind),
      invalidate: true,
    });
    const r = result as { result?: string };
    if (r.result === "ok" || r.result === "not found") {
      return { ok: true };
    }
    return { ok: false, error: r.result ?? "unknown" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export interface UploadedImage {
  publicId: string;
  secureUrl: string;
  format: string;
  resourceType: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Store an image Cloudinary can fetch (including one of its own delivery URLs) as a new
 * asset under `publicId`. This is how an edited copy becomes a standalone file: the
 * result has no tie to the original, so deleting the original cannot take it along.
 */
export async function uploadImageFromUrl(
  source: string,
  options: { publicId: string; folder?: string; context?: string },
): Promise<{ ok: true; data: UploadedImage } | { ok: false; error: string }> {
  ensureConfigured();
  try {
    const r = (await cloudinary.uploader.upload(source, {
      resource_type: "image",
      public_id: options.publicId,
      overwrite: false,
      ...(options.folder ? { folder: options.folder } : {}),
      ...(options.context ? { context: options.context } : {}),
    })) as {
      public_id: string;
      secure_url: string;
      format: string;
      resource_type: string;
      width: number;
      height: number;
      bytes: number;
    };
    return {
      ok: true,
      data: {
        publicId: r.public_id,
        secureUrl: r.secure_url,
        format: r.format,
        resourceType: r.resource_type,
        width: r.width,
        height: r.height,
        bytes: r.bytes,
      },
    };
  } catch (err) {
    // The SDK rejects with a plain object carrying `message`, not always an Error.
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "unknown";
    return { ok: false, error: message };
  }
}

/** Delete every image whose public id starts with `prefix` (helper assets, not media rows). */
export async function deleteImagesByPrefix(prefix: string): Promise<void> {
  ensureConfigured();
  try {
    await cloudinary.api.delete_resources_by_prefix(prefix, {
      resource_type: "image",
      invalidate: true,
    });
  } catch {
    // Cleanup of throwaway helpers. A leftover strip costs a few kilobytes and is never
    // referenced again, so a failure here must not fail the edit that triggered it.
  }
}

/**
 * Wait until Cloudinary has produced a derived image, or the deadline passes.
 *
 * A first request for a new transformation is generated on the fly. Most finish in a few
 * seconds, but heavy ones (face detection on a full panorama, generative AI) can answer
 * 423 until the derived file is ready (Cloudinary documents this for generative remove).
 * HEAD triggers the same generation without pulling megabytes through the server.
 * Cloudinary explains a refusal in the x-cld-error header, which is passed back.
 */
export async function waitForDerivedImage(
  url: string,
  options: { deadlineMs: number; intervalMs?: number },
): Promise<{ ok: true } | { ok: false; code: "processing" | "failed"; error: string }> {
  const deadline = Date.now() + options.deadlineMs;
  const interval = options.intervalMs ?? 3000;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", cache: "no-store" });
    } catch (err) {
      return { ok: false, code: "failed", error: err instanceof Error ? err.message : "network" };
    }
    if (res.ok) return { ok: true };
    if (res.status !== 423 && res.status !== 420) {
      return {
        ok: false,
        code: "failed",
        error: res.headers.get("x-cld-error") ?? `HTTP ${res.status}`,
      };
    }
    if (Date.now() + interval > deadline) {
      return { ok: false, code: "processing", error: "Still processing" };
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/** An image's stored pixel size, from the Admin API. Null if Cloudinary cannot say. */
export async function getImageSize(
  publicId: string,
): Promise<{ width: number; height: number } | null> {
  ensureConfigured();
  try {
    const r = (await cloudinary.api.resource(publicId, { resource_type: "image" })) as {
      width?: number;
      height?: number;
    };
    return r.width && r.height ? { width: r.width, height: r.height } : null;
  } catch {
    return null;
  }
}
