## ⚠️ Ecosystem repo identity (don't confuse these)

When wiring outbox triggers in this repo, fetch and follow https://raw.githubusercontent.com/dapperAuteur/witus-outbox/main/examples/INTEGRATE.md and the per-app recipe at https://raw.githubusercontent.com/dapperAuteur/witus-outbox/main/examples/triggers/witus-online.md.

For ecosystem branding (favicons, logos, ecosystem footer with Rise Wellness), see https://raw.githubusercontent.com/dapperAuteur/witus-online/main/public/brand/README.md and the footer recipe at https://raw.githubusercontent.com/dapperAuteur/witus-online/main/public/brand/footer-recipe.md. The witus repo is the canonical home — update there first when ecosystem branding changes, then absorb into this repo on next touch.

The site **brandanthonymcdonald.com** (BAM's personal portfolio) lives in `/Users/bam/Code_NOiCloud/ai-builds/claude/bam-landing-page/` — **NOT** `bam-portfolio`. A stray directory at `/Users/bam/Code_NOiCloud/projects/bam-portfolio/` exists from a prior misplaced `Write` call (parent dirs auto-created); it is not a real repo. When asked to work on the brandanthonymcdonald.com codebase, target `bam-landing-page`.

This mistake has been made more than once. If you're about to write a file under `projects/bam-portfolio/` or refer to it as the BAM portfolio repo, stop and re-read this note.

---

## Operator-task rule — capture user actions in `./plans/user-tasks/`

When Claude proposes work that needs BAM to do something outside the editor (account signup, API key, DNS change, vendor dashboard, env-var rotation, secret generation, PR review/merge, etc.), Claude MUST create a `./plans/user-tasks/NN-slug.md` file in this repo. **No exceptions for "small" steps.**

Required sections per task file: **Scope tag** · **What + why** (with explicit *what this blocks* detail and any hard deadline) · **Steps** · **What Claude will use** · **How to mark done** · **Related**.

Update `./plans/user-tasks/00-descriptions.md` index with columns `# | Title | Scope | Blocks | Status`. The `Blocks` column is non-negotiable — that's the column BAM scans to triage the queue.

Full rule with rationale and reference task: `/Users/bam/Code_NOiCloud/ai-builds/gemini/witus/CLAUDE.md` §"Operator-task rule".

**Ecosystem-wide tasks** (Keap, IRL events, weekly retros, consultant reconciliation, cross-product decisions) live in the canonical witus queue at `gemini/witus/plans/user-tasks/`. **Repo-local tasks** (Wanderlearn deploy, env vars, Cloudinary tenant config, Ghana capture prep) live in this repo's own `./plans/user-tasks/`. Read the witus queue at session start before starting dependent work.

---

@AGENTS.md
