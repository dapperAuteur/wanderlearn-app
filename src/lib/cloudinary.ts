import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env, hasCloudinary } from "./env";
import {
  cloudName,
  folderFor,
  imageUrl,
  posterUrlFor,
  resourceTypeFor,
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
