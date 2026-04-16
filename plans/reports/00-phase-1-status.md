# Report 00 — Phase 1 MVP status

**As of:** 2026-04-16
**Measured against:** [plan 00](../00-wanderlearn-phase-1-mvp.md) §13 (12-week build sequence) and [plan 01](../01-media-crud-and-discovery.md).

Legend: ✅ done, 🟡 partial, ⬜ not started.

---

## Plan 00 — Phase 1 MVP

| Wk | Branch | Status | Evidence / gaps |
|---|---|---|---|
| 1 | `chore/scaffold-wanderlearn-app` | ✅ | Next.js 16, Tailwind v4, `[lang]` i18n, env.ts, landing EN+ES |
| 2 | `feat/db-schema-and-auth-sync` | ✅ | Full Drizzle schema, Better Auth + magic-link/OTP/passkey/2FA, admin user-role page |
| 3 | `feat/cloudinary-media-pipeline` | ✅ | Signed upload, webhook, media library |
| 4 | `feat/destinations-and-scene-editor` | 🟡 | Destination CRUD + PSV wrapper ✅. Hotspot placement ⬜, scene-link editor ⬜, 2D poster auto-generation ⬜ (`poster_public_id` column exists, no pipeline writes to it; `posterMediaId` currently reuses `panoramaMediaId` which is wrong for video) |
| 5 | `feat/course-and-block-crud` | 🟡 | Course CRUD ✅ (`feat/courses-crud`), Lesson CRUD ✅ (`feat/lessons-crud`). Content blocks ⬜ — no editor for text / video / photo_360 / video_360 blocks yet (the `content_blocks` table exists but is empty) |
| 6 | `feat/learner-catalog-and-player` | ⬜ | No learner surface exists. `/[lang]/courses` public route ⬜, course detail ⬜, free enrollment ⬜, `LessonPlayer` component ⬜, mobile test matrix ⬜ |
| 7 | `feat/progress-and-offline-queue` | ⬜ | No `lesson_progress` writes, no IndexedDB outbox, no Serwist service worker, no "Save for offline" |
| 8 | `feat/stripe-checkout-and-receipts` | ⬜ | No Stripe integration. `courses.priceCents` is stored but there's no checkout/webhook/purchase flow |
| 9 | `feat/virtual-tour-block-and-quiz` | ⬜ | No `virtual_tour` block, no `assemble-tour.ts`, no quiz block |
| 10 | `feat/i18n-and-mucho-full-seed` | ⬜ | Translation tables (`course_translations`, `lesson_translations`, `content_block_translations`) exist but no editor UI, no read path, no MUCHO seed (`src/db/seed/mucho.ts` doesn't exist) |
| 11 | `feat/support-chat` + `a11y/publish-gates` | ⬜ | No SupportFAB, no conversation thread UI, no screenshot/recording tools, no `submitForReview` gate, no axe-playwright / pa11y-ci in CI |
| 12 | `feat/certificates-and-launch-polish` | ⬜ | No PDF cert, no OG images, no PostHog, no Playwright E2E, no 5 GB upload stress test |

**Headline: ~40% of plan 00 done.** Weeks 1–5 largely shipped (with gaps in week 4–5); weeks 6–12 not started.

---

## Plan 01 — Media CRUD + Discovery

### P1 track (launch-blocking): ✅ 100%
- Media rename + description ✅
- Soft + hard delete + reference blocker ✅
- Hero image picker on destinations ✅
- Panorama picker on scenes ✅

### Phase 2 track (post-launch): 🟡 ~80%
- Tags + tag filter ✅
- pg_trgm extension + GIN indexes ✅ (`migration 0004`)
- Search bar on media + destinations ✅
- Search bar on scenes ⬜ — `searchScenes` query exists but no UI wires it up
- Global creator search ⬜ — unified search bar in the nav that spans media + destinations + scenes + courses

---

## Extras delivered outside either plan

- Destination 404 fix (Next.js 16 `dynamicParams` inheritance) ✅
- Scene editing (name + caption) ✅
- 360° video scenes (PSV `VideoPlugin` + `EquirectangularVideoAdapter`) ✅
- Transcript linking on video rows ✅
- Validation checklists for plans 00 (partial), 01, course CRUD, lesson CRUD ✅

---

## Gaps not explicit in either plan

- **`posterMediaId` always equals `panoramaMediaId`** on scene create. For `video_360` scenes this stores a video asset where a 2D image is expected.
- **No seed script for MUCHO.** `pnpm db:seed` doesn't exist, neither does `src/db/seed/`.
- **No `docs/INFRA.md`** (R2 fallback documented), no `docs/a11y-critical-pages.md`.
- **No E2E / a11y CI pipeline** — typecheck + lint only. Playwright, axe-playwright, pa11y-ci all absent.
- **Public learner routes don't exist.** `/[lang]/courses` (plural) is linked from the header but returns 404.
- **`how-it-works` page** also linked from header, also 404.

---

## Recommended next branch order

Measured by "highest learner-visible value per branch":

1. **`feat/content-blocks-text`** — start the last piece of week 5 with the simplest block type. Establishes the block CRUD pattern.
2. **`feat/content-blocks-media`** — photo_360 + standard_video blocks. Reuses pattern from #1.
3. **`feat/learner-catalog-and-player`** — the first route a real human can try: `/[lang]/courses`, course detail, lesson page. Free enrollment button. No Stripe yet.
4. **`feat/progress-and-resume`** — server-side only (lesson_progress writes + resume). Skip offline/Serwist for v1.
5. **`feat/mucho-seed`** — seed script + real MUCHO course. Unblocks partnership pitches.
6. **`feat/stripe-checkout`** — once content layer is real.

Everything after that (global search, support chat, certificates, offline, a11y CI) fits in Phase 1.2.

---

## Branches sitting for review (not merged to main per rule)

- `feat/courses-crud` — course CRUD + dev-process gitignore (2 commits)
- `feat/lessons-crud` — lesson CRUD, stacked on courses-crud (1 commit)

Both typecheck + lint clean.
