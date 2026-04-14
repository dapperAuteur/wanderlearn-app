# Wanderlearn

> A learning platform where every lesson begins with standing inside a real place.

Wanderlearn is an immersive learning platform built around first-person 360° photo, 360° video, drone, and traditional footage captured at nature sites, museums, and culturally significant locations around the world. Each course is anchored to a real place and taught through curriculum built on top of the footage.

**Working name.** Final naming will be revisited before public launch.

## Status

Phase 1 MVP, in active development. Target soft launch: **MUCHO Museo del Chocolate in English and Spanish**, aligned with the 2026 World Cup opener in Mexico City on June 11, 2026.

Everything in this repo is early. Expect breaking changes until Phase 1 is complete.

## What's inside

| Area | Stack |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript (strict) |
| Styling | Tailwind v4, shadcn/ui, Radix primitives |
| Database | Neon Postgres via Drizzle ORM |
| Auth | Better Auth (self-hosted, no third-party branding) |
| Media | Cloudinary (images, audio, standard video, 360° photo + video, transcripts) |
| Immersive player | Photo Sphere Viewer for multi-scene tours, Cloudinary Video Player (`vrMode`) for single-video 360° |
| Payments | Stripe Checkout |
| Email | Resend |
| Offline | Serwist service worker + IndexedDB outbox |
| i18n | Native Next.js `[lang]` routing + hand-written dictionaries (EN, ES at launch) |
| Testing | Playwright (E2E + `axe-playwright` a11y gate), Vitest (unit) |

**Launch gates** (non-negotiable, enforced in CI):

- **Mobile-first** — designed at 320 px, scales up. Test matrix: iPhone SE, iPhone 15, Pixel 8, iPad Mini, desktop 1440.
- **WCAG 2.1 AA** — keyboard reachability, screen-reader support, 44×44 px touch targets, visible focus, `prefers-reduced-motion` honored, transcripts on all video, 2D fallback on all 360° content.
- **Offline-first** — app shell, enrolled lesson metadata, and small media cached; progress + support-chat writes queued in IndexedDB and replayed on reconnect.
- **No AI-generated content, transcription, or translation** — explicit product differentiator. See [plans/00-wanderlearn-phase-1-mvp.md §2.7](plans/00-wanderlearn-phase-1-mvp.md).

## Repo layout

```
wanderlearn-app/              # git repo root, Next.js app root
├── plans/                    # plans + style guide (contracts reviewed before code)
│   ├── README.md             # plan index + numbering convention
│   ├── STYLE_GUIDE.md        # coding rules, re-read before every code task
│   └── 00-wanderlearn-phase-1-mvp.md
├── src/
│   ├── app/[lang]/           # localized routes (en, es)
│   ├── lib/                  # env, locales, auth, cloudinary, stripe…
│   └── proxy.ts              # Next 16's renamed middleware — locale + role gates
├── public/
├── package.json
└── ...
```

Reference material that lives outside the repo, in the parent `wanderlearn/` directory:
- `PRD-insta360 virtual-tour-feature-and-app/` — source PRDs (1, 2, amendments)
- `virtual-tour-kit/` — the original Photo Sphere Viewer reference kit (not a constraint on this app)

## Getting started

**Prerequisites:** Node 20+, pnpm 10+, git.

```bash
# from wanderlearn-app/
pnpm install
cp .env.local.example .env.local   # (when the example file lands)
pnpm dev
```

The app runs at `http://localhost:3000` and redirects to `/en` (or `/es` based on your `Accept-Language` header).

**Common commands:**

```bash
pnpm dev          # Next.js dev server (Turbopack)
pnpm build        # Production build — must be green before commit
pnpm lint         # ESLint
pnpm typecheck    # TypeScript strict check (once the script is added)
pnpm test         # Vitest unit tests (once they land)
pnpm test:e2e     # Playwright end-to-end
pnpm a11y         # axe-playwright + pa11y-ci against critical pages
pnpm db:migrate   # Drizzle migrations against Neon (once db lands)
pnpm db:seed      # Idempotent seed, including MUCHO EN + ES
```

## Plans and style guide

Every change starts with a plan in [`plans/`](plans/README.md) and a re-read of [`plans/STYLE_GUIDE.md`](plans/STYLE_GUIDE.md). The style guide is not a suggestion — it defines the launch gates, the branching rules, and the accessibility contract. If a rule there conflicts with a task, surface the conflict instead of silently deviating.

Plan numbering: `NN-descriptive-slug.md`, two-digit zero-padded, incremented sequentially, sticky once assigned.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch naming, Conventional Commits, PR rules, and the review checklist. Every change lands on its own branch with a Conventional Commit message — no direct commits to `main`.

All participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Reporting issues

- **Security issues** — do not open a public issue. Email Anthony McDonald at the address listed in [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and we will respond within 72 hours.
- **Bugs and UX issues** — for logged-in users, open the in-app support chat (the "Help / Report" button, once week 11 lands). For everyone else, open a GitHub issue with reproduction steps, expected vs actual behavior, and a screenshot if relevant.
- **Feature ideas** — open a discussion rather than an issue, or raise it in the support chat.

## License

All rights reserved for now. A final license decision will be made before public launch. Creators retain full rights to their content; the platform does not claim ownership of uploaded media. See [plans/00-wanderlearn-phase-1-mvp.md §Cross-Cutting Decisions](plans/00-wanderlearn-phase-1-mvp.md) for the IP stance.

## Acknowledgments

- **MUCHO Museo del Chocolate** and **Ana Rita García Lascurain** — flagship launch partner.
- **Photo Sphere Viewer** — MIT-licensed open-source 360° viewer that powers the immersive tours.
- All the creators who will document the places that make this platform worth building.
# wanderlearn-app
