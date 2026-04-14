# Contributing to Wanderlearn

Thanks for helping build Wanderlearn. This document is the short version of our working rules. The long version lives in [`plans/STYLE_GUIDE.md`](plans/STYLE_GUIDE.md) and is **re-read before every code-writing task** — no exceptions.

If a rule here conflicts with the style guide, the style guide wins. If either is wrong for a task you're about to do, surface the conflict in your PR description instead of silently deviating.

---

## Before you start

1. **Read the current plan** in [`plans/`](plans/README.md). Know what you're solving and why.
2. **Re-read [`plans/STYLE_GUIDE.md`](plans/STYLE_GUIDE.md)** top to bottom. The pre-code checklist in §0 is mandatory.
3. **Confirm the scope with Anthony** for anything non-trivial. Small typo fixes don't need a conversation; architectural moves always do.
4. **Create a new branch** before editing any file.

---

## Launch gates (non-negotiable)

Every pull request must satisfy these before merge:

- **Mobile-first** — layouts designed at 320 px, scaled up via Tailwind breakpoints. Test matrix: iPhone SE, iPhone 15, Pixel 8, iPad Mini, desktop 1440.
- **WCAG 2.1 AA** — keyboard reachability on every interactive element with a visible focus ring, 44×44 px touch targets, `aria-label` on icon-only buttons, Radix Dialog for modals (focus trap + restore), semantic HTML first, color contrast ≥ 4.5:1, `prefers-reduced-motion` respected.
- **Offline-first** — learner-facing changes consider the offline path. App shell, enrolled lesson metadata, and small media are cached; progress + support-chat writes queue through the IndexedDB outbox.
- **No AI-generated content, transcription, or translation.** Creators upload their own. All locale copy is hand-written.

CI enforces these via typecheck, lint, unit, Playwright E2E, and `axe-playwright` + `pa11y-ci` on critical pages. Merges are blocked on any failure.

---

## Branch naming

One logical change per branch. One PR per branch. Never commit directly to `main`.

| Prefix | Use for |
|---|---|
| `feat/<slug>` | New feature |
| `fix/<slug>` | Bug fix |
| `chore/<slug>` | Refactor, tooling, deps, scaffolding |
| `docs/<slug>` | Documentation only |
| `a11y/<slug>` | Accessibility improvement |
| `perf/<slug>` | Performance fix |

Example slugs: `feat/support-chat-widget`, `fix/lesson-player-resume-offset`, `a11y/focus-trap-in-psv`, `docs/readme-contributing-conduct`.

Keep the slug short, kebab-case, and descriptive.

---

## Commit messages (Conventional Commits)

```
type(scope): short imperative subject

Longer body explaining the WHY. Wrap at 72 columns.
Reference the plan: plans/NN-slug.md §Section.
```

**Types:** `feat | fix | chore | docs | refactor | test | perf | a11y | style | build | ci`.

**Scope** (optional but preferred): the area touched — `player`, `builder`, `db`, `support`, `i18n`, `pwa`, `auth`, `stripe`, `cloudinary`, `seed`.

**Subject rules:** lowercase, no trailing period, imperative mood ("add X", not "added X" or "adds X").

**Example:**

```
feat(support): add user↔admin conversation thread schema

Introduces support_threads and support_messages tables plus the
server action layer so learners can open a bug report from any
page in the app.

Implements plans/00-wanderlearn-phase-1-mvp.md §4.7.
```

Keep commits small and logical. It's better to have three focused commits than one sprawling one.

---

## Git rules (hard stops)

- **Never** `git push --force` to a shared branch. Use `--force-with-lease` on your own branch only.
- **Never** `--no-verify`. If a hook fails, fix the cause.
- **Never** `--amend` a commit that has been pushed.
- **Never** commit secrets. `.env.local` is gitignored for a reason.
- **Never** disable TLS verification, `strict-ssl`, or similar "just to make it work." Surface the network problem; don't trade security for convenience.

---

## PR workflow

1. **Push your branch** and open a PR against `main`.
2. **Paste the review checklist** below into the PR description.
3. **Link the plan**: `Implements plans/NN-slug.md §Section`.
4. **CI must pass**: typecheck, lint, unit, E2E, a11y.
5. **At least one reviewer** — currently Anthony until the team grows.
6. **Squash-merge** to keep `main` linear, or rebase-merge if the branch has meaningful intermediate commits worth preserving.
7. **Delete the branch** after merge.

### PR description template

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

## Coding standards (high points)

Full rules in [`plans/STYLE_GUIDE.md`](plans/STYLE_GUIDE.md).

- **TypeScript strict.** No `any`. `unknown` at boundaries; zod to narrow.
- **Server Components by default.** Client Components only when state/effects/refs/browser APIs are needed.
- **Writes go through Server Actions**, not route handlers. Route handlers are reserved for webhooks and presigned upload signing.
- **Server Action return shape**: `type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string }`. No throwing across the server/client boundary for expected errors.
- **Comments:** default to none. Write one only when the WHY is non-obvious. Never explain WHAT — the code already says that.
- **No inline styles** except dynamic transforms or computed colors.
- **Dark mode from day one** — test every new component in both modes.

---

## Testing

- **Playwright** for E2E — at least one happy-path test per critical flow (enroll, take lesson, pay, chat with support, resume offline).
- **Vitest** for pure logic — schema validators, progress calculators, slug generators, tour assemblers.
- **axe-playwright + pa11y-ci** run on the a11y-critical page list in every PR.
- Tests live next to the code (`lesson-player.test.ts`). E2E in `tests/e2e/`.

---

## Where work happens

- **Plans** — [`plans/`](plans/README.md). Source of truth for scope and contracts.
- **Style guide** — [`plans/STYLE_GUIDE.md`](plans/STYLE_GUIDE.md). Source of truth for how we write code.
- **Support chat** — the in-app "Help / Report" widget (once week 11 ships) is how learners reach Anthony directly.
- **Issues** — reserved for bugs and feature discussions visible to the public.

---

## Reporting security issues

**Do not open a public issue for security problems.** Email Anthony McDonald at the address listed in [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and we will acknowledge within 72 hours. Please describe the issue, the potential impact, and steps to reproduce. We will work with you on responsible disclosure before any public write-up.

---

## Code of Conduct

All participation — code, issues, PRs, discussions, in-app support chat, events — is governed by our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). By contributing, you agree to uphold it.

---

## Questions

If you're unsure about scope, design, or process — **ask before guessing**. A five-minute conversation saves a five-hour rewrite.
