import { env } from "./env";

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

export type CloudinaryResourceType = "image" | "video" | "raw";

export const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export function resourceTypeFor(kind: UploadKind): CloudinaryResourceType {
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
