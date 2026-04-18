# 03 — Phase 1 MVP closeout

**Status:** Active. The final ~10% of plan 00.
**Target:** June 11, 2026 public soft launch with MUCHO in EN + ES.
**Depends on:** nothing hard — this is the tail of plan 00, scoped to what remains.

## Why this plan exists

Plan 00 is ~90% shipped. This plan lists what remains — not as new features, but as the specific work between "almost done" and "public launch." Some of it is content work BAM owns, some is engineering, some is manual QA. All of it is bounded.

## Remaining items, by category

### Content authoring (BAM owns)

Cannot be done by code. Blocks launch.

- **MUCHO EN 360° content** — capture + upload + scene build at the real destination. Every lesson should have at least one 360° block pulling from MUCHO scenes. Estimated effort: one visit + a weekend of upload/scene work.
- **MUCHO ES human translation** — fill `scripts/seed-data/mucho.es.csv`. All course/lesson/block strings. Then `pnpm db:seed`. Estimated effort: ~1 day for a fluent translator, budget for editing.
- **Legal text** — real privacy + terms from counsel or a template service (Termly, iubenda, Vanta). Stubs in `/privacy` and `/terms` today are NOT sufficient for public launch. Estimated effort: 1–3 days depending on service.

### Engineering — launch gates

Branches queued to write; none started.

- **`feat/offline-shell`** — week 7's remaining half. Serwist service worker + app-shell cache + IndexedDB outbox for lesson-progress writes + "Save for offline" per-course toggle. **Optional for June 11**: plan 00 allows slipping this to Phase 1.2 if the date is tight.
- **`fix/homepage-mucho-cta`** — the flagship section on `/` is a plain `<section>`. Wrap the MUCHO title in a link to `/[lang]/courses/mucho-museo-del-chocolate`. Five-line change.
- **`chore/remove-em-dashes`** — mechanical cleanup per `plans/bugs/copy.md`. Rewrite every "' — '" in EN dictionaries and static text. ES and other translations follow from the source.
- **`feat/posthog-analytics`** — wire PostHog for product analytics. Key events: course_view, enroll_free, enroll_paid_started, enroll_paid_succeeded, lesson_complete, certificate_download. Needs event-taxonomy decision first. Small branch once decided.
- **`feat/revenue-dashboard-link`** — not a full dashboard. Just a link from `/admin/courses` to the relevant Stripe dashboard view for that course. One-day task.

### Engineering — stack hardening

- **`fix/neon-serverless-driver`** — today's `db/client.ts` uses `drizzle-orm/neon-http`, which doesn't support transactions (see the deleteBlock fix in `plans/bugs/block-delete-500.md`). Switching to `neon-serverless` lets future multi-statement atomicity work. Not urgent; medium-effort swap; worth doing before Phase 2 lands more complex flows.
- **`fix/video-360-scene-poster-derivation`** — `posterMediaId` is now correctly null for video_360 scenes, but no renderer uses the Cloudinary `so_0` transform to derive a 2D still on render. Downstream readers should call the derivation helper; today no consumer reads `posterMediaId` at all so it's latent. Write the renderer-side derivation and wire the a11y gate to actually check 2D fallback availability.

### Manual QA

Not code. Launch-blocking.

- **Mobile test matrix walkthrough** per STYLE_GUIDE §3: iPhone SE, iPhone 15, Pixel 8, iPad Mini, desktop 1440. Open every learner route, enroll in MUCHO, take a lesson, verify the PSV viewer works on touch and on keyboard-only. Record any failures.
- **End-to-end test of paid enrollment** against the real Stripe account. Purchase MUCHO (at a test price if it's still free), confirm receipt email arrives, confirm enrollment shows up on return to the course, confirm certificate downloads after marking all lessons complete.
- **VoiceOver pass** on iOS Safari for the learner player. TalkBack on an Android device if one's available. Log any announcements that are missing or misleading.
- **Lighthouse CI** on the learner routes — no automated tooling yet, but a one-time audit before launch.

### Documentation closeout

- **Legal policies** (see Content above) — the `/privacy` and `/terms` stubs need to be replaced, not just updated.
- **Launch runbook** — a one-page `docs/LAUNCH_RUNBOOK.md` covering: what to deploy when, how to monitor the first 24 hours, who to page on incident. Small doc; draft over coffee.
- **Status-report refresh (#3)** — update `plans/reports/00-phase-1-status.md` after the items above land. Keeps the public-facing record honest.

## Branch order recommendation

By leverage toward public launch:

1. **Content, content, content** (BAM, in parallel with engineering)
   - MUCHO 360° capture + upload + scenes
   - MUCHO ES translations
   - Legal policy text
2. **`fix/homepage-mucho-cta`** — five-minute fix; removes a UX papercut
3. **`feat/revenue-dashboard-link`** — tiny admin win
4. **Mobile test matrix walkthrough** — surfaces whatever's actually broken
5. **Fix whatever the matrix walkthrough finds** — individual `fix/*` branches
6. **VoiceOver / TalkBack pass** — fix whatever it finds
7. **`feat/offline-shell`** — only if timeline allows; otherwise slip to 1.2
8. **`feat/posthog-analytics`** — ship with or without launch, non-blocking
9. **Status report refresh** — right before launch
10. **Launch runbook** — right before launch

## What success looks like

A new learner — who has never heard of Wanderlearn — can:

1. Land on [/en](/en).
2. Click through to MUCHO.
3. Enroll (free) or pay (via Stripe).
4. Take every lesson on an iPhone SE with voiceover on.
5. Complete the course.
6. Download their certificate.
7. Click the footer "Accessibility" and "Privacy" links without seeing a 500.

All of the above works end-to-end in both `en` and `es`. That's the launch bar.

## What this plan does NOT try to solve

- Memberships / subscriptions (Phase 2).
- Global creator search (plan 01 Phase 2 straggler).
- Support attachments (screenshots in threads).
- BVC footage integration with Fly.WitUS (Phase 2).
- Academy preview block for CentenarianOS (Phase 2).
- Audio descriptions on videos (post-launch accessibility iteration).

All of those are legitimate eventual work. None is on the June 11 critical path.

## Decisions still to make

1. **Does offline ship in 1.0 or slip to 1.2?** The plan 00 author left this open. Recommendation: slip. Server-side resume already works across devices; offline reading is a polish feature; the June 11 pressure is real.
2. **Is launch EN-only with ES-later acceptable?** If the ES translator isn't ready by June 11, do we ship EN-only and add ES as a 1.1? Plan 00 originally committed to both at launch; reality may differ.
3. **What's MUCHO's launch price?** Free for the flagship month? $5 intro? Full price? Affects Stripe config and marketing.

These three are BAM's calls. Recording them here so they don't get lost.

## When this plan closes

Close this plan the day after the public launch. Delta between "this plan as written" and "what actually shipped" gets recorded in `plans/reports/01-launch-debrief.md` (a file that doesn't exist yet and shouldn't until launch happens).
