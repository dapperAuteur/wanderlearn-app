-- scenes.poster_media_id should point at a 2D image, never at a video.
-- Prior to this fix, scene create + panorama-replace wrote panorama_media_id
-- into poster_media_id unconditionally — which stored a video_360 asset as
-- the poster for video_360 scenes. Null those out; the renderer will derive
-- a still-frame poster via Cloudinary's so_0 transformation on the panorama
-- video's public_id when a 2D fallback is needed.
UPDATE "scenes"
SET "poster_media_id" = NULL
WHERE "poster_media_id" IN (
  SELECT "id" FROM "media_assets" WHERE "kind" = 'video_360'
);
