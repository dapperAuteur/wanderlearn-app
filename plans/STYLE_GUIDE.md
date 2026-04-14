# Wanderlearn Style & Coding Guide

**This file is re-read before every code-writing task. No exceptions.**

If a rule here conflicts with a new request, pause and surface the conflict instead of silently deviating.

---

## 0. Pre-code checklist (run every time)

Before touching any file for a new task:

1. Re-read this guide top to bottom.
2. Confirm the current plan in `plans/` — what problem are we solving?
3. Create a new git branch for the change (see §12).
4. Write the test or verification approach FIRST if the change is non-trivial.
5. Only then start editing code.

---

## 1. Naming

| Kind | Convention | Example |
|---|---|---|
| Files | kebab-case | `lesson-player.tsx` |
| React components | PascalCase | `LessonPlayer` |
| Hooks | `useCamelCase` | `useEnrollmentStatus` |
| Server Actions | camelCase verb | `upsertProgress` |
| DB tables | snake_case plural | `lesson_progress` |
| DB columns | snake_case | `created_at` |
| Enum values | snake_case | `in_review` |
| Env vars | SCREAMING_SNAKE_CASE | `CLOUDINARY_API_SECRET` |
| URL routes | kebab-case | `/creator/courses/new` |

No Hungarian notation. No `I` prefix on interfaces.

---

## 2. Accessibility non-negotiables (WCAG 2.1 AA)

These are launch gates. CI blocks merges that fail them.

- **Semantic HTML first.** Use `<button>`, `<nav>`, `<main>`, `<article>`, `<fieldset>` before reaching for `role=`.
- **Every interactive element keyboard-reachable** with a visible focus ring. Never `outline: none` without an equivalent replacement.
- **Minimum touch target 44×44 px** on all clickable/tappable elements.
- **Icon-only buttons require `aria-label`**. Decorative icons get `aria-hidden="true"`.
- **Modals use Radix Dialog** (focus trap + restore built in). Never roll your own.
- **Form inputs always paired with `<label>`.** Errors via `aria-describedby` + `aria-invalid`.
- **Color contrast**: ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI components. Design tokens in `tailwind.config.ts` are pre-checked.
- **Respect `prefers-reduced-motion`**: disable auto-rotate, autoplay, parallax, and long transitions.
- **Captions/transcripts required** on any course video before it can be published — enforced at the publish server action.
- **2D fallback mandatory** for every `photo_360` and `video_360` block — enforced at the block editor.
- **Screen reader pass** (VoiceOver iOS + macOS, TalkBack Android) before every public staging push.
- **CI gates**: `axe-playwright` and `pa11y-ci` run on the critical pages listed in `docs/a11y-critical-pages.md`.

---

## 3. Mobile-first rules

- **Design at 320 px first**, scale up via Tailwind `sm md lg xl` breakpoints. Never start at desktop and squish down.
- **No fixed pixel widths** on layout containers. Use `max-w-*` + fluid units.
- **Safe-area insets** on iOS via `env(safe-area-inset-*)` — the lesson player's bottom bar must respect them.
- **Thumb-friendly primary nav**: bottom tab bar on mobile, top nav on desktop.
- **Responsive media**: Cloudinary `w_auto`, `q_auto`, `f_auto` + `srcset` on every `<img>` and every video poster.
- **Test matrix** before merging any learner-facing UI change: iPhone SE (smallest), iPhone 15, Pixel 8, iPad Mini, desktop 1440.
- **Performance budget (learner routes)**: `<150 KB` gzipped JS above the fold, LCP < 2.5s on a mid-range Android, CLS < 0.1.
- **The creator course editor is documented as desktop-first.** Mobile authoring is out of scope for Phase 1.

---

## 4. Offline-first rules

