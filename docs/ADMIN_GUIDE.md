# Admin Guide

The admin-only surfaces of Wanderlearn, and what BAM does day to day as the sole admin in Phase 1.

If you're a creator or teacher, you want [CREATOR_GUIDE.md](CREATOR_GUIDE.md) instead. This doc covers only what requires the `admin` role.

---

## 0. Your admin surfaces

Four routes behind `requireAdmin()`:

| Route | What it's for |
|---|---|
| [/en/admin/users](/en/admin/users) | Promote users to creator / teacher / admin roles |
| [/en/admin/courses](/en/admin/courses) | Review + approve + unpublish courses |
| [/en/admin/support](/en/admin/support) | Triage every support thread across all users |
| [/en/admin/support/&lt;thread-id&gt;](/en/admin/support) | Read + reply to a specific thread, change its status |

Everything else on the site runs through the same UI creators and learners see. There's no separate admin-only "god mode" dashboard; the admin powers are narrowly scoped to role-gated actions.

---

## 1. User roles

Wanderlearn has four roles:

| Role | Can do |
|---|---|
| `learner` | Browse catalog, enroll in courses, take lessons. Default on sign-up. |
| `creator` | Everything a learner can do, plus upload media, build destinations/scenes/courses, submit for review. |
| `teacher` | Same as creator today. Reserved for future differentiation (e.g. institutional permissions). |
| `admin` | Everything creators/teachers can do, plus the four surfaces above. |

### Promoting a user

1. Open [/en/admin/users](/en/admin/users).
2. Find the user by email or name.
3. Pick the new role from the dropdown. Save.

Or via CLI: `pnpm db:promote <email> <role>`. Requires your `.env.local` `DATABASE_URL` to point at whichever DB you want to update.

**When to promote to `creator`**: someone who will build Wanderlearn courses (MUCHO partners, invited educators).

**When to promote to `teacher`**: same as creator for now. Revisit when we actually differentiate them (institutional dashboards, class cohorts, etc.).

**When to promote to `admin`**: yourself, and only yourself in Phase 1. Adding another admin gives them full access to all support threads, every course's review gate, and every user's role. High-trust action.

---

## 2. Reviewing and approving courses

Creators build a course in `draft`, then click **Submit for review** on their course detail page. That transitions the course to `in_review` status. Status is only visible to the creator and to admins.

### Your review inbox

[/en/admin/courses](/en/admin/courses) shows courses in `in_review` + `published` status, most-recently-updated first. Filter by status with the pills at the top.

### Reviewing a specific course

Click into any course to land on `/en/admin/courses/<id>`. You'll see:

- **Header**: title, creator (name + email), current status
- **Review controls**: the publish checklist (violations, if any) + approve / unpublish buttons
- **Lessons**: a summary of every lesson in the course with status and summary

The **publish checklist** is the same one the creator saw when they hit submit. If it's all green, the course is ready to publish. If it has violations, those are blocking; clicking **Approve and publish** will refuse with the same gate error.

### Approving a course

