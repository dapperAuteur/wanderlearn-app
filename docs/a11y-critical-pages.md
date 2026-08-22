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
| `/[lang]/help` | Support | Linked from the header, footer, and the Get help button. Indexable. |
| `/[lang]/docs/transcripts` | Accessibility | The page every missing-transcript notice links to. It would be embarrassing for it to have violations. |
| `/[lang]/help/<slug>` | Support | Article template shared by all 7 articles. Tested via `upload-media`. |
| `/[lang]/sign-in` | Auth | Must be keyboard + screen-reader operable for new users |
| `/[lang]/sign-up` | Auth | Same as sign-in; plus age gate focus handling |
| `/[lang]/forgot-password` | Auth | Password recovery entry point. Locked-out users reach it under stress. |
| `/[lang]/reset-password` | Auth | Audited with `?token=` so the form renders, not just the refusal state. |

These pages have no DB dependency. They render for unauthenticated
visitors with no seed required, and they're the default suite
`pnpm a11y` runs in CI.

## Tier 2: requires seeded data

Run locally or in a preview environment seeded with the MUCHO course
(`pnpm db:seed`). Same zero-violations bar.

| Path | Seed prerequisite |
|---|---|
| `/[lang]/tours` | At least one published tour |
| `/[lang]/tours/<slug>?start=1` | At least one published tour. **The viewer itself**, discovered from the catalogue rather than hardcoded — see below. |
| `/[lang]/courses` | At least one published course |
| `/[lang]/courses/mucho-museo-del-chocolate` | MUCHO course seeded |
| `/[lang]/learn/mucho-museo-del-chocolate/the-olmec-origin` | MUCHO course seeded, user enrolled |

These are opted out of the default `pnpm a11y` CI run but must pass
before any public staging push. Runner: `pnpm a11y:seeded`.

## Tier 3: authenticated creator / admin surfaces

| `/[lang]/creator/destinations/[id]/connections` | Creator | Connections editor + tour map; manual keyboard/375px/dark pass required — percent inputs are the keyboard path for pin placement |

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
| `/[lang]/account` |
| `/[lang]/account/passport` |

`/[lang]/account/passport` is a learner-facing page behind a sign-in, which is
an unusual combination here — Tier 3 is otherwise creator and admin tooling. It
belongs in the authenticated tier because it needs a session, but it should be
held to the learner-facing bar rather than the tooling bar: it is somewhere
people will visit for pleasure, on a phone, possibly outdoors. Check it at
375px and in both themes.

Both are `noindex`: a record of where someone has been is nobody else's
business.

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

### If the run is slow or flaky, use a production build

`pnpm dev` compiles each route on first request, and the first 320px `/en` test routinely blows
Playwright's 60 second navigation budget doing it. That surfaces as a timeout, not an assertion
failure, and it is not a real regression. Run against `next start` instead:

```bash
pnpm build
pnpm exec next start -p 3120                      # in another terminal
PLAYWRIGHT_NO_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3120 \
  pnpm exec playwright test tests/a11y --workers=2
```

Measured 2026-08-15: **1.2 minutes and no flakes**, against 8 to 9 minutes with the dev server.
Routes are already compiled, so the first hit costs nothing and `--workers=2` is safe again. It
is also closer to what CI and real visitors execute, which makes it the more honest gate.

## Adding a new page

When you add a public-facing page under `/[lang]/`, update this doc
AND add the URL to `.pa11yci.json` + the matching Playwright test in
`tests/a11y/`. The PR checklist in STYLE_GUIDE §13 reminds you to do
this.


## Tour coverage, and why it is discovered rather than seeded

`tests/a11y/tours.spec.ts` audits the tour catalogue and the 360° viewer, plus two things axe
cannot check on its own: that every scene-link arrow has an accessible name, and that one can
actually be operated from the keyboard.

**Until 2026-08 there was no tour coverage at all.** The suite audited only routes that render
without content, because those are trivial to automate. Tours need real destinations, so the most
distinctive surface in the product was never scanned — and a CRITICAL defect lived there for the
entire life of the feature: the scene-link arrows announced as "button" with no destination. It was
found by hand, on an unrelated errand.

The reason it stayed unwritten was the seed fixture. Building a believable multi-scene tour
(panoramas, links, arrival headings) is real work, so coverage sat at zero while waiting for
perfect. The spec instead **reads `/en/tours` and audits whatever it finds**, which:

- needs no fixture, so it exists;
- exercises real creator data, which is where the odd cases are (the tour that exposed the
  "Stop 9 of 9" bug begins at a scene photographed ninth — no invented fixture would look like
  that);
- skips cleanly on an empty catalogue rather than failing.

The trade is that it is not hermetic: it audits whichever tour is first in the catalogue, so
coverage varies with the data. That is a real weakness and an acceptable one, because the
alternative on offer was nothing.

Run it with `PLAYWRIGHT_SEEDED=1`.

**Timing matters here more than elsewhere.** Photo Sphere Viewer mounts, loads a panorama, and only
then renders its arrows. Auditing on `load` scans a page with no arrows on it — which would have
passed happily while the arrows were unlabelled. The spec waits for the viewer container and then
for the arrows to draw.