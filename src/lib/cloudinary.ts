import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

cloudinary.config({
  cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export type UploadKind =
  | "image"
  | "audio"
  | "standard_video"
  | "photo_360"
  | "video_360"
  | "drone_video"
  | "transcript"
  | "screenshot"
  | "screen_recording";

type ResourceType = "image" | "video" | "raw";

export function resourceTypeFor(kind: UploadKind): ResourceType {
  switch (kind) {
    case "image":
    case "photo_360":
    case "screenshot":
      return "image";
    case "audio":
    case "standard_video":
    case "video_360":
    case "drone_video":
    case "screen_recording":
      return "video";
    case "transcript":
      return "raw";
  }
}

export function folderFor(kind: UploadKind): string {
  if (kind === "screenshot" || kind === "screen_recording") return "wanderlearn/support";
  if (kind === "transcript") return "wanderlearn/transcripts";
  return "wanderlearn/media";
}

export interface SignedUploadParams {
  cloudName: string;
  apiKey: string;
  resourceType: ResourceType;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  context: string;
}

export function signUpload(kind: UploadKind, publicId: string): SignedUploadParams {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = folderFor(kind);
  const context = `type=${kind}`;

  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
    public_id: publicId,
    context,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return {
    cloudName,
    apiKey: env.CLOUDINARY_API_KEY,
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
  return cloudinary.utils.verifyNotificationSignature(bodyString, Number(timestamp), signature);
}

interface ImageOptions {
  width?: number;
  crop?: "fill" | "fit" | "limit";
  format?: "auto" | "webp" | "jpg" | "png";
  quality?: "auto" | number;
}

export function imageUrl(publicId: string, options: ImageOptions = {}): string {
  const transformations: string[] = [
    `f_${options.format ?? "auto"}`,
    `q_${options.quality ?? "auto"}`,
  ];
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  const tx = transformations.join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${tx}/${publicId}`;
}

export function videoHlsUrl(publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${publicId}.m3u8`;
}

export function videoPosterUrl(publicId: string, width = 1200): string {
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_0,w_${width},f_jpg,q_auto/${publicId}.jpg`;
}

export function posterUrlFor(kind: UploadKind, publicId: string, width = 1200): string {
  if (kind === "photo_360") return imageUrl(publicId, { width, format: "jpg", quality: "auto" });
  if (kind === "video_360" || kind === "standard_video" || kind === "drone_video") {
    return videoPosterUrl(publicId, width);
  }
  return imageUrl(publicId, { width });
}
