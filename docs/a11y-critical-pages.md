# A11y critical pages

These are the pages that MUST pass `axe-playwright` + `pa11y-ci` on
every PR that touches them. Violations on these pages block merge.

Covered locales: `en`, `es`. Each URL is tested in both locales unless
explicitly noted.

## Tier 1: public, launch-blocking

Pages in this tier must pass with zero WCAG 2.1 AA violations. They're
the ones a new visitor reaches without a seed DB.

| Path | Owner | Why critical |
|---|---|---|
| `/[lang]` | Landing | First impression. Indexable. |
| `/[lang]/how-it-works` | Marketing | Linked from the header. Indexable. |
| `/[lang]/sign-in` | Auth | Must be keyboard + screen-reader operable for new users |
| `/[lang]/sign-up` | Auth | Same as sign-in; plus age gate focus handling |

These pages have no DB dependency. They render for unauthenticated
visitors with no seed required, and they're the default suite
`pnpm a11y` runs in CI.

## Tier 2: requires seeded data

Run locally or in a preview environment seeded with the MUCHO course
(`pnpm db:seed`). Same zero-violations bar.

| Path | Seed prerequisite |
|---|---|
| `/[lang]/courses` | At least one published course |
| `/[lang]/courses/mucho-museo-del-chocolate` | MUCHO course seeded |
| `/[lang]/learn/mucho-museo-del-chocolate/the-olmec-origin` | MUCHO course seeded, user enrolled |

These are opted out of the default `pnpm a11y` CI run but must pass
before any public staging push. Runner: `pnpm a11y:seeded`.

## Tier 3: authenticated creator / admin surfaces

Tier-3 pages must be keyboard-operable and pass axe-playwright, but
aren't checked by pa11y-ci (which can't authenticate). The axe suite
picks them up when run with a signed-in Playwright context.

| Path |
|---|
| `/[lang]/creator/courses` |
| `/[lang]/creator/courses/[id]` |
| `/[lang]/creator/courses/[id]/translations/[locale]` |
| `/[lang]/creator/media` |
| `/[lang]/creator/destinations` |
| `/[lang]/admin/users` |
| `/[lang]/admin/courses` |
| `/[lang]/admin/support` |
| `/[lang]/support` |
| `/[lang]/support/new` |

## Deliberately out of scope

- **Cloudinary-hosted media** (images and video). These live on a
  third-party domain; we can't audit them with our axe runner. Caption
  + alt-text requirements are enforced at the publish gate.
- **PSV (Photo Sphere Viewer) viewport** interactions. The viewer has
  its own a11y story (keyboard controls, focus trap on fullscreen)
  that the plugin owns. We rely on the upstream lib's own tests.
- **PDFs** (certificate). Axe doesn't audit PDFs; keep layout simple
  and rely on Acrobat's own structure checks.

## How to run locally

```bash
# Tier 1 (no DB needed):
pnpm dev  # in another terminal
pnpm a11y

# Tier 1 + Tier 2 (needs DATABASE_URL + seeded MUCHO):
pnpm db:migrate
SEED_CREATOR_EMAIL=you@example.com pnpm db:seed
pnpm dev  # in another terminal
pnpm a11y:seeded
```

Playwright browsers need a one-time install: `pnpm exec playwright install chromium`.

## Adding a new page

When you add a public-facing page under `/[lang]/`, update this doc
AND add the URL to `.pa11yci.json` + the matching Playwright test in
`tests/a11y/`. The PR checklist in STYLE_GUIDE §13 reminds you to do
this.
