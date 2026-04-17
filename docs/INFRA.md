# Infrastructure

What each third-party service does for Wanderlearn, what breaks when
it's down, and where the fallback path is. Companion to
[CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md),
[NEON_SETUP.md](NEON_SETUP.md), and
[CLOUDINARY_FOLDER_CONVENTION.md](CLOUDINARY_FOLDER_CONVENTION.md).

---

## Services at a glance

| Service | What it does | If it dies | Fallback |
|---|---|---|---|
| **Vercel** | Hosts Next.js app + runs serverless route handlers + cron | Whole site offline | Move deploy to any Node host; `next start` works standalone |
| **Neon (Postgres)** | Primary DB for every table | Whole app offline (writes + most reads) | Any managed Postgres (Supabase, RDS); Drizzle is vendor-agnostic |
| **Cloudinary** | Stores + transforms + delivers images, audio, video, 360° | Learners see "media missing" placeholders; uploads fail | Cloudflare R2 — documented below |
| **Better Auth** | Session + magic-link + OTP + passkey + 2FA | Sign-in fails; existing sessions keep working until expiry | No direct swap; Better Auth is the auth layer itself (not a provider) |
| **Stripe** | Paid-course checkout + receipts + price objects | Paid enrollments fail; free enrollments unaffected | None in Phase 1. Paddle considered for Phase 2 |
| **Mailgun** | Transactional email (receipt, support notifications, future magic-link) | Emails queue silently (see `src/lib/mailer.ts` dev fallback); app keeps working | Resend, Postmark, SES — all speak the same SMTP/API shape |
| **GitHub Actions** | Runs axe + pa11y on every PR | CI skipped; `pnpm a11y` still runs locally | n/a |

---

## Required env vars (production)

All validated at boot via [src/lib/env.ts](../src/lib/env.ts).

