# Wanderlust Style Guide

The contract every commit to this repo agrees to. If a change can't satisfy these, the change isn't ready.

Read this before writing code in this repo. Re-read it when a section feels stale — the project's standards evolve and the guide is the single source of truth.

---

## Launch gates (non-negotiable)

Every learner-facing surface must pass all three before it can merge to `main`:

### Mobile-first

- Design at **375×667** (smallest supported viewport) first; scale up with Tailwind responsive prefixes (`sm:`, `lg:`).
- Touch targets are **minimum 44×44 px**. Tailwind: `min-h-11` for compact controls, `min-h-12` for primary actions.
- No horizontal scroll at any width ≥ 320 px.
- Test in a real mobile viewport (browser devtools at 375×667 minimum, real-device pass before merging anything novel).

### WCAG 2.1 AA accessibility

- Keyboard navigability everywhere — every interactive element reachable via Tab, operable via Enter/Space.
- Focus-visible outlines on every focusable element: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`.
- Color contrast ≥ 4.5:1 for text, ≥ 3:1 for large text and UI components. Verify in **both** light and dark mode.
- Semantic HTML: `<button>` for actions, `<a>` for navigation, headings in order (`<h1>` → `<h2>` → `<h3>`, no skipped levels).
- Form inputs always have associated `<label>` (htmlFor + id) — `aria-label` is the fallback, not the default.
- Live regions for status changes: `role="status" aria-live="polite"` for success banners, `role="alert"` for errors.
- Touch targets ≥ 44×44 (see Mobile-first; the rules overlap).
- Motion respects `prefers-reduced-motion: reduce`. Hover transforms use `motion-safe:`; required animations have an instant-set fallback. See [globals.css](src/app/globals.css) for the existing pattern.
- Image `alt` text is meaningful or empty (`alt=""`) — never the filename.
- Critical pages enumerated in [docs/a11y-critical-pages.md](docs/a11y-critical-pages.md) must pass `pnpm test:a11y` with zero serious/critical axe violations on every PR that touches them.

### Offline-first

- The PWA (Serwist service worker, [src/app/sw.ts](src/app/sw.ts)) caches app shell + lesson content + Cloudinary posters; learner progress writes queue offline and sync on reconnect.
- Creator and admin paths intentionally bypass the cache (always network).
- Any new learner-facing route should be considered for the offline manifest. New "Save for offline" affordances should match the existing per-course toggle on the course detail page.
- Outbound writes that need offline survival route through the outbox pattern, not direct fetch.

---

## Content policy

**No AI-generated content on Wanderlust.** This is an explicit differentiator, not a limitation:

- No AI-written lesson text, course descriptions, scene captions, hotspot content, or transcripts.
- No AI-translated strings. Spanish localization is hand-translated by a human speaker.
- No AI-generated images, panoramas, or 360° video.

Every word and every pixel of content comes from a human who stood in the place, speaks the language, or designed the visual. That's the differentiator partners pay attention to; protect it.

(Tooling vs. content: AI-assisted code, tests, refactors, and dev scaffolding are fine. The "no AI content" rule is about what reaches the learner.)

---

## Git workflow

### Branch per logical change

- One concern per branch. Don't bundle a bug fix into a feature branch; don't sneak a refactor into a bug fix.
- Branch from `main`, push to `origin`, **never merge yourself**. BAM merges via the GitHub UI.
- Branch name = `type/short-slug` matching the commit's Conventional prefix. Examples: `feat/horizon-rotation`, `fix/scene-transitions-smooth`, `docs/style-guide`, `chore/migrate-prod`.

### Conventional Commits

```
type(scope): summary in present tense, under 70 chars

Body explains the why (one or two paragraphs). Include constraints,
trade-offs, and any follow-ups left open. Wrap at ~72 chars.
```

Allowed `type`: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `a11y`, `i18n`.

### Never merge to `main` yourself

End of branch contract: `branch → commit → push → stop`. BAM merges between sessions, often within minutes. If you need a follow-up branch, **re-check `git branch --show-current` before every commit** — mid-session fast-forwards mean your local main may have moved without warning.

### Database migration before merge

Any Drizzle migration must surface a `pnpm db:migrate:prod` reminder as a `plans/user-tasks/NN-run-migration-<slug>.md` entry — without it, the next prod deploy 500s on the missing column. The corresponding feature branch can't merge until the user-task is Done.

### No `--force` to shared branches. No skipping hooks (`--no-verify`).

---

## Plans / bugs / user-tasks discipline

`plans/` is **gitignored** — repo-local scratch for design, runbooks, and operator handoffs. Three subdirectories matter:

### `plans/` (root) and `plans/future/`

Active feature plans live in `plans/`. Backlog / parked plans live in `plans/future/`. Both follow `NN-slug.md` naming, numbered by birth time per directory starting at `00`.

When a backlog item ships, move the file to `plans/dev-process/` (the shipped journal) with a `<!-- Moved from plans/future/ ... -->` banner.

### `plans/app-improvements/`

One file per bug, `NN-slug.md`. Touched-by-branch entries get appended:

```md
## Touched YYYY-MM-DD by `branch-name`

