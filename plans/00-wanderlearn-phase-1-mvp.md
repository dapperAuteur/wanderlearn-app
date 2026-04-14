# Plan 00 — Wanderlearn Phase 1 MVP

> **Status:** Draft, awaiting approval
> **Plan index:** [README.md](README.md) · **Style guide:** [STYLE_GUIDE.md](STYLE_GUIDE.md)
> Every code-writing task begins by re-reading `STYLE_GUIDE.md`. Non-negotiable.

---

## 1. Context

Wanderlearn (working name) is the standalone immersive LMS defined in `PRD_2_New_Immersive_Platform.docx` and clarified in `PRD_Amendments_v1.1.docx`. It is a **separate** product from CentenarianOS — separate repo, domain, branding, and database. Courses are place-based: every lesson is anchored to a real location documented through 360° photo/video, drone, and traditional media.

**Why now:** Anthony ("BAM") has MUCHO Museo del Chocolate as a ready flagship partner and wants a soft launch aligned with the 2026 World Cup opener in Mexico City (June 11, 2026). BAM + Claude build the MVP together in this repo — `wanderlearn-app/` is both the Next.js app root and the git repo root; `plans/` (this file) lives inside it.

**What this plan delivers:** Phase 1 MVP only (PRD §10, weeks 5–16 of the original phasing). End state: MUCHO live in English and Spanish on a staging URL, creator onboarding path working, paid enrollment via Stripe, learner progress persisting across devices (including offline → sync), and a working in-app support chat so users can reach BAM directly.

**Hard launch gates** — these are not nice-to-haves:

1. **WCAG 2.1 AA** on every learner-facing surface from day one. See [STYLE_GUIDE.md §2](STYLE_GUIDE.md).
2. **Mobile-first** layouts. Design at 320 px, scale up. See [STYLE_GUIDE.md §3](STYLE_GUIDE.md).
3. **Offline-first** for learners within licensing constraints. See [STYLE_GUIDE.md §4](STYLE_GUIDE.md).
4. **Cloudinary** is the single media vendor. Documented R2 fallback if bandwidth scales.
5. **No AI-generated content, transcription, or translation** — explicit differentiator (PRD Amendment §2.7).
6. **Every code change goes on its own branch** with a Conventional Commit message. See [STYLE_GUIDE.md §12](STYLE_GUIDE.md).
7. **In-app support chat** ships in v1 so users can report issues, send screenshots/recordings, and converse with BAM directly.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 App Router** (installed as 16.2.3 via `create-next-app@latest`), TypeScript, React 19.2, Server Components + Turbopack default | Matches existing stack; RSC keeps client bundles small. Next 16 renamed `middleware.ts` → `proxy.ts` — all references in this plan use `proxy.ts`. |
| Hosting | Vercel | Edge caching, seamless Next.js |
| DB | **Neon Postgres** | Serverless, branch-per-PR, cheap dev DBs |
| ORM | **Drizzle** | Edge-friendly, type-safe, simple migrations |
| Auth | **Better Auth** (self-hosted, MIT, Drizzle adapter) | No vendor branding on our UI; first-class Drizzle+Neon integration; social login, magic links, passkeys, email/password, 2FA and organizations via plugins; SSO/SAML plugin available for future institutional customers. Replaces Clerk, which was in the original plan but shows a "Secured by Clerk" watermark on its free tier. |
| **All media** (images, audio, standard video, 360 photo/video, transcripts, support attachments) | **Cloudinary** | Unified vendor; Video Player has built-in 360 VR mode; automatic HLS transcoding; responsive image delivery |
| 360 player | **Photo Sphere Viewer** for multi-scene tours; **Cloudinary Video Player** (`vrMode: true`) for standalone 360 video | PSV handles hotspots + scene graphs; Cloudinary is simpler for single videos |
| Payments | Stripe Checkout (one-time purchases only in MVP) | Industry standard |
| Email | Mailgun | Transactional (magic link, email OTP, receipts, support chat notifications). Dev mode logs to console when `MAILGUN_API_KEY` is unset. |
| i18n | next-intl | EN UI, EN+ES course content at launch |
| Offline | **Serwist** service worker + IndexedDB outbox for progress/chat queue | App Router PWA story |
| Analytics | PostHog | Privacy-respecting |
| UI primitives | Radix + shadcn/ui + Tailwind | Accessible by default |
| Forms | react-hook-form + zod | Type-safe validation |
| DnD | dnd-kit (keyboard sensor enabled) | Accessible drag-and-drop |
| PDF certs | pdf-lib | No headless Chrome |

