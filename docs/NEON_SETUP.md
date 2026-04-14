# Neon + Better Auth setup

Step-by-step provisioning for the Wanderlearn dev environment. Do this once per machine; the results go in `.env.local` (which is gitignored).

---

## 1. Create a Neon project

1. Go to <https://neon.tech> and sign in.
2. Create a new project. Region: whichever is closest to you; Postgres version: latest.
3. In the project dashboard, go to **Connection Details** → copy the **pooled** connection string.
4. Paste it into `.env.local` as `DATABASE_URL=postgres://…`.

Neon gives you a free tier with 0.5 GB storage and branch databases — more than enough for MVP development.

### Dev branches per feature

When you cut a new feature branch that touches the DB, create a Neon branch too so migrations are isolated:

```bash
# Install the Neon CLI once:
npm i -g neonctl
neonctl auth
# Create a branch:
neonctl branches create --name feat/db-schema-and-auth-sync
```

The CLI returns a new connection string. Put it in `.env.local` while you work on the branch; revert to the main Neon branch once merged.

---

## 2. Generate a Better Auth secret

```bash
openssl rand -base64 48
```

Copy the output into `.env.local` as `BETTER_AUTH_SECRET=…`. This is the key used to sign session cookies — rotating it invalidates all sessions, which is occasionally what you want.

For production on Vercel, set this in the Vercel dashboard under **Project Settings → Environment Variables**.

---

## 3. Run the first migration

With `DATABASE_URL` set:

```bash
pnpm db:generate   # reads src/db/schema/*, emits src/db/migrations/*.sql
pnpm db:migrate    # applies them to the Neon DB pointed at by DATABASE_URL
```

Or, for rapid iteration during development, skip the migration files and push the schema directly:

```bash
pnpm db:push
```

`db:push` is fine in development but **never** in production — it can drop columns to match the schema. In production, always use `db:migrate` against reviewed migration files committed to the repo.

### Inspect with Drizzle Studio

```bash
pnpm db:studio
```

Opens <https://local.drizzle.studio> with a browser UI for the connected database. Useful for seeing what the auth tables look like after a sign-in.

---

## 4. (Optional, but recommended) Mailgun for magic-link + OTP emails

Wanderlearn's sign-in page offers four methods:

- **Email + password** — works without any email provider.
- **Magic link** — Better Auth emails a one-click sign-in link.
- **Email OTP** — a 6-digit code emailed to the user.
- **Passkey** — WebAuthn; no email needed.

The magic-link and OTP methods require an email provider. Wanderlearn uses [Mailgun](https://www.mailgun.com).

**In development**, if `MAILGUN_API_KEY` or `MAILGUN_DOMAIN` is not set, the email body is logged to the server console instead of being sent. That's enough to test the flow locally — just copy the link or OTP from your terminal into your browser.

**In production**, both `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` are required. Steps:

1. Sign up at <https://www.mailgun.com>. The free tier covers 5,000 emails/month for three months, then ~$15/month for 10k.
2. In the Mailgun dashboard, **add and verify a sending domain** (e.g. `witus.online`). This requires adding the DNS records Mailgun shows you (SPF, DKIM, and optionally a `MX` + tracking CNAME) to your DNS provider. Verification usually takes 5–30 minutes.
3. Under **Sending → Domain settings → API keys**, create an API key scoped to your domain.
4. Add to `.env.local`:
   ```
   MAILGUN_API_KEY=...
   MAILGUN_DOMAIN=witus.online
   EMAIL_FROM=noreply@witus.online
   ```
5. Optional: if your Mailgun account was created in the **EU region**, also set `MAILGUN_REGION=eu`. The SDK defaults to the US endpoint (`api.mailgun.net`) and most accounts are US.

No Google / Apple / social login in Phase 1 — only email + passkeys.

---

## 5. Promoting yourself to admin

Right after your first sign-up, you're a `learner`. To promote to `admin`:

```bash
pnpm db:studio
# Or, via SQL:
psql $DATABASE_URL -c "update users set role='admin' where email='you@example.com';"
```

Once you're an admin, visit `/en/admin/users` to manage other users' roles through the UI.

---

## 6. Sanity check

- `pnpm dev` starts the app at <http://localhost:3000>
- `/en` and `/es` render the landing page
- `/en/sign-up` accepts a new account
- The new row appears in the `users` table (check via Drizzle Studio or psql)
- `/en/admin/users` is accessible after you promote yourself

If any of the above fails, run `pnpm typecheck` and `pnpm lint`, and post the error in the in-app support chat once it ships in week 11. Until then, flag it in a PR comment.