1. Skim the course content in the creator view: open the course as a learner via `/en/courses/<slug>` (you're an admin, so access is unrestricted), click through every lesson, verify quality, transcripts, accuracy.
2. Open any `virtual_tour` block and verify the referenced destination's scenes render correctly. If the destination mixes photo_360 and video_360 scenes, the viewer only renders the photos. An amber warning on the destination edit page flags this, but worth spot-checking from the learner view.
3. If the creator has toggled the destination to public (`/en/tours/<slug>` is reachable), confirm the public version looks right before approving; public share links live independently of course publish state.
4. Back in the admin review page, click **Approve and publish**. Course status becomes `published`, `publishedAt` is set. Course appears in the public catalog.

There's no signed reviewer record or audit trail beyond the `updatedAt` timestamp in Phase 1; you're the only admin, so it's implicit. When a second admin is added, add an audit log as a follow-up feature.

### Unpublishing

If a published course turns out to have a problem (copyright, incorrect content, safety):

1. Open [/en/admin/courses/&lt;id&gt;](/en/admin/courses).
2. Click **Unpublish**. Status becomes `unpublished`, removed from public catalog, `publishedAt` cleared.

Learners who already enrolled keep their enrollment (they paid for it, you don't take it back unilaterally) but the course is no longer purchaseable and no longer in the catalog. If the issue is severe enough to require revoking enrollments, that's a DB-level manual action today, tracked as a future admin-tool feature.

Re-submitting: the creator can revise and submit for review again. Status flows `unpublished` → `in_review` → `published`.

---

## 3. What the publish gate enforces

Full source in [src/lib/publish-gates.ts](../src/lib/publish-gates.ts). Five violation kinds:

| Violation | Meaning |
|---|---|
| `no_lessons` | Course has zero lessons |
| `lesson_empty` | A lesson has zero blocks |
| `video_missing_transcript` | A `video` or `video_360` block's media has no `transcript_media_id` linked |
| `media_not_ready` | A media-backed block points at media still `processing` |
| `media_missing` | A block points at media that's been deleted |

The gate runs on **submit for review** (creator-side) AND on **approve** (admin-side). You can't bypass a gate violation by clicking approve harder; the check re-runs server-side every time.

**What the gate does NOT check (yet)**: audio descriptions on videos, color-contrast of embedded images, length of content, language consistency with `defaultLocale`. Those are either out of scope for Phase 1 or tracked as follow-up accessibility gates.

---

## 4. Support inbox

As sole admin, you're also on-call for support threads.

[/en/admin/support](/en/admin/support) lists every thread across all users, sorted by most recent activity. Filter by status:

| Status | Meaning |
|---|---|
| `open` | New thread or any thread freshly created |
| `waiting_admin` | User replied; your turn to respond |
| `waiting_user` | You replied; user's turn |
| `resolved` | You marked it resolved (sets `resolvedAt`) |
| `closed` | Archived. Replying is blocked. |

### How threads flow

1. A user (any role) clicks the "Get help" floating button from any page, or navigates directly to [/en/support/new](/en/support/new).
2. They submit subject + category + body. Thread is created, `status=open`, first message attached with `authorRole=user`.
3. **You get a Mailgun email** at `ADMIN_NOTIFY_EMAIL` with the thread subject and excerpt + a deep link to the admin thread page.
4. You click the link, read the full thread, reply using the **Reply** form at the bottom.
5. Submitting a reply auto-flips the status to `waiting_user` AND emails the user via Mailgun.
6. Repeat until resolved. Click the **Status** dropdown to mark `resolved` or `closed` when done.

**Attachments in threads**: not in Phase 1. Users can only write text. If a screenshot is needed, instruct them to upload it to their media library (if they're a creator) or host it elsewhere and paste a link.

### Response time expectations

Plan 00 doesn't set a hard SLA. Best practice: respond within 24 hours during weekdays. If a thread is a genuine outage / user-locked-out / payment issue, prioritize.

---

## 5. Ecosystem + shared infrastructure

Wanderlearn isn't standalone forever. It shares Cloudinary with Fly.WitUS (future), Tour Manager OS (future), and CentenarianOS (future). You're the ecosystem admin for Wanderlearn's share.

**Read these before changing any Cloudinary or cross-app config:**
- [docs/CLOUDINARY_FOLDER_CONVENTION.md](CLOUDINARY_FOLDER_CONVENTION.md): top-level folder prefixes per app, `public_id` rule, `context` metadata keys, tags, BVC→Wanderlearn hand-off contract
- [docs/INFRA.md](INFRA.md): what every third-party service does, required env vars, R2 fallback plan
- [docs/CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md): signing, webhook, poster-frame generation

Two things to know as admin:

1. **Wanderlearn owns the `wanderlearn/` folder prefix** in the shared Cloudinary tenant. Don't let another app's signer drop uploads into `wanderlearn/`; that's the security boundary. The signer at [src/app/api/media/cloudinary-sign/route.ts](../src/app/api/media/cloudinary-sign/route.ts) hard-codes our prefix, so a compromised client can't exfiltrate.
2. **Reserved prefixes (`bvc/`, `tour/`, `cent/`) belong to other apps.** If you see content there, it's not yours; don't delete or modify.

---

## 6. Handling abuse

### Inappropriate course content

1. Unpublish the course from [/en/admin/courses/&lt;id&gt;](/en/admin/courses).
2. If the course references a destination whose creator has toggled **public** (a shareable `/en/tours/<slug>` link exists), you can't unpublish that directly from admin today. Ask the creator to flip it private, or, as a break-glass, manually set `destinations.is_public = false` against the DB. A dedicated admin control is a follow-up.
3. Contact the creator via support chat or direct email explaining why.
4. If egregious (illegal content, clear TOS violation), delete the course. The reference blocker will surface any media that needs to be deleted separately.
5. Log the action in a private note (no admin audit log exists yet, so keep your own record).

### Abusive support threads

A user spamming support threads:

1. Mark the threads `closed` (replying is blocked in `closed` state).
2. If it persists, revoke their account. There's no "ban" UI today; you'd manually null their session + delete their user row, or set `role=learner` and rely on rate-limiting. Log as a future admin tool need.

### Media reference blocker

If you try to delete media from [/en/creator/media](/en/creator/media) that a scene, destination hero, or course cover points at, you'll see a list of references and the delete is blocked. This is a safety feature, not a bug. Click through to each reference, replace the media with something else, then delete.

---

## 7. What doesn't exist yet

Honest list:

- **Admin audit log**: who approved what course, when. Today it's just `updatedAt`.
- **Revenue dashboard**: Stripe has your data, but Wanderlearn doesn't surface it per-course in the admin UI. View in Stripe dashboard directly.
- **Bulk actions**: you can't approve 10 courses at once or mark-all-read a batch of threads.
- **User detail page**: you can change a role, but there's no "view this user's courses and progress" page.
- **Scheduled content**: you can't schedule a course to publish at a specific time; you click approve when you want it live.
- **Refund UI**: refunds are manual via the Stripe dashboard for now. Add a refund action as a future admin tool.
- **Admin override for a creator's public-share toggle**: you can't un-share a public destination from admin; the creator has to flip it, or you DIY via SQL. Small follow-up.
- **PostHog analytics surfacing**: events aren't wired yet; waiting on the event taxonomy decision.

Each is a small feature, and none is hard. They're just not in Phase 1 because you're the only admin and you can work around each with the Stripe dashboard + direct DB queries + your own notes.

---

## 8. Emergency operations

If something goes badly wrong:

**The site is down (all routes 500):**
1. Check [Vercel dashboard](https://vercel.com) → Deployments → last deploy state.
2. If a recent deploy introduced the break, **promote the previous successful deploy** (Deployments → ⋯ on the known-good row → Promote to Production).
3. Open an incident in your notes. File a bug. Fix on a `fix/*` branch.

**A specific user is locked out:**
1. Check [/en/admin/users](/en/admin/users) for their account. Still there? Role correct?
2. If their sign-in method is stuck (magic-link not arriving), check Mailgun logs for bounces.
3. As a last resort: manually delete their `sessions` row in the DB and have them sign in fresh.

**Data loss panic:**
1. Don't run `db:migrate` or `db:seed` against production until you've assessed.
2. Neon Pro keeps 7 days of point-in-time snapshots. Restore from the Neon dashboard if needed.
3. Cloudinary assets are append-only for us (deletes are a creator action); they're not lost unless someone deleted them.

**Stripe webhook loop or duplicate charge:**
1. Check Stripe dashboard → Webhooks → recent deliveries to see what actually fired.
2. Cross-reference with the `purchases` table in the DB. Each Stripe `payment_intent.succeeded` should create exactly one `enrollments` row.
3. If a duplicate got through, manually adjust in Stripe (refund the duplicate) and in the DB (delete the extra `enrollments` row). Log the incident.

---

## 9. The rule set you agreed to

You're the admin, and also the person who agreed to how Wanderlearn operates. Read these when you hire a second admin:

- [plans/STYLE_GUIDE.md](../plans/STYLE_GUIDE.md): engineering standards, launch gates, commit conventions
- [plans/00-wanderlearn-phase-1-mvp.md](../plans/00-wanderlearn-phase-1-mvp.md): the plan you built against
- [docs/CLOUDINARY_FOLDER_CONVENTION.md](CLOUDINARY_FOLDER_CONVENTION.md): shared-infrastructure rules

The no-AI-content rule applies to admin actions too. Don't use AI to draft course approvals, support replies, or legal policy text. Your name stands behind what you publish.

---

## When in doubt

Ask yourself: "Is this something a creator could reasonably need me to do?" If yes, do it. If no, escalate to a human stakeholder (legal, accounting, cofounder if you have one) before taking an action that's hard to reverse.