**On Cloudinary specifically:** Advanced plan (~$89/mo) supports video uploads up to ~4 GB via chunked upload (`upload_large`), has built-in 360 VR playback, and handles image + audio + raw (transcripts) + video in one dashboard. If bandwidth cost climbs in Phase 2, migrate large 360 videos to Cloudflare R2 and keep Cloudinary for everything else. Fallback documented in `docs/INFRA.md` from day one.

**On the `virtual-tour-kit/` reference:** It is a working PSV integration kept outside this repo (at `../virtual-tour-kit/` relative to the wanderlearn-app root), useful as a reference but **not** a constraint. We build fresh DB-driven components inside this app.

---

## 3. Repo layout

Next.js 16 App Router, with the repo root at `wanderlearn-app/`. High-level tree:

```
wanderlearn-app/
  docs/
    INFRA.md                    # Cloudinary → R2 migration fallback
    a11y-critical-pages.md      # pages axe-playwright and pa11y must pass
  public/
  src/
    app/
      [locale]/                 # next-intl (en, es)
        layout.tsx              # Better Auth session + NextIntlClientProvider + PWA register
        (marketing)/            # landing, public catalog, course detail
        (auth)/                 # Better Auth sign-in/sign-up (our own shadcn UI)
        (learner)/              # dashboard, library, lesson player, account, support
        (creator)/              # creator dashboard, course editor, media, destinations
        (admin)/                # admin queue, user roles, support inbox
      api/
        webhooks/{stripe,cloudinary}/route.ts
        auth/[...all]/route.ts  # Better Auth catch-all handler
        media/cloudinary-sign/route.ts
        media/complete/route.ts
        checkout/route.ts
        certificates/[enrollmentId]/route.ts
    proxy.ts                    # Next 16 renamed middleware → proxy
    components/
      virtual-tour/             # fresh PSV wrapper (DB-fed)
      player/                   # LessonPlayer, ContentBlockRenderer, video players, transcript panel
      builder/                  # CourseEditor, LessonEditor, SceneEditor, PreviewAsLearner
      media/                    # MediaUploader, MediaLibrary, MediaPicker
      support/                  # SupportLauncher, ConversationThread, MessageComposer, ScreenRecorder
      ui/                       # shadcn/ui primitives
      layout/                   # Header, Footer, LocaleSwitcher, SupportFAB
    db/
      schema/                   # one file per domain
      client.ts
      queries/
      seed/
        mucho.ts
        mucho.es.json
    lib/
      auth.ts
      rbac.ts
      env.ts
      cloudinary.ts
      stripe.ts
      mailer.ts
      posthog.ts
      assemble-tour.ts          # DB rows → PSV shape
      offline-queue.ts          # IndexedDB outbox
      sanitize.ts               # DOMPurify wrapper
      certificates.ts
    i18n/messages/{en,es}.json
    sw.ts                       # Serwist service worker
  scripts/
    seed.ts
    upload-mucho-media.ts
  tests/
    e2e/                        # Playwright
    a11y/                       # axe-playwright
```

---

## 4. Data model (Drizzle)