Status: **open** / **fixed** / **pending visual verification**. Describe what changed and what's left.
```

Always check `plans/app-improvements/` before writing code that could affect a known bug. At session end, discuss the bug, append the plan name + resolution.

### `plans/user-tasks/`

Operator handoffs — anything BAM has to do outside the editor (SQL writes, dashboard config, env-var rotations, PR merges). **No exceptions for "small" steps.**

Required sections per task file:
- Scope tag
- What + why (explicit "what this blocks" with any hard deadline)
- Steps
- What Claude will use
- How to mark done
- Related

Index at `plans/user-tasks/00-descriptions.md` with columns `# | Title | Scope | Blocks | Status`. The `Blocks` column is non-negotiable — that's what BAM scans to triage the queue.

`00-descriptions.md` is the index and stays at `00`; real tasks start at `01`. All other dirs reset numbering at `00`.

---

## Code patterns

### i18n (dictionary loader, en + es)

- All user-facing strings live in `src/app/[lang]/dictionaries/{en,es}.json` and are loaded server-side via `getDictionary(lang)`.
- No string literals in components — pass through `dict.<scope>.<key>`.
- Never reach for `next-intl` or similar — the project uses a native dictionary loader by deliberate choice (see [plans/dev-process/01-scaffold-and-style-guide.md](plans/dev-process/01-scaffold-and-style-guide.md)).
- Spanish is the canonical second locale. Every new string lands in both `en.json` and `es.json` in the same commit.

### Accessibility primitives

Standard incantations to reuse verbatim:

```tsx
// Focusable element
className="... focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"

// Touch-target-sized button
className="inline-flex min-h-11 items-center justify-center rounded-md ..."

// Primary action
className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 ..."

// Form input
className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base ... dark:border-white/20"

// Status banner
<p role="status" aria-live="polite" className="...">

// Error banner
<p role="alert" className="text-red-600 dark:text-red-400">
```

### Dark mode

`prefers-color-scheme: dark` (no manual toggle). Use Tailwind's `dark:` variant; CSS variables for the few cases where a class doesn't cover it. Verify every new surface in **both** modes.

### Motion

Respects `prefers-reduced-motion: reduce`:

```tsx
className="motion-safe:hover:-translate-y-0.5 motion-safe:transition"
// or for required animations:
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reducedMotion) {
  viewer.rotate(target);          // instant
} else {
  viewer.animate({ ...target, speed: "10rpm" });
}
```

### Server actions (validation contract)

- Use `"use server"` modules under `src/lib/actions/`.
- Validate every input with zod. Authentication via `requireCreator(lang)` / `requireAdmin(lang)` / `requireCreatorWithAuthz(lang)`.
- Return shape: `{ ok: true; data: T } | { ok: false; error: string; code: string }`. Never throw to a client component.
- `revalidatePath()` every cache that the action invalidates. Public tour routes need their slug-keyed path explicitly revalidated.

### Database / migrations

- Schema in `src/db/schema/*.ts` (one file per logical group). Generate migrations with `pnpm db:generate`.
- Hand-edit the generated SQL when Drizzle misses a constraint (e.g., cross-table cyclic FK). Document why in the schema comment.
- Migration filenames are Drizzle-assigned (`NNNN_random_name.sql`) — don't rename.
- For prod, never run `pnpm db:migrate` (uses `.env.local`). Use `pnpm db:migrate:prod` with `DATABASE_URL` sourced from the shell, not a .env file.
- **`.env.local` is not automatically a development database.** It was pointing at production as of 2026-08, which made every dev-named command (`db:migrate`, `db:seed`, `db:push`, `db:promote`, `db:studio`) a production write. `DB_ENV` must now be declared in `.env.local` and those commands refuse without it — `scripts/guard-db-target.ts` fails closed. `db:push` is the sharp one: it applies schema differences directly, including `DROP COLUMN`, with no migration file to review.

### Media (Cloudinary)

- All upload URLs go through `src/lib/cloudinary-urls.ts` helpers (`imageUrl`, `posterUrlFor`, `video360PanoramaUrl`, `videoPosterUrl`). Don't construct Cloudinary URLs by hand.
- `media_assets.status === "ready"` is the gate — never surface in-flight rows to learners.
- 360° photo equirectangular, 2:1 aspect, 4K minimum recommended; 360° video MP4/H.264 for delivery.

### Component organization

- Server components by default. Add `"use client"` only when interaction or state requires it.
- Co-locate small client components beside their route (`scene-viewer-with-horizon.tsx` next to `page.tsx`). Promote to `src/components/` only when used by ≥2 routes.
- Props get explicit interfaces. Tour-related types live in [src/components/virtual-tour/types.ts](src/components/virtual-tour/types.ts).

---

## When in doubt

- Re-read this file.
- Re-read [docs/CREATOR_GUIDE.md](docs/CREATOR_GUIDE.md) for creator-facing flows; [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) for admin.
- Check `plans/app-improvements/` before writing code that might touch a known issue.
- Check `plans/user-tasks/00-descriptions.md` Blocks column before assuming an operational dependency is resolved.
- Don't invent features. The Phase 1 MVP scope is set; new behavior outside it gets a `plans/future/NN-slug.md` file and a conversation, not a commit.

This guide is a living document — propose updates via PR with the same review path as any other change.
