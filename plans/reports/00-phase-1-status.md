# Phase 1 MVP status

**Last updated:** 2026-04-16 (checkpoint 3, post-week-10 i18n triad)
**Measured against:** [plan 00](../00-wanderlearn-phase-1-mvp.md) §13 (12-week build sequence) and [plan 01](../01-media-crud-and-discovery.md).
**Supersedes:** all prior content of this file; earlier checkpoints (00 original, local 01) are rolled into this one.

Legend: ✅ done on main, 🟡 partial, ⬜ not started.

---

## Plan 00 — Phase 1 MVP

| Wk | Branch | Status | Notes |
|---|---|---|---|
| 1 | `chore/scaffold-wanderlearn-app` | ✅ | Next.js 16, Tailwind v4, `[lang]` i18n, env.ts, landing EN+ES |
| 2 | `feat/db-schema-and-auth-sync` | ✅ | Full Drizzle schema, Better Auth with magic-link / OTP / passkey / 2FA, admin user-role page |
| 3 | `feat/cloudinary-media-pipeline` | ✅ | Signed upload, webhook, media library |
| 4 | `feat/destinations-and-scene-editor` | 🟡 | Destination CRUD ✅, PSV wrapper ✅, scene CRUD ✅, photo + video scene types ✅, hotspot placement + scene-link editor ✅ (via `feat/scene-hotspots-and-links`). **Remaining:** 2D poster auto-generation ⬜ — `poster_media_id` column exists, but `src/lib/actions/scenes.ts:104` and `:178` still set `posterMediaId = panoramaMediaId` on both insert and update paths, which stores a video asset as the poster for `video_360` scenes. |
| 5 | `feat/course-and-block-crud` | ✅ | Course CRUD, lesson CRUD, and all four MVP block editors (text, photo_360, video, video_360) on main. Creator lesson view consolidated onto shared `components/blocks/lesson-blocks.tsx` (via `chore/consolidate-block-renderer`). |
| 6 | `feat/learner-catalog-and-player` | ✅ | `/[lang]/courses` catalog, `/[lang]/courses/[slug]` detail, free enrollment server action, `/[lang]/learn/[courseSlug]/[lessonSlug]` player — all merged. Mobile-first layout throughout. **Gap:** manual mobile test matrix (iPhone SE, iPhone 15, Pixel 8, iPad Mini, desktop 1440) still un-walked. |
| 7 | `feat/progress-and-offline-queue` | 🟡 | Server-side progress ✅ (`feat/progress-and-resume` merged — `lesson_progress` writes, in-progress tracking, resume-across-devices button on course detail). **Remaining:** IndexedDB outbox ⬜, Serwist service worker ⬜, "Save for offline" per course ⬜. None of the offline PWA layer has landed. |
| 8 | `feat/stripe-checkout-and-receipts` | ✅ | Stripe Checkout + webhook + purchases + enrollments (`feat/stripe-checkout`), Mailgun receipt email on paid enrollment (`feat/mailgun-receipt`), live checkout-fee calculator + price-change invalidation. |
| 9 | `feat/virtual-tour-block-and-quiz` | 🟡 | `virtual_tour` content block + `assemble-tour.ts` ✅, quiz content block (editor + client renderer) ✅, seed is MUCHO-EN with 4 text lessons. **Remaining from plan's week 9:** partial MUCHO *scene* seed — no 360° scenes/tours authored into MUCHO yet; that blends into the content-authoring phase. |
| 10 | `feat/i18n-and-mucho-full-seed` | 🟡 | Translation triad complete: read path (`feat/i18n-read-path`) ✅, CSV-driven multi-locale seed loader (`feat/mucho-es-seed`) ✅, in-app translation editor at `/[lang]/creator/courses/[id]/translations/[locale]` (`feat/i18n-creator-editor`) ✅. **Remaining:** human-translated ES strings to populate `scripts/seed-data/mucho.es.csv` ⬜ (no-AI-translation rule means a human must write these); non-text block translation in the creator editor (captions, quiz strings) ⬜. |
| 11 | `feat/support-chat` **+** `a11y/publish-gates` | ⬜ | Support schema exists (`support_threads`, `support_messages`, enums for category/status/priority/author role). No SupportFAB, no thread UI, no screenshot/recording tools, no admin inbox. No `submitForReview` gate, no axe-playwright or pa11y-ci in CI. |
| 12 | `feat/certificates-and-launch-polish` | ⬜ | No PDF cert, no per-course OG images, no PostHog, no Playwright E2E, no 5 GB upload stress test, no `docs/a11y-critical-pages.md`, no `docs/INFRA.md`. |