All tables: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`. Enums via Postgres `CREATE TYPE`.

### 4.1 Identity
- **`users`** — `email unique citext`, `email_verified bool`, `display_name`, `avatar_url`, `role` (`learner|creator|teacher|admin`), `birth_year` (13+ gate), `locale`, `stripe_customer_id`. Better Auth's own `accounts`, `sessions`, `verification_tokens`, and `passkeys` tables sit alongside this one via its Drizzle adapter.

### 4.2 Destinations + media
- **`destinations`** — `slug unique`, `name`, `country`, `city`, `lat`, `lng`, `description`, `hero_media_id`.
- **`media_assets`** — `owner_id`, `kind` (`image|audio|standard_video|photo_360|video_360|drone_video|transcript|screenshot|screen_recording`), `status` (`uploading|processing|ready|failed`), `provider` (`cloudinary`), `cloudinary_public_id`, `cloudinary_resource_type`, `cloudinary_format`, `cloudinary_secure_url`, `poster_public_id` (2D fallback for 360), `duration_seconds`, `width`, `height`, `size_bytes`, `transcript_media_id` (self-FK), `metadata jsonb`.

### 4.3 Courses + lessons
- **`courses`** — `slug unique`, `creator_id`, `destination_id`, `title`, `subtitle`, `description`, `cover_media_id`, `price_cents`, `currency`, `default_locale`, `status` (`draft|in_review|published|unpublished`), `review_required bool default true`, `stripe_product_id`, `stripe_price_id`, `estimated_minutes`, `published_at`.
- **`lessons`** — `course_id`, `slug`, `order_index`, `title`, `summary`, `status`, `is_free_preview bool`, `estimated_minutes`. Unique `(course_id, slug)` and `(course_id, order_index)`.
- **`content_blocks`** — `lesson_id`, `order_index`, `type` (`text|video|photo_360|video_360|quiz|virtual_tour`), `data jsonb` (zod-validated per type).

### 4.4 Scenes (DB-driven immersive tours)
- **`scenes`** — `owner_id`, `destination_id`, `name`, `caption`, `panorama_media_id`, `poster_media_id`, `start_yaw`, `start_pitch`.
- **`scene_hotspots`** — `scene_id`, `local_key`, `yaw`, `pitch`, `title`, `content_html`, `audio_media_id`, `external_url`.
- **`scene_links`** — `from_scene_id`, `to_scene_id`, `name`, `yaw`, `pitch`.

### 4.5 Commerce + progress
- **`purchases`** — `user_id`, `course_id`, `stripe_session_id`, `stripe_payment_intent_id`, `amount_cents`, `currency`, `amount_to_creator_cents` (Phase 2 payout placeholder), `status`.
- **`enrollments`** — `user_id`, `course_id`, `purchase_id`, `source`, `enrolled_at`, `completed_at`, `revoked_at`, `certificate_issued_at`. Unique `(user_id, course_id)`.
- **`lesson_progress`** — `enrollment_id`, `lesson_id`, `status`, `percent_complete`, `last_block_id`, `last_position_seconds`, `started_at`, `completed_at`, `updated_at`. Unique `(enrollment_id, lesson_id)`.
- **`reviews`** — schema-only for MVP (no UI): `user_id`, `course_id`, `rating 1–5`, `body`, `status`.

### 4.6 i18n (separate translation tables)
- **`course_translations`** — `course_id`, `locale`, `title`, `subtitle`, `description`. Unique `(course_id, locale)`.
- **`lesson_translations`** — `lesson_id`, `locale`, `title`, `summary`. Unique `(lesson_id, locale)`.
- **`content_block_translations`** — `block_id`, `locale`, `data jsonb` (may override `media_asset_id` so EN and ES lessons can reference different videos). Unique `(block_id, locale)`.

### 4.7 Support chat (new v1 requirement)

Users click a persistent **"Help / Report"** floating button (learner routes + creator routes) and open a conversation with BAM (admin role).

- **`support_threads`** — `user_id` (opener), `subject text`, `category` (`bug|ui_ux|feature_request|question|content|other`), `status` (`open|waiting_user|waiting_admin|resolved|closed`), `priority` (`low|normal|high|urgent`), `last_message_at timestamptz`, `resolved_at`. Index `(status, last_message_at desc)` for admin inbox ordering.
- **`support_messages`** — `thread_id`, `author_id` (users.id of sender — user OR admin), `author_role` (`user|admin`, denormalized for fast render), `body text` (sanitized markdown), `attachments jsonb` (array of `media_asset_id`s for screenshots and screen recordings), `seen_by_user_at`, `seen_by_admin_at`, `created_at`.
- **`support_thread_participants`** (nullable for MVP — single admin BAM is implicit; add this table in Phase 2 if the support team grows).

**Attachments policy:**
- Allowed kinds: `screenshot` (Cloudinary `image`), `screen_recording` (Cloudinary `video`, max 120s, max 150 MB), `standard_video` (existing kind, max 500 MB for support), plain images.
- Uploaded through the same Cloudinary signed upload path as course media, with a different `upload_preset` (`support_attachments`) that scopes retention to 1 year and prevents public listing.

**Username / identity in chat:**
- Every message displays `display_name` + `avatar_url` from the `users` row so BAM immediately knows who's writing. The user's email is visible in the admin-side thread header but hidden from other participants if the table later gains multi-user support.

**Screen recording UX:**
- `<ScreenRecorder>` component uses `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })` to capture the browser tab or full screen, piped into `MediaRecorder` with MIME `video/webm;codecs=vp9`.
- 120-second hard limit with a visible countdown.
- On stop, the blob is uploaded via chunked Cloudinary upload (same plumbing as course video) and the resulting `media_asset_id` attaches to the message.
- Feature-detected: if `getDisplayMedia` is unavailable (Safari iOS, some older browsers), the recorder UI is hidden and only screenshot + text are shown — documented in the support widget help text.

**Screenshot UX:**
- Two options: user drags an image onto the message composer (drop zone), or clicks "Capture screenshot" which uses `html2canvas` against the current document to produce a PNG (no extra permission prompt).
- Size-limited to 5 MB per image, 10 images per message.

**Notifications:**
- On new user message → Mailgun email to BAM (`ADMIN_NOTIFY_EMAIL` env) with thread link.
- On new admin message → Mailgun email to the user plus, if the user is online, an in-app toast + unread badge on the header.
- Thread unread counts are queried via `support_messages.seen_by_*_at` IS NULL joins, debounced on the client.

**Offline behavior:**
- User can open the support widget while offline. Draft messages + attachments queue in the IndexedDB outbox via `lib/offline-queue.ts`. On reconnect, messages replay in order. The UI shows "Will send when online" until the replay succeeds.

**Accessibility:**
- Full keyboard control (Tab through fields, Enter to send, Esc to close).
- ARIA live region announces new messages as they arrive.
- Screen-reader labels on every control, including the "record screen" button's state machine ("Start recording", "Recording, N seconds remaining", "Stop recording").
- Focus trap while the widget is open (Radix Dialog handles it).

**Security:**
- Every message body sanitized server-side with DOMPurify before insert.
- Attachments scanned for MIME mismatch (zod schema + Cloudinary `resource_type` check).
- Rate-limited: max 20 messages per user per hour, max 5 new threads per user per day, enforced in the server action.

### 4.8 Offline sync
- **`progress_sync_log`** — optional write-ahead log for conflict resolution when the IndexedDB outbox replays. Fields: `id`, `user_id`, `entity_type`, `entity_id`, `operation`, `client_updated_at`, `server_applied_at`.

---

## 5. Route + API plan

Server Actions for writes. Route handlers only for webhooks and presigned upload signing.

**Auth:** Better Auth catch-all handler at `/api/auth/[...all]/route.ts` (handles sign-in/up, social callbacks, session, passwordless, passkeys). No separate webhook needed — session lifecycle is DB-local.

**Webhooks:** `/api/webhooks/stripe`, `/api/webhooks/cloudinary`.

**Media:** `POST /api/media/cloudinary-sign` (signs upload params per `upload_preset`), `POST /api/media/complete` (finalize row, idempotent with webhook).

**Commerce:** `POST /api/checkout` (creates Stripe Checkout Session), `POST /api/webhooks/stripe` (mark paid + create enrollment + Mailgun receipt).

**Creator actions:** `createCourse`, `updateCourse`, `reorderLessons`, `createLesson`, `updateLesson`, `createBlock`, `updateBlock`, `reorderBlocks`, `upsertTranslation`, `createScene`, `updateHotspot`, `submitForReview`.

**Admin actions:** `approveCourse`, `rejectCourse`, `setUserRole`, `trustCreator`, `replyToSupportThread`, `setSupportThreadStatus`, `setSupportPriority`.

**Learner actions:** `enrollFree`, `upsertProgress`, `issueCertificate`, `openSupportThread`, `postSupportMessage`, `markSupportMessagesSeen`.

**Support routes:**
- `/[locale]/(learner)/support` — list of the user's threads, unread indicators, "New request" button.
- `/[locale]/(learner)/support/[threadId]` — conversation view.
- `/[locale]/(admin)/admin/support` — admin inbox, filterable by status/category/priority.
- `/[locale]/(admin)/admin/support/[threadId]` — admin conversation view with user metadata sidebar.

**Global SupportFAB** — floating action button rendered in the `(learner)` and `(creator)` layouts (not on auth or marketing pages). Opens a Radix Dialog with the MessageComposer; behind the scenes creates or resumes the user's most recent open thread.

---

## 6. Media pipeline (Cloudinary)

1. Client calls `POST /api/media/cloudinary-sign` with `{ kind, upload_preset, folder }`.
2. Server creates `media_assets` row with `status='uploading'`, signs params with `CLOUDINARY_API_SECRET`, returns signed params.
3. Client uses Cloudinary `upload_large` chunked API (20 MB chunks, resumable) for any file > 20 MB; single-shot upload otherwise.
4. Cloudinary webhook hits `POST /api/webhooks/cloudinary`. Verify signature. On `upload` notification, update the `media_assets` row with `cloudinary_public_id`, `secure_url`, `duration`, dimensions, `status='ready'`.
5. 360 handling: client attaches `context=type=360` tag on upload. Server auto-generates a 2D poster via `fl_vector,so_0` transformation and stores `poster_public_id`.
6. Transcripts upload as `resource_type=raw` with `.vtt`/`.srt`/`.txt` extensions.
7. Delivery: images use `w_auto,q_auto,f_auto`; video uses HLS (`f_m3u8`) with `sp_auto` adaptive streaming.
8. No server-side ffmpeg, no worker queues — Cloudinary owns transcoding.

---

## 7. Offline-first strategy

1. **Service worker (Serwist)** caches app shell (HTML, JS, CSS, fonts, logo, sign-in). Scope limited to learner + marketing + auth routes. Creator/admin UIs are online-only.
2. **Enrolled lesson cache** — on first lesson visit, cache metadata, text blocks, transcripts, small images, audio < 5 MB. Large video stays online-only unless user hits **Save for offline** (per-course opt-in).
3. **IndexedDB outbox** (`lib/offline-queue.ts`) — `lesson_progress` writes + support chat messages queue locally while offline, replay on reconnect via background sync. Conflict resolution: last-write-wins by `client_updated_at`, server tiebreaker.
4. **Licensed-content gate** — cached media carries `validUntil` tied to enrollment status. Replay checks auth before serving.
5. **Cache versioning** — each deploy bumps the cache version; stale entries purge on SW activate.

---

## 8. Accessibility baseline

Enforced by [STYLE_GUIDE.md §2](STYLE_GUIDE.md). Non-obvious points specific to Wanderlearn:

- **PSV canvas** — wrap in a focusable container with `role="application"` + `aria-label`. Add keyboard layer: arrows pan ±5°, `+`/`-` zoom, `Enter` activates focused hotspot, `Esc` closes panels, `Tab` cycles to next hotspot.
- **Live region** announces scene changes and quiz feedback.
- **Transcript enforcement** at publish time — `submitForReview` rejects a course where any video/video_360 block is missing `transcript_media_id`.
- **2D fallback enforcement** — a `photo_360`/`video_360` block without `poster_media_id` cannot be saved.
- **Support chat widget** — Radix Dialog focus trap, ARIA live updates for incoming messages, screen reader-announced upload progress.
- **CI gates** — `axe-playwright` + `pa11y-ci` against pages listed in `docs/a11y-critical-pages.md` (catalog, course detail, lesson player with each block type, creator course editor, support widget, sign-in).

---

## 9. Mobile-first baseline

Rules in [STYLE_GUIDE.md §3](STYLE_GUIDE.md). Wanderlearn-specific notes:

- **Lesson player** — single column on mobile, two-column (blocks left, player right) on `md+`. Bottom action bar fixed with safe-area insets.
- **PSV on mobile** — touch pan/zoom, optional gyroscope toggle (opt-in from controls).
- **SupportFAB** — bottom-right on desktop, above bottom nav on mobile to avoid overlap with system gesture areas.
- **Creator editor is desktop-first** — acceptable shortcut for Phase 1. Document in creator onboarding.
- **Playwright mobile matrix** — iPhone SE, iPhone 15, Pixel 8, iPad Mini, desktop 1440 for every learner PR.

---

## 10. MUCHO migration

1. `scripts/upload-mucho-media.ts` — one-time admin script. Reads panorama JPGs + audio from the kit's `public/tours/mucho/`, uploads to Cloudinary under `wanderlearn/mucho/`, writes public IDs to a local mapping file.
2. `src/db/seed/mucho.ts` — idempotent seed. Creates destination (Colonia Juárez, CDMX), creator user, scenes, hotspots, scene links, a `courses` row (`slug=mucho-museo-chocolate`, `default_locale=en`, `price_cents=0` for launch), two lessons (one `virtual_tour` block, one mixed `text`+`photo_360`), plus EN + ES translations. Spanish text comes from `src/db/seed/mucho.es.json`, **hand-written** (no AI translation per PRD amendment §2.7).
3. `pnpm db:seed` runs the script; idempotent on slug uniqueness.
4. Runtime never reads the kit — all data flows through `src/lib/assemble-tour.ts`, which reshapes DB rows into the form the PSV wrapper expects.

---

## 11. Git workflow (applies to every task)

Defined in full in [STYLE_GUIDE.md §12](STYLE_GUIDE.md). Summary:

- **One branch per logical change**, one PR per branch.
- Branch prefixes: `feat/` · `fix/` · `chore/` · `docs/` · `a11y/` · `perf/`.
- **Conventional Commits** for every commit: `type(scope): subject`.
- Commit body references the plan: `Implements plan plans/00-wanderlearn-phase-1-mvp.md §N`.
- PR description uses the template in STYLE_GUIDE §13.
- CI (typecheck + lint + unit + E2E + a11y) must pass before merge.
- Never `--no-verify`, never `--force` to shared branches, never `--amend` a pushed commit.

**Initial setup commits** (on plan approval):
- Branch `chore/scaffold-wanderlearn-app` → commit `chore(scaffold): bootstrap next.js 16 + tailwind v4 + [lang] i18n`.
- Branch `docs/style-guide-and-plans` → already done (this plan + STYLE_GUIDE live in `plans/`).
- Every milestone in §13 below = its own branch + PR.

---

## 12. Out of scope for Phase 1

Explicit list so we don't scope-creep:

- Creator analytics beyond enrollment count
- Stripe Connect payouts (schema supports it; no UI)
- Classroom/teacher tools, student rosters (Phase 3)
- LMS integrations (Canvas, Google Classroom, Clever)
- Native mobile apps
- Full-text search, fuzzy search, recommendations
- Reviews UI (schema only)
- Discussion threads on lessons
- Discount codes, gift purchases, subscriptions
- Multi-currency (USD only at launch)
- Course versioning / revision history
- **Any** AI-generated content, transcription, translation, or moderation (PRD amendment §2.7)
- Insta360 Studio integration, in-app camera control
- Bulk desktop uploader
- Multi-admin support team (single-admin BAM only; `support_thread_participants` table deferred)

---

## 13. Build sequence (12 weeks, branch per step)

Each row = one branch + one PR. Each ends in something demonstrable on staging.

| Wk | Branch | Milestone |
|---|---|---|
| 1 | `chore/scaffold-wanderlearn-app` | **Next.js 16** + Tailwind v4 + Turbopack + `env.ts` zod-validated + native `[lang]` i18n with dictionaries + `proxy.ts` locale redirect + landing renders EN + ES. (Better Auth, next-intl, Drizzle, Cloudinary, Stripe, Serwist follow in week 2+ after Next 16 compatibility verified.) |
| 2 | `feat/db-schema-and-auth-sync` | Full Drizzle schema + migrations against Neon. Better Auth wired in with Drizzle adapter, email/password + Google social + magic links. `proxy.ts` role gate. Admin user-role flip page. |
| 3 | `feat/cloudinary-media-pipeline` | Signed upload, chunked `upload_large`, Cloudinary webhook, media library, 360 auto-poster. |
| 4 | `feat/destinations-and-scene-editor` | Destination CRUD. Scene editor (new PSV wrapper) with hotspot + scene-link placement. 2D poster enforcement. |
| 5 | `feat/course-and-block-crud` | Course/lesson/block CRUD. Text + photo_360 + standard video block editors. |
| 6 | `feat/learner-catalog-and-player` | Catalog, course detail, free enrollment, `LessonPlayer` rendering text/video/photo_360/video_360. Mobile-first test matrix passes. |
| 7 | `feat/progress-and-offline-queue` | `lesson_progress` writes, resume-across-devices, IndexedDB outbox, Serwist shell cache, "Save for offline" per course. |
| 8 | `feat/stripe-checkout-and-receipts` | Stripe Checkout + webhook + `purchases` + `enrollments` + Mailgun receipt. |
| 9 | `feat/virtual-tour-block-and-quiz` | `virtual_tour` content block + `assemble-tour.ts`. Quiz block. Partial MUCHO scene seed. |
| 10 | `feat/i18n-and-mucho-full-seed` | Content translation tables + editor UI + read path. Full MUCHO seed EN + ES. |
| 11 | `feat/support-chat` **+** `a11y/publish-gates` | **Support chat v1**: threads, messages, screenshots via html2canvas, screen recording via `getDisplayMedia`, Cloudinary upload, Mailgun notifications, admin inbox, offline queue. **Accessibility gates**: `submitForReview` enforces transcripts + 2D fallbacks, axe-playwright + pa11y-ci in CI, VoiceOver pass. (Two branches merged in the same week but kept as separate PRs.) |
| 12 | `feat/certificates-and-launch-polish` | PDF certificate generation, error boundaries, empty states, SEO metadata, OG images, PostHog wiring, 5 GB upload stress test, full Playwright E2E green. Staging URL with MUCHO live EN + ES. |

---

## 14. Critical files (first cut)

- [plans/STYLE_GUIDE.md](STYLE_GUIDE.md) — **re-read before every code task**
- [plans/00-wanderlearn-phase-1-mvp.md](00-wanderlearn-phase-1-mvp.md) — this plan
- `docs/INFRA.md` — Cloudinary → R2 fallback
- `docs/a11y-critical-pages.md`
- `src/db/schema/{users,destinations,media,courses,lessons,scenes,translations,enrollments,progress,purchases,support,reviews}.ts`
- `src/db/client.ts`
- `src/db/seed/mucho.ts` + `mucho.es.json`
- `src/proxy.ts` (Next 16 renamed middleware → proxy)
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/(learner)/learn/[courseSlug]/[lessonSlug]/page.tsx`
- `src/app/[locale]/(creator)/creator/courses/[id]/page.tsx`
- `src/app/[locale]/(learner)/support/page.tsx`
- `src/app/[locale]/(admin)/admin/support/page.tsx`
- `src/app/api/auth/[...all]/route.ts` (Better Auth handler)
- `src/app/api/webhooks/{stripe,cloudinary}/route.ts`
- `src/app/api/media/cloudinary-sign/route.ts`
- `src/app/api/checkout/route.ts`
- `src/components/virtual-tour/{VirtualTour,VirtualTourViewer}.tsx`
- `src/components/player/{LessonPlayer,ContentBlockRenderer,CloudinaryVideoPlayer,TranscriptPanel}.tsx`
- `src/components/builder/{CourseEditor,LessonEditor,SceneEditor,PreviewAsLearner}.tsx`
- `src/components/support/{SupportFAB,ConversationThread,MessageComposer,ScreenRecorder,ScreenshotTool}.tsx`
- `src/lib/{auth,rbac,cloudinary,stripe,mailer,assemble-tour,offline-queue,sanitize}.ts`
- `src/sw.ts`
- `src/i18n/messages/{en,es}.json`