- **Service worker**: Serwist. Register once in root layout. Scope limited to learner + public routes — creator and admin UIs are online-only.
- **App shell cached** on first load: HTML, JS, CSS, fonts, logo, sign-in page.
- **Enrolled lessons**: metadata + small media (text, transcripts, images, short audio) cached on first visit. Large video only on explicit "Save for offline".
- **Progress queue**: writes hit an IndexedDB outbox FIRST, then sync to server. Use `navigator.onLine` + background sync. Conflict resolution: last-write-wins by `updated_at`, server tiebreaker.
- **Licensed content gate**: cached media carries a `validUntil` tied to enrollment status. Replay checks auth before serving.
- **Support chat messages** also queue via the outbox when offline.
- **No stale-forever caches**: everything has a TTL. Service worker bumps cache version on deploy.

---

## 5. Component architecture

- **Server Components by default.** Use Client Components only when you need `useState`, `useEffect`, refs, or browser APIs.
- **Writes go through Server Actions**, not route handlers. Route handlers are reserved for webhooks and presigned upload signing.
- **Server Action return shape**: `type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string }`. No throwing across the server/client boundary for expected errors.
- **No prop drilling past 2 levels.** Either hoist data to the server component or use a tight local context.
- **File co-location**: a component's styles, hooks, and tests live next to it.

---

## 6. Styling

- **Tailwind + shadcn/ui + Radix.** No CSS-in-JS. No raw CSS files except `globals.css` for tokens/resets.
- **Design tokens** in `tailwind.config.ts` — spacing scale, color palette, font sizes, z-index. Never use magic numbers.
- **Dark mode from day one.** Test every new component in both modes.
- **No inline `style` prop** except dynamic transforms (e.g., PSV camera position) or computed colors.

---

## 7. TypeScript

- **`strict: true`** in tsconfig. No `any`. `unknown` is fine at boundaries.
- **Zod validate every external input**: env vars (at startup), API route bodies, webhook payloads, URL params, localStorage reads.
- **Infer types from zod schemas** via `z.infer<typeof schema>` — don't duplicate.
- **Discriminated unions** for any "type + data" shape (content blocks, server action results, notification events).
- **No non-null assertions (`!`)** unless there's a comment explaining the invariant.

---

## 8. Database (Drizzle + Neon)

- **Schema files split per domain** in `src/db/schema/` — never one mega-file.
- **Every migration reviewed in PR.** No destructive migrations (drop column, drop table, rename without a down-path) without explicit approval.
- **Seeds are idempotent.** Running `pnpm db:seed` twice is a no-op.
- **Indexes** on every foreign key and every column used in a `where`/`order by`.
- **No raw SQL** except in migration files or documented performance escape hatches.
- **All writes via Server Actions or route handlers**, never from Client Components directly.

---

## 9. Error handling

- **At boundaries only.** Internal code trusts its inputs; validation happens once at the edge.
- **Server Actions return discriminated results** (see §5).
- **No try/catch for control flow.** Catch only when you need to translate an error or fall back.
- **Log at the boundary that handled the error**, not at every level on the way up.
- **User-facing messages** never leak implementation details. Internal logs carry the full stack.

---

## 10. Comments

- **Default: write none.**
- **Write a comment only when the WHY is non-obvious**: a hidden constraint, a subtle invariant, a workaround for a specific bug. One short line max.
- **Never explain WHAT** — the code already says that.
- **Never reference the current task/PR/issue** — that rots as the codebase evolves. Put it in the PR description instead.

---

## 11. Testing

- **Playwright for E2E** — at least one happy-path test per critical flow (enroll, take lesson, pay, chat with support, resume offline).
- **Vitest for pure logic** — schema validators, progress calculators, slug generators, tour assemblers.
- **`axe-playwright`** runs on the a11y-critical page list in every PR.
- **No snapshot tests** unless they cover content that genuinely should never change.
- **Tests live next to the code** (`lesson-player.test.ts`) for co-located units; E2E in `tests/e2e/`.

---

## 12. Git workflow (branch per change)

**One branch per logical change. One PR per branch.** No direct commits to `main`.

### Branch naming

- `feat/<slug>` — new feature
- `fix/<slug>` — bug fix
- `chore/<slug>` — refactor, tooling, deps
- `docs/<slug>` — documentation only
- `a11y/<slug>` — accessibility improvement
- `perf/<slug>` — performance fix

Examples: `feat/support-chat-widget`, `fix/lesson-player-resume-offset`, `a11y/focus-trap-in-psv`.

