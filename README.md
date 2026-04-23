# Wanderlearn

Immersive 360° place-based learning.

Live at [wanderlearn.witus.online](https://wanderlearn.witus.online). Part of the WitUS ecosystem: cross-linked with [CentenarianOS Academy](https://centenarianos.com) (Wanderlearn preview blocks embed inside Academy lessons) and [Fly.WitUS](https://fly.witus.online) (BVC drone footage pushes into Wanderlearn via a shared Cloudinary tenant). Operated by B4C LLC / AwesomeWebStore.com. Built by [Brand Anthony McDonald](https://brandanthonymcdonald.com).

## About

Every Wanderlearn course is anchored to a real location captured in 360° photo, 360° video, and drone footage. One person with a camera, a drone, and a laptop can publish a full multi-media course. Learners stand inside the place — a museum gallery, a trail, a workshop, a reef — then read, watch, and answer quizzes built on top of the footage. No AI-generated content, no stock imagery, no fabricated voices.

The course library is fed by BAM's field-content capture trips. The flagship is MUCHO Museo del Chocolate in Mexico City; the 2026-06 West Africa trip feeds a Ghana course (see `../../witus/plans/travel/` for trip context).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` |
| Database | Neon Postgres via Drizzle ORM (neon-serverless driver) |
| Auth | Better Auth — magic link, email OTP, passkey, 2FA |
| Media | Cloudinary (primary; R2 fallback documented in `docs/INFRA.md`) |
| 360° viewer | Photo Sphere Viewer (core + markers + video + virtual-tour + equirectangular-video-adapter) |
| Markdown | `marked` + `sanitize-html` |
| Payments | Stripe Checkout + webhook |
| Email | Mailgun |
| PDFs | pdf-lib (completion certificates) |
| i18n | Native Next.js `[lang]` routing — EN + ES |
| Offline | Serwist service worker + IndexedDB progress outbox |
| Testing | Playwright + axe-core + pa11y-ci |
| Hosting | Vercel |

## Features

- **Media library** — signed Cloudinary uploads for image, audio, standard video, 360° photo, 360° video, drone video, transcripts, support attachments. Tags, soft + hard delete, reference blocker.
- **Destinations + scenes** — real places, 360° vantage points, click-to-place hotspots and scene links for navigable tours.
- **Courses + lessons + blocks** — six block types: `text`, `photo_360`, `video`, `video_360`, `quiz`, `virtual_tour`.
- **Learner flow** — catalog, course detail, free enrollment, Stripe checkout for paid courses, lesson player, resume-across-devices, PDF certificate on 100% completion.
- **i18n** — translation overlay via `course/lesson/block_translations`; EN default, ES wired; CSV-driven translator templates via `pnpm db:gen-template` + in-app translation editor.
- **Publish gate** — `submitCourseForReview` enforces transcripts on video, ready-state on 360° media, non-empty lessons. Admin approval inbox at `/admin/courses`.
- **Support chat (status: beta)** — threaded learner-to-admin conversations with Mailgun notifications on both sides. See Known issues.
- **Accessibility** — WCAG 2.1 AA runtime publish gate + axe-playwright + pa11y-ci on public pages on every PR. 2D fallback link on every 360° block.
- **Offline (status: in progress, plan 05)** — service worker, shell precache, learner-route cache, Cloudinary image cache, IndexedDB outbox with auto-replay on reconnect. Per-course "Save for offline" toggle and online/offline UI polish still to land.
- **Public docs** at `/[lang]/docs/{creator,admin}` rendering the guides in `docs/`.

## Known issues

- **Support form has bugs preventing ordinary use** (per `plans/user-tasks/11 D3`). Tracked in `plans/bugs/07-sign-in.md` and `plans/bugs/08-server-error.md`. Resolution required before public launch.
- **MUCHO ES translation is empty.** Source column in `scripts/seed-data/mucho.es.csv` is populated; value column awaits a human translator. EN-only launch is acceptable per 2026-04-19 decision.
- **Privacy / terms are drafts.** Stubs at `/privacy` and `/terms` carry an amber "pending legal review" banner. Counsel-reviewed text required before public launch.

## Quick Start

```bash
pnpm install
cp .env.local.example .env.local   # fill Neon, Better Auth, Cloudinary, Stripe, Mailgun
pnpm db:migrate
SEED_CREATOR_EMAIL=you@example.com pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). For authoring + admin workflows, see `docs/CREATOR_GUIDE.md` and `docs/ADMIN_GUIDE.md`.

## Project Structure

```
wanderlearn-app/
├── src/
│   ├── app/
│   │   ├── [lang]/
│   │   │   ├── layout.tsx           # header, footer, FAB
│   │   │   ├── page.tsx             # landing
│   │   │   ├── courses/             # learner catalog + course detail
│   │   │   ├── learn/               # lesson player
│   │   │   ├── creator/             # media / destinations / courses authoring
│   │   │   ├── admin/               # users / courses review / support inbox
│   │   │   ├── docs/                # public creator + admin guides
│   │   │   ├── accessibility, privacy, terms, how-it-works, support
│   │   │   ├── sign-in, sign-up
│   │   │   └── dictionaries/        # EN + ES
│   │   ├── api/                     # auth, media signing, webhooks, offline-sync
│   │   └── sw.ts                    # Serwist service-worker source
│   ├── components/                  # blocks, virtual-tour, media, layout, support, offline
│   ├── db/
│   │   ├── schema/                  # auth, courses, media, scenes, commerce, translations, support, reviews
│   │   ├── queries/                 # typed Drizzle queries
│   │   └── migrations/
│   └── lib/                         # actions, cloudinary, stripe, mailer, publish-gates, translate, offline-outbox
├── scripts/                         # migrate, seed-mucho, gen-translation-template, promote-user
├── docs/                            # CREATOR_GUIDE, ADMIN_GUIDE, INFRA, CLOUDINARY_*, a11y-critical-pages
├── plans/                           # numbered plan files + bugs + ecosystem references
├── tests/a11y/                      # Playwright + axe + pa11y-ci
└── public/                          # static assets, sw.js build output
```

## Ecosystem position

Wanderlearn is one of eight WitUS-ecosystem products. Ecosystem-level conventions (shared Cloudinary tenant, per-app folder prefix, cross-app hand-offs) are in `docs/CLOUDINARY_FOLDER_CONVENTION.md`. Cross-app integrations (BVC footage from Fly.WitUS, Academy preview blocks from CentenarianOS) are scoped in `plans/04-phase-2-roadmap.md` Theme C.

## Deployment

Vercel. Pushes to `main` trigger production deploys. Env vars (Neon, Better Auth, Cloudinary, Stripe, Mailgun, `ADMIN_NOTIFY_EMAIL`) must be set for the Production scope — see `docs/INFRA.md` for the full table.

```bash
npx vercel --prod
```

## License

Proprietary B4C LLC / AwesomeWebStore.com.