---

## 15. Verification (end-to-end test story)

Run against a Neon branch DB and a Cloudinary dev folder. Tooling: Playwright + axe-playwright + pa11y-ci + Stripe CLI + Better Auth dev mode (seeded test users).

1. `pnpm db:migrate && pnpm db:seed` — MUCHO fully seeded EN + ES.
2. Creator signup → admin promotes → creator uploads a 360 JPG + a 1.5 GB equirectangular MP4 → both reach `ready`, 2D posters auto-generated.
3. Creator builds a 1-lesson course (text + photo_360 + quiz), with a required transcript on any video block, submits for review, admin approves.
4. Learner signup (second browser) → browse `/en/courses` → buy MUCHO (temporarily priced $5) via Stripe test card `4242 4242 4242 4242` → webhook marks paid + enrollment created.
5. Learner takes MUCHO on iPhone SE viewport: PSV scene transitions, hotspot panels, quiz scored, progress saved.
6. Close tab, open desktop context: "Resume" returns to same block + video timestamp.
7. Locale switch `/en/` → `/es/`: Spanish course content renders.
8. **Offline gate**: go offline in devtools → reload enrolled lesson (served from SW cache) → advance progress (queued to IndexedDB) → back online → syncs to server.
9. **Support chat gate**: user opens SupportFAB, types a bug report, captures a screenshot via html2canvas, records a 30-second screen recording via `getDisplayMedia`, sends. Admin receives Mailgun email + sees thread in `/admin/support` with username + avatar. Admin replies, user receives notification.
10. Complete both MUCHO lessons → certificate PDF downloads.
11. `pnpm a11y` (axe-playwright + pa11y-ci) returns zero violations on the critical pages.
12. 5 GB 360 video chunked upload against staging completes end-to-end.

