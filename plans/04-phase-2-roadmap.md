# 04 — Phase 2 roadmap

**Status:** Thematic outline, not a commitment. Starts after plan 03 closes (post-June-11 launch).
**Timebox:** None set yet. These themes will get individual plans (05, 06, 07…) as each is chosen to start.

## Ground rules for Phase 2

- **No new AI-generated content rules.** The no-AI-content commitment from plan 00 §2 persists. All course text and translations remain human-authored.
- **One theme at a time.** Phase 2 is not parallel — pick a theme, ship it fully, move on. Phase 1 taught us the branch-per-change rhythm; keep it.
- **Each theme gets its own numbered plan** (`plans/05-*.md`, `plans/06-*.md`, …) with the same structure as plans 00 and 01: context, scope in/out, doc inventory, build sequence, critical files, verification.
- **Ecosystem-first thinking.** By Phase 2, Fly.WitUS is likely live and Wanderlearn is likely integrating with it. Respect the [CLOUDINARY_FOLDER_CONVENTION](../docs/CLOUDINARY_FOLDER_CONVENTION.md) and the ecosystem README in every theme.

## Themes, in rough priority order

### ~~Theme A — Offline, fully~~ (moved to plan 05, launch-blocking for 1.0)

Per BAM decision 2026-04-19, offline ships in 1.0 rather than slipping to
Phase 1.2. Fully scoped in [plans/05-offline-learner.md](05-offline-learner.md).
The licensed-content gate (`validUntil` + replay auth check) and
support-chat offline queue remain Phase 2 — they're listed in plan 05's
"out-of-scope follow-ups" section.

### Theme B — Memberships and pricing variants

If BAM decides recurring revenue matters. Today's model is per-course purchase only.

- Stripe Subscriptions (monthly / annual / lifetime tiers)
- `memberships` schema with entitlement rules (what courses each tier unlocks)
- Cancellation + proration + grace-period handling
- Promo codes (from Fly.WitUS v3 spec, shared ecosystem schema)
- Migration path for existing per-course purchases (keep honoring them forever)
- Admin UI for managing plans + promo codes

Non-trivial. Probably 2 weeks minimum. `plans/06-memberships.md`.

### Theme C — Ecosystem integrations

Planned in [plans/ecosystem/README.md](ecosystem/README.md) but deliberately deferred out of Phase 1.

- **BVC footage inbound from Fly.WitUS**: webhook on `bvc/shared-with-wanderlearn/*` Cloudinary folder with `shared:wanderlearn` tag. Creates a `media_assets` row with `external_source = { app: "bvc", id: "<fly-row-id>" }`. Surfaces in the creator's media library as "imported from Fly.WitUS."
- **Course ↔ mission back-link**: `wanderlearnCourseSlug` on Fly.WitUS mission records. Course detail page shows a "Field Documentation" section pulling the related flight record via a small API call.
- **CentenarianOS Academy preview block**: new content block type (or a parameterized iframe wrapper) that Academy lessons can embed to show Wanderlearn course previews.
- **"Back to Academy" banner**: visible on Wanderlearn course pages reached via Academy deep links.

One plan per integration (`plans/07-fly-bvc-inbound.md`, etc.). Each is small-to-medium; none individually is 2 weeks.

### Theme D — Accessibility deepening

Phase 1 hits WCAG 2.1 AA for the basics. Phase 2 pushes further.

- Audio descriptions on videos (creator workflow + publish-gate enforcement)
- Non-text block translation (media captions, virtual-tour captions, quiz strings) — currently creator editor only supports text blocks
- PSV keyboard-navigation improvements — currently relies on upstream library; may need custom focus-trap and keyboard shortcuts on our side
- Screen-reader live-region announcements for 360° scene transitions

Small-but-many. Could be split across several small plans or bundled as `plans/08-a11y-deep.md`.

### Theme E — Creator power tools

Features creators have asked for or will ask for.

- Bulk media upload (current flow is one file at a time)
- Drag-to-reorder blocks within a lesson, lessons within a course, scenes within a destination, hotspots within a scene
- Creator analytics dashboard — per-course enrollment counts, completion rates, revenue (Stripe data surfaced locally)
- Scheduled publishing (publish at a future date)
- Course duplication (clone an existing course as a draft)
- Global creator search (Plan 01 Phase 2 straggler) — a unified search bar spanning media, destinations, scenes, courses
- Scene search UI (Plan 01 Phase 2 straggler) — `searchScenes` query exists; just needs UI

Each is 1–3 days. Pick 2–3 to bundle into `plans/09-creator-power-tools.md`.

### Theme F — Admin power tools

- Admin audit log — who approved what course, when, and why
- Refund UI — one-click refund from the Stripe webhook trail, not just the Stripe dashboard
- User detail page — view a user's enrollments, media, support threads, admin notes
- Abuse / flag system — let learners report a course; admin sees flagged content queue
- Rate limiting on sign-in, support-thread creation, upload signing — via Vercel KV or Upstash
- Revenue dashboard — basic per-course and total revenue, pulled from Stripe, displayed in admin

Plan `plans/10-admin-power-tools.md`.

### Theme G — Marketing + SEO

Phase 1 has the basics. Phase 2 takes them further.

- Per-course Open Graph images (exists today for detail pages; could extend to lesson-specific previews)
- Structured data (JSON-LD `Course` schema on course detail; `BreadcrumbList` on deep routes)
- Sitemap generation from the DB (currently there isn't one)
- Localized social previews (separate OG image per `?lang=`)
- Landing-page CTA experiments (A/B tested headlines / CTAs)
- Blog / editorial section (one-off plan — maybe a separate product surface)

`plans/11-seo-marketing.md`.

### Theme H — Infrastructure hardening

- Move `db/client.ts` from `neon-http` to `neon-serverless` so transactions work
- Add `docs/a11y-critical-pages.md` Tier-3 authenticated tests (Playwright auth fixture)
- R2 migration readiness drill — run the migration plan from `docs/INFRA.md` on a preview branch, verify URL shape still resolves through the existing helpers
- Weekly `pg_dump` to off-site backup (cron via Vercel or GitHub Actions)
- Incident response runbook expansion

`plans/12-infra-hardening.md`.

## Themes deliberately NOT on the roadmap

Listed for the record so we don't rediscover them.

- **AI translation / AI content generation** — violates plan 00 §2.
- **Native mobile apps** — the PWA + Serwist story is the mobile path. No React Native, no Swift, no Kotlin.
- **Live video / real-time classrooms** — Wanderlearn is on-demand place-based learning. A real-time layer changes the product.
- **Social features at course-level** (comments, ratings, discussions) — out of scope unless MUCHO or another partner explicitly needs them.
- **Multi-tenancy / whitelabel instances** — Wanderlearn is a single product; institutional partnerships happen through the Wanderlearn brand, not private-labeled clones.

## How to pick the next theme

When plan 03 closes (launch happens), BAM picks one theme from A–H and kicks off its plan file. Recommended picks by scenario:

- **"Launch was bumpy, need better insight"** → Theme G (marketing/SEO) + Theme H (infra). Stabilize first.
- **"Launch was clean, time to scale"** → Theme B (memberships) or Theme C (ecosystem). Revenue and integrations.
- **"Launch was clean and we have content partners"** → Theme E (creator power tools). Make it faster to onboard new creators.
- **"Launch surfaced accessibility gaps"** → Theme D (a11y deepening). Credibility over features.

No theme is wrong. The point of Phase 2 is to keep shipping one theme at a time.