### Commit messages (Conventional Commits)

```
type(scope): short imperative subject

Longer body explaining the WHY. Wrap at 72 cols.
Reference the plan: plans/NN-slug.md.
```

Types: `feat | fix | chore | docs | refactor | test | perf | a11y | style | build | ci`.

Scope (optional but preferred): the area touched — `player`, `builder`, `db`, `support`, `i18n`, `pwa`, `auth`, `stripe`, `cloudinary`, `seed`.

Subject: lowercase, no trailing period, imperative mood ("add X", not "added X" / "adds X").

**Example:**
```
feat(support): add user↔admin conversation thread schema

Introduces support_threads and support_messages tables plus the
server action layer so learners can open a bug report from any page.

Implements plan plans/00-wanderlearn-phase-1-mvp.md §Support chat.
```

### PR rules

- PR description uses the template in §13.
- One reviewer minimum (Anthony, until the team grows).
- CI must pass: typecheck, lint, unit, E2E, a11y.
- Never `git push --force` to a shared branch. Use `--force-with-lease` on your own branch only.
- Never `--no-verify`. If a hook fails, fix the cause.
- Never `--amend` a pushed commit.

### When NOT to branch

Literal typo fixes and comment-only edits may go on a `chore/` branch but should still be PR'd — keeps history clean and enables rollback.

---

## 13. PR review checklist (paste into every PR description)

```md
## Summary
<1–3 bullets on what changed and why>

## Plan reference
plans/NN-slug.md §Section

## Review checklist
- [ ] Mobile-first layouts pass the test matrix (iPhone SE, iPhone 15, Pixel 8, iPad Mini, desktop 1440)
- [ ] Keyboard-only walkthrough works for every new interactive element
- [ ] Screen reader announces state changes (VoiceOver or TalkBack smoke)
- [ ] Contrast ratios pass axe
- [ ] `prefers-reduced-motion` respected
- [ ] Offline path considered (cacheable? queueable?)
- [ ] Perf budget: JS < 150 KB gz on learner routes
- [ ] Zod at every new external boundary
- [ ] No `any`, no `!`, no `console.log` left in
- [ ] Typecheck + lint + unit + E2E + a11y green
- [ ] No destructive DB migrations
- [ ] Commit messages follow Conventional Commits
- [ ] Plan / STYLE_GUIDE updated if this change establishes a new pattern
```

---

## 14. Security basics

- **Never commit secrets.** Secrets live in `.env.local` (gitignored) and Vercel env vars.
- **Verify every webhook signature** (Stripe, Cloudinary). Reject unsigned requests.
- **Role-gate every creator/admin server action** via `requireCreator()` / `requireAdmin()` helpers from `@/lib/rbac`.
- **Never trust client-supplied user IDs.** Always derive the acting user from the Better Auth session (`getSession()` / `requireUser()`) server-side.
- **Escape HTML** in user-generated content (support chat messages, course descriptions, hotspot content_html). Use a vetted sanitizer (DOMPurify) server-side before render.
- **Rate-limit** public endpoints (sign-in attempts, support message creation, upload signing) via Vercel KV or Upstash.
- **CSP header** set in `next.config.ts` — allow only the expected origins (Cloudinary, Stripe, PostHog, Resend images). Better Auth is same-origin so it needs no extra CSP allowance.

---

## 15. SEO, sharing, and marketing (launch gate)

Every public page must be indexable, shareable, and marketable. The goal: a link to any Wanderlearn page dropped into iMessage, Slack, Twitter, or Google's index gives a rich, accurate, beautiful preview — in the user's language. This is a launch gate, not a nice-to-have.

### Per-page metadata (required on every new page)

