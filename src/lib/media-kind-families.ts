import type { UploadKind } from "./cloudinary-urls";

// Kind families that are safe to flip in place: same Cloudinary
// resource_type AND same upload folder, so the existing publicId / URL
// stays valid and no asset move is required. Other kinds (screenshot,
// screen_recording, audio, transcript) are intentionally excluded — they
// live in different folders by convention or carry semantically different
// payloads.
export type ChangeableKind =
  | "image"
  | "photo_360"
  | "standard_video"
  | "video_360"
  | "drone_video";

export const KIND_FAMILIES: ReadonlyArray<ReadonlyArray<ChangeableKind>> = [
  ["image", "photo_360"],
  ["standard_video", "video_360", "drone_video"],
];

export function getKindFamily(
  kind: UploadKind,
): ReadonlyArray<ChangeableKind> | null {
  return KIND_FAMILIES.find((fam) => fam.includes(kind as ChangeableKind)) ?? null;
}