| Var | Required | What it controls |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres pooled connection string |
| `BETTER_AUTH_SECRET` | yes | ≥32 chars. Signs session JWTs |
| `BETTER_AUTH_URL` | yes | Canonical origin used for magic-link redirects |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | yes for uploads | Exposed to browser |
| `CLOUDINARY_API_KEY` | yes for uploads | Server-side only |
| `CLOUDINARY_API_SECRET` | yes for uploads | Server-side only |
| `STRIPE_SECRET_KEY` | yes for paid | Missing → paid enroll surfaces "Paid checkout not configured" message |
| `STRIPE_WEBHOOK_SECRET` | yes for paid | Validates `/api/webhooks/stripe` payloads |
| `MAILGUN_API_KEY` | yes for email | Missing → mailer logs preview instead of sending |
| `MAILGUN_DOMAIN` | yes for email | e.g. `mg.witus.online` |
| `MAILGUN_REGION` | no | `us` (default) or `eu` |
| `EMAIL_FROM` | no | Defaults to `Wanderlearn <noreply@witus.online>` |
| `ADMIN_NOTIFY_EMAIL` | no but recommended | Where support-chat notifications land (BAM's inbox) |

Dev placeholders in `env.ts` let `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm a11y` pass without real credentials. See §"Local development" in each setup doc.

---

## Vercel

- **Project:** `wanderlearn` on the WitUS Vercel account
- **Production branch:** `main`
- **Preview branches:** every non-main push gets its own URL
- **Env vars:** set per-environment (Development / Preview / Production) in the Vercel dashboard. Preview gets the same vars as Production except DB + Stripe point at sandboxes
- **Build command:** inherited from `package.json#scripts.build` (`next build --webpack`)
- **Output:** serverless functions for every `app/**/route.ts` + dynamic pages; static for the landing page

### Custom domain

- Production: `wanderlearn.witus.online`
- Preview: `*.wanderlearn.witus.online` (automatic)

### Cron + schedules

None in Phase 1. Future preview-asset cleanup job will live here per [CLOUDINARY_FOLDER_CONVENTION.md](CLOUDINARY_FOLDER_CONVENTION.md) §7.

---

## Neon Postgres

- **Project layout:** one Neon project, three branches — `main` (production), `preview` (shared preview env), `dev` (local-to-BAM)
- **Connection:** all via `@neondatabase/serverless` with websocket (see `src/db/client.ts`)
- **Migrations:** `pnpm db:migrate` on every deploy (Vercel preview builds included); Drizzle migrations live in `src/db/migrations/`
- **Seeding:** `pnpm db:seed` writes MUCHO. CSV-driven translations in `scripts/seed-data/` (see its README)

See [NEON_SETUP.md](NEON_SETUP.md) for connection-string and branching details.

### Backup strategy

Neon Pro retains point-in-time snapshots for 7 days. Phase 1 relies on that. Post-launch: manual `pg_dump` to a personal S3 bucket weekly.

---

## Cloudinary

Cloudinary is the primary media vendor and the shared tenant with Fly.WitUS (and future ecosystem apps). Folder ownership and `public_id` conventions are locked in [CLOUDINARY_FOLDER_CONVENTION.md](CLOUDINARY_FOLDER_CONVENTION.md).

Upload flow + webhook + poster generation: [CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md).

### File-size limits by kind

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

Enforced in `src/app/api/media/cloudinary-sign/route.ts`.

### When Cloudinary goes down

- **Uploads fail:** signer returns 503 with `code: "cloudinary_not_configured"` (or times out at the upload endpoint). Creator UI shows the error from `MediaUploader`.
- **Delivery degrades:** learners see "media missing" placeholder on photo_360 / video_360 / video blocks. Text blocks unaffected.
- **Webhook misses:** `/api/webhooks/cloudinary` sets `media_assets.status = "ready"` — but `POST /api/media/complete` from the client side does the same job as a backup. Unless BOTH fail, no data loss.

### Fallback: Cloudflare R2 migration path

Documented here so we can execute it quickly if Cloudinary pricing or reliability forces the move. No code change is committed for this yet — the switch is a ~1-day job, not an always-on capability.

**Why R2 is the chosen fallback:**
- S3-compatible API — AWS SDK speaks to it directly
- Zero egress fees (massive cost swing for 360° video)
- Cloudflare Stream handles HLS + adaptive bitrate for video
- Cloudflare Images handles on-the-fly image transforms (Cloudinary's primary killer feature)

**Migration plan (if triggered):**

1. Stand up an R2 bucket per app prefix (`wanderlearn`, mirroring the Cloudinary folder convention).
2. Run a one-shot `scripts/migrate-media-to-r2.ts` that streams each `media_assets` row from Cloudinary → R2, then updates the DB row with the new R2 public URL while preserving `cloudinaryPublicId` for rollback.
3. Swap `src/lib/cloudinary.ts` → `src/lib/r2.ts` behind the same `imageUrl` / `videoHlsUrl` / `videoPosterUrl` interface. All consumers already go through those helpers.
4. Re-sign with R2 presigned URLs in `/api/media/cloudinary-sign/route.ts` (rename to `/api/media/sign`).
5. Cutover the webhook path to Cloudflare Images / Stream event notifications.
6. Keep Cloudinary assets read-only for 30 days as rollback insurance; then delete.

**What the migration won't recreate automatically:** the 360° `so_0` frame-extraction transform that powers 2D poster derivation. Cloudflare Stream's equivalent is a thumbnail at offset N — functionally identical, URL shape different. The `videoPosterUrl` helper hides that.

---

## Better Auth

- **Config:** `src/lib/auth.ts` and `src/lib/auth-client.ts`
- **Adapter:** Drizzle against the same Neon DB
- **Enabled methods:** magic link, email OTP, passkey, password + 2FA
- **Session store:** DB-backed, not cookie-only, so revocation works from the admin panel

Target per ecosystem README: magic link only, eventually unified "WitUS account" across apps. Not blocking anything in Phase 1.

---

## Stripe

- **Mode:** Checkout (not Elements)
- **Price objects:** created lazily on first purchase of a course; `courses.stripePriceId` stored for reuse
- **Price-change handling:** updating `courses.priceCents` nulls out `stripePriceId` so the next buyer gets a freshly-created Price (Stripe Prices are immutable)
- **Webhook:** `/api/webhooks/stripe` validates signature via `STRIPE_WEBHOOK_SECRET`, marks `purchases.status = 'completed'`, creates the `enrollments` row
- **Receipts:** Mailgun send in `src/lib/receipts.ts`
- **Fee calculator:** live on the course edit page; see `src/lib/stripe-fees.ts`

### When Stripe is down

Free enrollments still work. Paid enrollments surface the specific Stripe error via the checkout session; no silent failure. No retry queue.

---

## Mailgun

- **Sending domain:** `mg.witus.online` (or similar) — DNS records (SPF, DKIM, MX for bounces) managed in the DNS provider, not in this repo
- **API region:** US by default; toggle via `MAILGUN_REGION=eu`
- **Dev fallback:** missing API key → `sendEmail()` logs `[mailer:dev-fallback]` with full message preview instead of sending. See `src/lib/mailer.ts`

### When Mailgun is down

Support-chat notifications queue-and-retry is NOT implemented. Current behavior: `sendEmail()` catches and logs via `console.error`; the DB write already committed. Users and admins see a stale thread until someone refreshes the UI. Acceptable for Phase 1 with BAM as sole admin.

---

## Local development

Everything except production-sensitive services falls back to safe defaults:

| Service | No creds behavior |
|---|---|
| Neon | Requires `DATABASE_URL` to be set. Dev placeholder in env.ts passes build but runtime writes fail |
| Cloudinary | Uploads return 503; reads render "media missing" |
| Stripe | Paid checkout surfaces "not configured" banner |
| Mailgun | Logs message preview instead of sending |
| Better Auth | Requires a 32+ char secret; placeholder in env.ts satisfies build |

Typical setup: copy `.env.local.example` → `.env.local`, fill Neon + Better Auth + Cloudinary to get most of the app working, add Stripe + Mailgun only when you need them.

---

## When things break

- **`pnpm build` fails with "Invalid environment variables"** — missing one of the required vars above. env.ts prints which.
- **Uploads silently don't appear** — check Cloudinary webhook config in the dashboard points at your deploy URL, AND `CLOUDINARY_API_SECRET` is set (used to verify webhook signatures).
- **Paid course enrollment does nothing after "Open checkout"** — `STRIPE_WEBHOOK_SECRET` missing, so the webhook signature check fails silently. Check Vercel function logs.
- **Magic-link emails don't arrive** — either Mailgun creds wrong OR `BETTER_AUTH_URL` doesn't match the Vercel deploy URL (so the redirect-after-click goes to a non-existent origin).
- **a11y tests fail on apparently-unrelated content** — another project's dev server is on port 3000. Playwright spawns its own on 3100 to avoid this, but double-check if the symptom is weird. See the a11y CI gates branch commit message for context.

---

## What this doc does not cover

- Analytics (PostHog) — not wired as of this date; will get its own section when it is.
- CDN strategy beyond Cloudinary — Vercel's edge cache handles static assets; no additional CDN layer.
- Disaster recovery RTO/RPO targets — Phase 1 runs on Neon Pro snapshots; formal DR plan is Phase 1.2.
- Security review — handled out-of-band (STYLE_GUIDE §14 + any engagement we run).