- **Export `generateMetadata`** from every page or layout that renders content. Never rely on the root layout's defaults for anything beyond the app shell.
- **Required fields** on public pages: `title`, `description`, `alternates.canonical`, `alternates.languages` (from `@/lib/site#localizedAlternates`), `openGraph` (`type`, `title`, `description`, `url`, `locale`, `siteName`), `twitter` (`card: "summary_large_image"`, `title`, `description`).
- **Private pages** (sign-in, sign-up, creator, admin, support) set `robots: { index: false, follow: true }` (or `follow: false` for admin/creator) and still include `title` + `description` so link previews in internal Slack/email look OK.
- **Canonical URLs** always absolute via `@/lib/site#absoluteUrl(path)`. Never bare paths in canonical.
- **`hreflang`** via `alternates.languages` on every localized route, pointing at the same path in every supported locale plus an `x-default`.
- **Title template** inherits from the root layout (`%s · Wanderlearn`). Page-level titles should be the bare page name — the template adds the suffix.

### Structured data (JSON-LD)

- **Landing page**: `Organization` schema (name, url, logo, description, sameAs links to social).
- **Course detail pages** (when they ship): `Course` schema (name, description, provider, inLanguage, image, offers).
- **Breadcrumbs** on deep routes: `BreadcrumbList` schema.
- Embed via Metadata `other: { "application/ld+json": JSON.stringify(...) }`.

### Open Graph images

- **Every page** either inherits the site-default OG image or exports its own `opengraph-image.tsx` / `opengraph-image.png`. No broken social previews.
- **OG images are 1200×630** (the universal size that works for Twitter, Facebook, LinkedIn, iMessage, Slack).
- For course / lesson pages, generate the OG image dynamically from the course hero + title via `next/og#ImageResponse`. Cache it — generation is expensive.
- **Test the preview** via <https://www.opengraph.xyz> or Twitter's Card Validator before merging any public page.

### Sitemap and robots

- **`public/sitemap.xml`** lists every public, indexable URL in every locale with `hreflang` alternates. Update when public routes change.
- **`public/robots.txt`** allows `/`, disallows `/api/`, `/*/admin/`, `/*/creator/`, `/*/sign-in`, `/*/sign-up`, `/*/support`. Points at the sitemap.
- Prefer Next's dynamic `app/sitemap.ts` + `app/robots.ts` when they work with the route tree; fall back to static files in `public/` when the dynamic segment (e.g. `[lang]`) shadows them.

### Content hygiene

- **One `<h1>` per page** — the heading is almost always the page title.
- **Alt text on every image**. Decorative images get `alt=""` + `aria-hidden="true"`, never missing `alt`.
- **Descriptive link text** — never "click here". Screen readers and Google both penalize it.
- **Semantic landmarks** (`<main>`, `<nav>`, `<header>`, `<footer>`, `<article>`) on every page — Google uses them for rich results.
- **Meta description** is 140–160 characters, matches the page's real content, hand-written (no machine generation per plan §2.7).

### Performance is SEO

- **Core Web Vitals**: LCP < 2.5s, CLS < 0.1, INP < 200ms on mid-range Android. Same budget as the mobile-first rules in §3.
- **Next/Image** for every raster image. Never `<img>`. Except Cloudinary-delivered URLs where we pass `unoptimized` so Cloudinary's own transforms run.
- **Font display**: `font-display: swap` on all webfonts. No invisible text during load.
- **No client JS on static pages** unless absolutely needed. The landing page has zero client components as of v1.

### CI gates

- `axe-playwright` covers the technical accessibility side (§2).
- Add `lighthouse-ci` to the PR pipeline when the domain is live. Fail the PR on an SEO score below 90.
- Preview-deploy URLs run through <https://cards-dev.twitter.com/validator> and <https://developers.facebook.com/tools/debug/> manually before merge for any public-page change.

### When you add a new public page

Before merging any new page under `/[lang]/`, run through this checklist:

- [ ] `generateMetadata` exported, returns title, description, canonical, hreflang, openGraph, twitter
- [ ] Matching OG image (site default or page-specific)
- [ ] Semantic HTML with exactly one `<h1>`
- [ ] All images have alt text
- [ ] Added to `public/sitemap.xml` (or dynamic sitemap if working)
- [ ] Link preview tested on Twitter + Slack + iMessage
- [ ] Google Rich Results test passes if structured data is present
- [ ] Core Web Vitals budget met locally

---

## 16. When in doubt

- Ask Anthony before guessing.
- Prefer fewer features done well to more features half-done.
- If this guide is wrong for the task at hand, say so and propose an amendment — don't silently deviate.