Commands: `pnpm dev`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm test:e2e`, `pnpm a11y`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

---

## 16. Memory to save after plan approval

When plan mode exits, save these so future sessions don't lose them:

- **Feedback** — Before writing any code in wanderlearn, re-read `plans/STYLE_GUIDE.md`. Never skip.
- **Feedback** — Wanderlearn MUST be mobile-first, ARIA compliant (WCAG 2.1 AA), offline-first where licensing allows. These are launch gates.
- **Feedback** — Every change goes on its own branch (`feat/ fix/ chore/ docs/ a11y/ perf/`) with a Conventional Commit message. No direct commits to `main`, no `--no-verify`, no `--amend` on pushed commits.
- **Feedback** — No AI-generated content, transcription, or translation on Wanderlearn — explicit differentiator (PRD Amendment §2.7).
- **Feedback** — Plans live in `plans/`, numbered `NN-slug.md`, incremented sequentially. New plans pick the next unused number.
- **Project** — Wanderlearn is standalone, not a CentenarianOS module. MUCHO is the flagship launch course. Target alignment: 2026 World Cup opener June 11.
- **Project** — Media vendor is Cloudinary; documented migration path to Cloudflare R2 if bandwidth bills climb (see `docs/INFRA.md`).
- **Project** — Support chat ships in v1 so users can reach BAM directly with screenshots + screen recordings. BAM is the sole admin for MVP.
- **Reference** — Source PRDs live at `wanderlearn/PRD-insta360 virtual-tour-feature-and-app/PRD_2_New_Immersive_Platform.docx` and `wanderlearn/PRD-insta360 virtual-tour-feature-and-app ammendments/PRD_Amendments_v1.1.docx`.
- **Reference** — Plans index: `wanderlearn/plans/README.md`. Style guide: `wanderlearn/plans/STYLE_GUIDE.md`.
