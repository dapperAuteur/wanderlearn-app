# Cloudinary setup

Wanderlearn uses Cloudinary as the single media vendor for images, audio, standard video, 360° photo, 360° video, transcripts, and support-chat attachments. One dashboard, one set of credentials.

## 1. Create a Cloudinary account

1. Sign up at <https://cloudinary.com>. The free tier is enough for development and small-scale testing.
2. In the **Dashboard**, find the **Account Details** panel. Copy:
   - **Cloud name**: public, baked into asset URLs.
   - **API key**: private.
   - **API secret**: private, **never commit**.

## 2. Add env vars

Put these in `.env.local` (and in Vercel's project settings for Preview and Production):

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

The cloud name is exposed to the client (hence the `NEXT_PUBLIC_` prefix) because it's part of every delivery URL. The API key and secret stay server-side.

## 3. Upload flow (what happens under the hood)

1. Creator picks a file in the **MediaUploader** on `/en/creator/media`.
2. Client calls `POST /api/media/cloudinary-sign` with `{ kind, filename, sizeBytes }`.
3. Server validates size against the per-kind limit, creates a `media_assets` row with `status='uploading'`, signs upload params with `CLOUDINARY_API_SECRET`, and returns the signature + the `uploadUrl`.
4. Client POSTs multipart form data directly to Cloudinary's upload endpoint via `XMLHttpRequest` (so we get real progress events). The request never touches our server.
5. On success, the client calls `POST /api/media/complete` with the Cloudinary response so the DB row updates to `status='ready'` immediately. This is a backup for when the webhook is slow.
6. Cloudinary also fires a webhook at `POST /api/webhooks/cloudinary` (see §4) which is the authoritative update path.

## 4. Webhook (optional but recommended)

Cloudinary's dashboard → **Settings → Webhook Notifications** → add a new notification URL:

```
https://<your-production-domain>/api/webhooks/cloudinary
```

Select the `upload` event. The webhook handler verifies the signature using `CLOUDINARY_API_SECRET` via `cloudinary.utils.verifyNotificationSignature`, then updates the matching `media_assets` row with the final `public_id`, `secure_url`, dimensions, duration, and `bytes`.

In development, you can skip the webhook. The client-side `POST /api/media/complete` call covers the same purpose. Webhooks matter in production because they fire even if the user's browser closes between upload and completion.

## 5. 360° assets: 2D fallback posters

When a user uploads a `photo_360` or `video_360`, the library automatically exposes a 2D poster URL via Cloudinary's transformation engine (no separate upload needed):

- **`photo_360`** → the same `public_id`, served as a flat image via `f_auto,q_auto`. See `src/lib/cloudinary.ts#imageUrl`.
- **`video_360`** (and `standard_video`, `drone_video`) → `src/lib/cloudinary.ts#videoPosterUrl` returns a URL with `so_0` (frame at second 0) plus `f_jpg,q_auto` transformations. Cloudinary generates the still on the fly.

The `MediaLibrary` component uses `posterUrlFor(kind, publicId, width)` to pick the right URL for each card's thumbnail. Publishing a 360° content block in a lesson requires a `poster_media_id` (plan §2 accessibility gate), which the lesson builder will enforce in a later week.

## 6. File-size limits

Enforced in the sign endpoint (`src/app/api/media/cloudinary-sign/route.ts`):

| Kind | Max |
|---|---|
| `image` | 50 MB |
| `audio` | 500 MB |
| `standard_video` | 2 GB |
| `photo_360` | 100 MB |
| `video_360` | 5 GB |
| `drone_video` | 5 GB |
| `transcript` | 5 MB |
| `screenshot` | 5 MB |
| `screen_recording` | 150 MB |

Cloudinary's **Advanced** paid plan supports uploads up to ~4 GB via chunked `upload_large`. For files above that or for cost control in Phase 2, the documented migration path is to move large 360° video to Cloudflare R2 and keep Cloudinary for everything else: no architectural changes, only a runtime URL swap.

## 7. Local development without a real Cloudinary account

The env placeholders in `src/lib/env.ts` let `pnpm build`, `pnpm lint`, and `pnpm typecheck` pass without real Cloudinary credentials. But signing and uploading real files will fail at runtime until you set the three env vars. Create a free account before testing uploads end-to-end.

## 8. Security

- The API secret is used only server-side, in `src/lib/cloudinary.ts`. Never exposed to the client.
- Every signed upload ties the asset's `public_id` to the row `id` from our DB, so each Cloudinary asset has a stable reference back to `media_assets`.
- The webhook handler rejects unsigned or tampered payloads via `verifyNotificationSignature` before touching the DB.
- The `/api/media/cloudinary-sign` route requires a logged-in user via `requireUser()`. Anonymous clients cannot generate upload signatures.
- Size limits are enforced before the signature is minted, so clients can't bypass them by sending a smaller "claimed" size.