**Headline:** ~80% of plan 00 is done. Weeks 1–6, 8, and 10 substantially shipped; weeks 7 (offline half) and 11–12 not started.

---

## Plan 01 — Media CRUD + Discovery

### P1 track (launch-blocking): ✅ 100%
- Media rename + description + tags + soft/hard delete + reference blocker
- Hero image picker on destinations
- Panorama picker on scenes

### Phase 2 track (post-launch): 🟡 ~80%
- Tags + tag filter ✅
- pg_trgm extension + GIN indexes ✅ (migration 0004)
- Search bar on media + destinations ✅
- Search bar on scenes ⬜ — `searchScenes` query exists but no UI wires it up
- Global creator search ⬜ — unified search in the nav that spans media + destinations + scenes + courses

---

## Delivered outside either plan

- `chore/consolidate-block-renderer` — removed duplicated rendering logic from the creator lesson view ✅
- `chore/swap-resend-for-mailgun` — transactional email vendor swap ✅
- `feat/how-it-works` — replaced the 404 page linked from the header ✅
- `docs/cloudinary-folder-convention` — [docs/CLOUDINARY_FOLDER_CONVENTION.md](../../docs/CLOUDINARY_FOLDER_CONVENTION.md) locks top-level namespaces for shared Cloudinary tenant (`wanderlearn/`, `bvc/`, `tour/`, `cent/`), `public_id` rule, context keys, tags, and BVC→Wanderlearn hand-off contract ✅

---

## Standing gaps

- **`posterMediaId` = `panoramaMediaId` on scene create + update.** For `video_360` scenes this stores a video where a 2D image is expected. Simple fix — either generate a Cloudinary still-frame poster at signing time, or nullable-out `posterMediaId` for video scenes and let the renderer derive on the fly.
- **No `docs/INFRA.md`** (R2 fallback migration path), **no `docs/a11y-critical-pages.md`** (axe-playwright target list).
- **No E2E / a11y CI.** Only `pnpm typecheck`, `pnpm lint`, `pnpm build` run. Playwright + axe-playwright + pa11y-ci all absent.
- **Mobile test matrix un-walked.** Code is mobile-first but no evidence of the five-device pass defined in STYLE_GUIDE §3.
- **No human-written ES content for MUCHO.** Seed loader reads `scripts/seed-data/mucho.es.csv`; file exists as an empty template. Launch blocker — June 1 / June 11 launch is EN + ES.

---

## Remaining work to June 11 launch, ordered by leverage

1. **Human ES translation for MUCHO.** Fill `scripts/seed-data/mucho.es.csv` (or author via `/[lang]/creator/courses/[id]/translations/es`). Cheap wall-clock, huge user-visible value — ES learners literally can't browse the flagship course today.
2. **Fix `posterMediaId` for video scenes.** Small bug fix. Blocks the 2D fallback a11y gate.
3. **`feat/support-chat`** — week 11 first half. Schema ready. Build SupportFAB, thread UI, admin inbox, Mailgun notifications. Medium surface.
4. **`a11y/publish-gates`** — week 11 second half. `submitForReview` server action enforces: transcript on every video block, `posterMediaId` on every 360° block. Add axe-playwright + pa11y-ci to CI. Medium.
5. **Offline half of week 7** — Serwist service worker + app-shell cache + IndexedDB progress outbox + "Save for offline" per course. Largest remaining feature surface. Can slip to Phase 1.2 if June 11 pressure mounts; server-side resume already works.
6. **`feat/certificates-and-launch-polish`** — week 12. PDF cert, per-course OG image via `next/og`, PostHog wiring, Playwright happy-path E2E, 5 GB upload stress test, docs. Last mile.
7. **Plan 01 stragglers** — scene search UI + global creator search. Not launch-blocking; good Phase 1.1.

---

## Branches sitting for review

As of this checkpoint: **none awaiting merge on main.** BAM has been merging each branch after commit. The following branches exist locally but are already merged: `feat/courses-crud` (shown `--no-merged` against itself because it was the source of a nested merge; no outstanding work).

---

## What this checkpoint does not cover

- **Content quality.** Whether MUCHO text is strong enough for launch is a human editorial call, not a tick box.
- **Partnership status with MUCHO Museo del Chocolate.** Out of scope for an engineering status report.
- **Budget + time-to-launch runway** against the June 11 date. Same.
