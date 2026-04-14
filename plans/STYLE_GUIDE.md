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
- **Verify every webhook signature** (Clerk Svix, Stripe, Cloudinary). Reject unsigned requests.
- **Role-gate every creator/admin server action** via `requireCreator()` / `requireAdmin()` helpers.
- **Never trust client-supplied user IDs.** Always derive the acting user from Clerk session server-side.
- **Escape HTML** in user-generated content (support chat messages, course descriptions, hotspot content_html). Use a vetted sanitizer (DOMPurify) server-side before render.
- **Rate-limit** public endpoints (sign-in attempts, support message creation, upload signing) via Vercel KV or Upstash.
- **CSP header** set in `next.config.ts` — allow only the expected origins (Cloudinary, Clerk, Stripe, PostHog, Resend images).

---

## 15. When in doubt

- Ask Anthony before guessing.
- Prefer fewer features done well to more features half-done.
- If this guide is wrong for the task at hand, say so and propose an amendment — don't silently deviate.
